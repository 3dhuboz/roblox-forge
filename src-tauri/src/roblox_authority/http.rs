use super::{
    normalize_poll_path, AnalyticsBreakdown, AnalyticsDataPoint, AnalyticsPointQuality,
    AnalyticsRange, AnalyticsSeries, AuthorityError, CredentialPurpose, SecretValue,
};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use reqwest::{header, Client, Response};
use serde::{de::DeserializeOwned, Deserialize};
use serde_json::json;
use std::time::Duration;

const DEFAULT_BASE_URL: &str = "https://apis.roblox.com";
const MAX_JSON_RESPONSE_BYTES: usize = 2_097_152;
pub const MAX_PUBLISH_RESPONSE_BYTES: usize = 65_536;

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IntrospectionScope {
    pub name: String,
    #[serde(default)]
    pub operations: Vec<String>,
    #[serde(default)]
    pub universe_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IntrospectionDocument {
    pub name: String,
    pub authorized_user_id: u64,
    #[serde(default)]
    pub scopes: Vec<IntrospectionScope>,
    pub enabled: bool,
    pub expired: bool,
    #[serde(default)]
    pub expiration_time_utc: Option<String>,
}

impl IntrospectionDocument {
    pub fn allows(&self, purpose: CredentialPurpose, universe_id: Option<&str>) -> bool {
        let expiration_passed = self.expiration_time_utc.as_deref().is_some_and(|value| {
            DateTime::parse_from_rfc3339(value)
                .map(|expiration| expiration <= Utc::now())
                .unwrap_or(true)
        });
        if !self.enabled || self.expired || expiration_passed {
            return false;
        }

        let required = match purpose {
            CredentialPurpose::Publish => {
                &[("universe-places", "write"), ("universe.place", "write")][..]
            }
            CredentialPurpose::Analytics => &[("universe.analytics", "read")][..],
        };

        required.iter().all(|(name, operation)| {
            self.scopes.iter().any(|scope| {
                scope.name == *name
                    && scope
                        .operations
                        .iter()
                        .any(|candidate| candidate == operation)
                    && universe_id.is_none_or(|universe_id| {
                        scope
                            .universe_ids
                            .iter()
                            .any(|candidate| candidate == universe_id)
                    })
            })
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HttpFailureKind {
    Transport,
    Rejected,
    InvalidResponse,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HttpFailure {
    pub kind: HttpFailureKind,
    pub status: Option<u16>,
    pub code: Option<i64>,
}

impl HttpFailure {
    fn transport() -> Self {
        Self {
            kind: HttpFailureKind::Transport,
            status: None,
            code: None,
        }
    }

    fn rejected(status: u16) -> Self {
        Self {
            kind: HttpFailureKind::Rejected,
            status: Some(status),
            code: None,
        }
    }

    fn invalid_response() -> Self {
        Self {
            kind: HttpFailureKind::InvalidResponse,
            status: None,
            code: None,
        }
    }

    pub fn category(&self) -> &'static str {
        match self.kind {
            HttpFailureKind::Transport => "transport_error",
            HttpFailureKind::Rejected => "roblox_rejected",
            HttpFailureKind::InvalidResponse => "invalid_response",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MutationHttpResult {
    pub status: u16,
    pub version_number: Option<u64>,
}

#[derive(Debug, Clone)]
pub struct ParsedAnalyticsOperation {
    pub path: String,
    pub done: bool,
    pub created_at: DateTime<Utc>,
    pub series: Vec<AnalyticsSeries>,
    pub error_code: Option<i64>,
}

#[async_trait]
pub trait RobloxApi: Send + Sync {
    async fn introspect(&self, api_key: &SecretValue)
        -> Result<IntrospectionDocument, HttpFailure>;

    async fn verify_place(
        &self,
        api_key: &SecretValue,
        universe_id: &str,
        place_id: &str,
    ) -> Result<(), HttpFailure>;

    async fn publish_place(
        &self,
        api_key: &SecretValue,
        universe_id: &str,
        place_id: &str,
        artifact: Vec<u8>,
    ) -> Result<MutationHttpResult, HttpFailure>;

    async fn update_place_metadata(
        &self,
        api_key: &SecretValue,
        universe_id: &str,
        place_id: &str,
        display_name: &str,
        description: &str,
    ) -> Result<MutationHttpResult, HttpFailure>;

    async fn query_analytics(
        &self,
        api_key: &SecretValue,
        universe_id: &str,
        range: &AnalyticsRange,
    ) -> Result<ParsedAnalyticsOperation, HttpFailure>;

    async fn poll_analytics(
        &self,
        api_key: &SecretValue,
        universe_id: &str,
        path: &str,
    ) -> Result<ParsedAnalyticsOperation, HttpFailure>;
}

pub struct ReqwestRobloxApi {
    client: Client,
    base_url: String,
}

impl ReqwestRobloxApi {
    pub fn production() -> Result<Self, AuthorityError> {
        Self::new(DEFAULT_BASE_URL)
    }

    pub fn new(base_url: &str) -> Result<Self, AuthorityError> {
        Self::new_internal(base_url, false)
    }

    #[cfg(test)]
    fn new_for_test(base_url: &str) -> Result<Self, AuthorityError> {
        Self::new_internal(base_url, true)
    }

    fn new_internal(base_url: &str, allow_http_for_tests: bool) -> Result<Self, AuthorityError> {
        let parsed = url::Url::parse(base_url).map_err(|_| AuthorityError::RobloxRejected)?;
        let valid_scheme =
            parsed.scheme() == "https" || (allow_http_for_tests && parsed.scheme() == "http");
        if !valid_scheme
            || parsed.host_str().is_none()
            || parsed.path() != "/"
            || parsed.query().is_some()
            || parsed.fragment().is_some()
        {
            return Err(AuthorityError::RobloxRejected);
        }
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(30))
            .redirect(reqwest::redirect::Policy::none())
            .user_agent("RobloxForge/0.1 private-alpha")
            .build()
            .map_err(|_| AuthorityError::RobloxRejected)?;
        Ok(Self {
            client,
            base_url: base_url.trim_end_matches('/').to_owned(),
        })
    }

    fn api_key_header(api_key: &SecretValue) -> Result<header::HeaderValue, HttpFailure> {
        header::HeaderValue::from_str(api_key.expose()).map_err(|_| HttpFailure::invalid_response())
    }

    fn endpoint(&self, path: &str) -> String {
        format!("{}{path}", self.base_url)
    }

    async fn parse_analytics_response(
        response: Response,
        universe_id: &str,
    ) -> Result<ParsedAnalyticsOperation, HttpFailure> {
        let status = response.status().as_u16();
        if !(200..=299).contains(&status) {
            let code = read_json::<AnalyticsOperationDocument>(response)
                .await
                .ok()
                .and_then(|document| document.error.map(|error| error.code));
            return Err(HttpFailure {
                kind: HttpFailureKind::Rejected,
                status: Some(status),
                code,
            });
        }
        let document: AnalyticsOperationDocument = read_json(response).await?;
        document.parse(universe_id)
    }
}

#[async_trait]
impl RobloxApi for ReqwestRobloxApi {
    async fn introspect(
        &self,
        api_key: &SecretValue,
    ) -> Result<IntrospectionDocument, HttpFailure> {
        let response = self
            .client
            .post(self.endpoint("/api-keys/v1/introspect"))
            .timeout(Duration::from_secs(15))
            .json(&json!({ "apiKey": api_key.expose() }))
            .send()
            .await
            .map_err(|_| HttpFailure::transport())?;
        if !response.status().is_success() {
            return Err(HttpFailure::rejected(response.status().as_u16()));
        }
        read_json(response).await
    }

    async fn verify_place(
        &self,
        api_key: &SecretValue,
        universe_id: &str,
        place_id: &str,
    ) -> Result<(), HttpFailure> {
        let path = format!("/cloud/v2/universes/{universe_id}/places/{place_id}");
        let response = self
            .client
            .get(self.endpoint(&path))
            .timeout(Duration::from_secs(20))
            .header("x-api-key", Self::api_key_header(api_key)?)
            .send()
            .await
            .map_err(|_| HttpFailure::transport())?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(HttpFailure::rejected(response.status().as_u16()))
        }
    }

    async fn publish_place(
        &self,
        api_key: &SecretValue,
        universe_id: &str,
        place_id: &str,
        artifact: Vec<u8>,
    ) -> Result<MutationHttpResult, HttpFailure> {
        let path =
            format!("/universes/v1/{universe_id}/places/{place_id}/versions?versionType=Published");
        let response = self
            .client
            .post(self.endpoint(&path))
            .timeout(Duration::from_secs(90))
            .header("x-api-key", Self::api_key_header(api_key)?)
            .header(header::CONTENT_TYPE, "application/octet-stream")
            .body(artifact)
            .send()
            .await
            .map_err(|_| HttpFailure::transport())?;
        let status = response.status().as_u16();
        let version_number = if response.status().is_success() {
            read_optional_version(response).await
        } else {
            None
        };
        Ok(MutationHttpResult {
            status,
            version_number,
        })
    }

    async fn update_place_metadata(
        &self,
        api_key: &SecretValue,
        universe_id: &str,
        place_id: &str,
        display_name: &str,
        description: &str,
    ) -> Result<MutationHttpResult, HttpFailure> {
        let path = format!(
            "/cloud/v2/universes/{universe_id}/places/{place_id}?updateMask=displayName,description"
        );
        let response = self
            .client
            .patch(self.endpoint(&path))
            .timeout(Duration::from_secs(30))
            .header("x-api-key", Self::api_key_header(api_key)?)
            .json(&json!({
                "displayName": display_name,
                "description": description,
            }))
            .send()
            .await
            .map_err(|_| HttpFailure::transport())?;
        Ok(MutationHttpResult {
            status: response.status().as_u16(),
            version_number: None,
        })
    }

    async fn query_analytics(
        &self,
        api_key: &SecretValue,
        universe_id: &str,
        range: &AnalyticsRange,
    ) -> Result<ParsedAnalyticsOperation, HttpFailure> {
        let path = format!("/analytics-query-api/v1/universes/{universe_id}/metrics");
        let response = self
            .client
            .post(self.endpoint(&path))
            .timeout(Duration::from_secs(30))
            .header("x-api-key", Self::api_key_header(api_key)?)
            .json(&json!({
                "metric": range.metric.as_wire(),
                "granularity": range.granularity.as_wire(),
                "startTime": range.start_time,
                "endTime": range.end_time,
            }))
            .send()
            .await
            .map_err(|_| HttpFailure::transport())?;
        Self::parse_analytics_response(response, universe_id).await
    }

    async fn poll_analytics(
        &self,
        api_key: &SecretValue,
        universe_id: &str,
        path: &str,
    ) -> Result<ParsedAnalyticsOperation, HttpFailure> {
        let path =
            normalize_poll_path(universe_id, path).map_err(|_| HttpFailure::invalid_response())?;
        let endpoint = format!("/analytics-query-api/{path}");
        let response = self
            .client
            .get(self.endpoint(&endpoint))
            .timeout(Duration::from_secs(20))
            .header("x-api-key", Self::api_key_header(api_key)?)
            .send()
            .await
            .map_err(|_| HttpFailure::transport())?;
        Self::parse_analytics_response(response, universe_id).await
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VersionResponse {
    version_number: u64,
}

pub fn parse_publish_version_body(bytes: &[u8]) -> Result<u64, AuthorityError> {
    if bytes.len() > MAX_PUBLISH_RESPONSE_BYTES {
        return Err(AuthorityError::InvalidRobloxResponse);
    }
    let version_number = serde_json::from_slice::<VersionResponse>(bytes)
        .map_err(|_| AuthorityError::InvalidRobloxResponse)?
        .version_number;
    (version_number > 0)
        .then_some(version_number)
        .ok_or(AuthorityError::InvalidRobloxResponse)
}

async fn read_optional_version(response: Response) -> Option<u64> {
    if response
        .content_length()
        .is_some_and(|length| length > MAX_PUBLISH_RESPONSE_BYTES as u64)
    {
        return None;
    }
    let bytes = read_limited(response, MAX_PUBLISH_RESPONSE_BYTES)
        .await
        .ok()?;
    parse_publish_version_body(&bytes).ok()
}

async fn read_json<T: DeserializeOwned>(response: Response) -> Result<T, HttpFailure> {
    if response
        .content_length()
        .is_some_and(|length| length > MAX_JSON_RESPONSE_BYTES as u64)
    {
        return Err(HttpFailure::invalid_response());
    }
    let bytes = read_limited(response, MAX_JSON_RESPONSE_BYTES).await?;
    serde_json::from_slice(&bytes).map_err(|_| HttpFailure::invalid_response())
}

async fn read_limited(mut response: Response, maximum: usize) -> Result<Vec<u8>, HttpFailure> {
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| HttpFailure::invalid_response())?
    {
        if bytes.len().saturating_add(chunk.len()) > maximum {
            return Err(HttpFailure::invalid_response());
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AnalyticsOperationDocument {
    path: String,
    done: bool,
    metadata: AnalyticsMetadataDocument,
    response: Option<AnalyticsResponseDocument>,
    error: Option<AnalyticsOperationErrorDocument>,
}

impl AnalyticsOperationDocument {
    fn parse(self, universe_id: &str) -> Result<ParsedAnalyticsOperation, HttpFailure> {
        let path = normalize_poll_path(universe_id, &self.path)
            .map_err(|_| HttpFailure::invalid_response())?;
        let created_at = DateTime::parse_from_rfc3339(&self.metadata.created_time)
            .map_err(|_| HttpFailure::invalid_response())?
            .with_timezone(&Utc);
        if self.done && self.error.is_none() && self.response.is_none() {
            return Err(HttpFailure::invalid_response());
        }
        if !self.done && (self.response.is_some() || self.error.is_some()) {
            return Err(HttpFailure::invalid_response());
        }
        let error_code = self.error.map(|error| error.code);
        let series = self
            .response
            .map(AnalyticsResponseDocument::parse)
            .transpose()?
            .unwrap_or_default();
        Ok(ParsedAnalyticsOperation {
            path,
            done: self.done,
            created_at,
            series,
            error_code,
        })
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AnalyticsMetadataDocument {
    created_time: String,
}

#[derive(Debug, Deserialize)]
struct AnalyticsOperationErrorDocument {
    code: i64,
    #[allow(dead_code)]
    message: String,
}

#[derive(Debug, Deserialize)]
struct AnalyticsResponseDocument {
    #[serde(default)]
    values: Vec<AnalyticsSeriesDocument>,
}

impl AnalyticsResponseDocument {
    fn parse(self) -> Result<Vec<AnalyticsSeries>, HttpFailure> {
        if self.values.len() > 64 {
            return Err(HttpFailure::invalid_response());
        }
        let mut total_points = 0usize;
        self.values
            .into_iter()
            .map(|series| {
                total_points = total_points.saturating_add(series.data_points.len());
                if total_points > 5_000 || series.breakdowns.len() > 8 {
                    return Err(HttpFailure::invalid_response());
                }
                Ok(AnalyticsSeries {
                    breakdowns: series
                        .breakdowns
                        .into_iter()
                        .map(|breakdown| {
                            Ok(AnalyticsBreakdown {
                                dimension: bounded_text(breakdown.dimension, 64)?,
                                value: bounded_text(breakdown.value, 128)?,
                                display_value: breakdown
                                    .display_value
                                    .map(|value| bounded_text(value, 128))
                                    .transpose()?,
                            })
                        })
                        .collect::<Result<Vec<_>, HttpFailure>>()?,
                    data_points: series
                        .data_points
                        .into_iter()
                        .map(AnalyticsPointDocument::parse)
                        .collect::<Result<Vec<_>, HttpFailure>>()?,
                })
            })
            .collect()
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AnalyticsSeriesDocument {
    #[serde(default)]
    breakdowns: Vec<AnalyticsBreakdownDocument>,
    #[serde(default)]
    data_points: Vec<AnalyticsPointDocument>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AnalyticsBreakdownDocument {
    dimension: String,
    value: String,
    display_value: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AnalyticsPointDocument {
    time: String,
    value: Option<f64>,
    #[serde(default)]
    string_values: Vec<String>,
    status: Option<String>,
}

impl AnalyticsPointDocument {
    fn parse(self) -> Result<AnalyticsDataPoint, HttpFailure> {
        DateTime::parse_from_rfc3339(&self.time).map_err(|_| HttpFailure::invalid_response())?;
        if self.value.is_some_and(|value| !value.is_finite()) || self.string_values.len() > 16 {
            return Err(HttpFailure::invalid_response());
        }
        let quality = match self.status.as_deref() {
            None => None,
            Some("Valid") => Some(AnalyticsPointQuality::Valid),
            Some("Projected") => Some(AnalyticsPointQuality::Projected),
            Some("NotStatisticallySignificant") => Some(AnalyticsPointQuality::Insufficient),
            Some(_) => return Err(HttpFailure::invalid_response()),
        };
        let string_values = self
            .string_values
            .into_iter()
            .map(|value| bounded_text(value, 128))
            .collect::<Result<Vec<_>, _>>()?;
        Ok(AnalyticsDataPoint {
            time: self.time,
            value: self.value,
            string_values,
            quality,
        })
    }
}

fn bounded_text(value: String, maximum: usize) -> Result<String, HttpFailure> {
    let valid = !value.chars().any(char::is_control) && value.chars().count() <= maximum;
    valid
        .then_some(value)
        .ok_or_else(HttpFailure::invalid_response)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::TcpListener,
        time::timeout,
    };

    #[tokio::test]
    async fn client_redirect_policy_does_not_follow_location() {
        let destination = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let destination_address = destination.local_addr().unwrap();
        let source = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let source_address = source.local_addr().unwrap();
        let source_task = tokio::spawn(async move {
            let (mut socket, _) = source.accept().await.unwrap();
            let mut request = [0u8; 2_048];
            let _ = socket.read(&mut request).await.unwrap();
            socket
                .write_all(
                    format!(
                        "HTTP/1.1 302 Found\r\nLocation: http://{destination_address}/captured\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                    )
                    .as_bytes(),
                )
                .await
                .unwrap();
        });

        let api = ReqwestRobloxApi::new_for_test(&format!("http://{source_address}"))
            .expect("test client should initialize");
        let secret = SecretValue::new("a234567890123456".to_owned());
        let failure = api.introspect(&secret).await.unwrap_err();
        source_task.await.unwrap();

        assert_eq!(failure.kind, HttpFailureKind::Rejected);
        assert_eq!(failure.status, Some(302));
        assert!(
            timeout(Duration::from_millis(250), destination.accept())
                .await
                .is_err(),
            "redirect destination must not receive a replayed credential request"
        );
    }
}
