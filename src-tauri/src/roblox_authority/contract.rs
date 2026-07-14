use crate::platform::receipt::OperationReceipt;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const MAX_PLACE_BYTES: usize = 10_485_760;
pub const PUBLISH_CREDENTIAL_ALIAS: &str = "publish-default";
pub const ANALYTICS_CREDENTIAL_ALIAS: &str = "analytics-default";

#[derive(Debug, Clone, Copy, Error, PartialEq, Eq)]
pub enum AuthorityError {
    #[error("Roblox identifier must be a positive decimal integer")]
    InvalidRobloxId,
    #[error("credential alias is invalid")]
    InvalidCredentialAlias,
    #[error("API key is invalid")]
    InvalidApiKey,
    #[error("analytics operation path is invalid")]
    InvalidOperationPath,
    #[error("analytics range is invalid")]
    InvalidAnalyticsRange,
    #[error("target label is invalid")]
    InvalidTargetLabel,
    #[error("place display name is invalid")]
    InvalidDisplayName,
    #[error("place description is invalid")]
    InvalidDescription,
    #[error("requested target is not registered")]
    TargetNotFound,
    #[error("required credential is not configured")]
    CredentialNotConfigured,
    #[error("credential store is unavailable")]
    CredentialStoreUnavailable,
    #[error("target registry is unavailable")]
    RegistryUnavailable,
    #[error("Roblox rejected the request")]
    RobloxRejected,
    #[error("Roblox returned an invalid response")]
    InvalidRobloxResponse,
    #[error("project path is invalid")]
    InvalidProjectPath,
    #[error("project validation failed")]
    ProjectValidationFailed,
    #[error("project build failed")]
    ProjectBuildFailed,
    #[error("built place is empty")]
    EmptyPlaceArtifact,
    #[error("built place exceeds the Roblox upload limit")]
    PlaceArtifactTooLarge,
}

pub fn validate_roblox_id(value: &str) -> Result<String, AuthorityError> {
    let valid = !value.is_empty()
        && value.len() <= 20
        && value.bytes().all(|byte| byte.is_ascii_digit())
        && value != "0"
        && !value.starts_with('0')
        && value.parse::<u64>().is_ok_and(|id| id > 0);

    valid
        .then(|| value.to_owned())
        .ok_or(AuthorityError::InvalidRobloxId)
}

pub fn validate_credential_alias(value: &str) -> Result<String, AuthorityError> {
    let valid = !value.is_empty()
        && value.len() <= 64
        && value.bytes().all(|byte| {
            byte.is_ascii_lowercase() || byte.is_ascii_digit() || matches!(byte, b'-' | b'_' | b'.')
        })
        && !value.contains("..")
        && !value.contains("api-key")
        && !value.contains("api_key");

    valid
        .then(|| value.to_owned())
        .ok_or(AuthorityError::InvalidCredentialAlias)
}

pub fn validate_api_key_secret(value: &str) -> Result<(), AuthorityError> {
    let valid = (16..=4096).contains(&value.len())
        && value.trim() == value
        && value.bytes().all(|byte| byte.is_ascii_graphic());

    valid.then_some(()).ok_or(AuthorityError::InvalidApiKey)
}

pub fn validate_target_label(value: &str) -> Result<String, AuthorityError> {
    let trimmed = value.trim();
    let valid = !trimmed.is_empty()
        && trimmed.chars().count() <= 80
        && !trimmed.chars().any(char::is_control);
    valid
        .then(|| trimmed.to_owned())
        .ok_or(AuthorityError::InvalidTargetLabel)
}

pub fn validate_display_name(value: &str) -> Result<String, AuthorityError> {
    let trimmed = value.trim();
    let valid = !trimmed.is_empty()
        && trimmed.chars().count() <= 50
        && !trimmed.chars().any(char::is_control);
    valid
        .then(|| trimmed.to_owned())
        .ok_or(AuthorityError::InvalidDisplayName)
}

pub fn validate_description(value: &str) -> Result<String, AuthorityError> {
    let trimmed = value.trim();
    let valid = trimmed.chars().count() <= 1_000 && !trimmed.chars().any(char::is_control);
    valid
        .then(|| trimmed.to_owned())
        .ok_or(AuthorityError::InvalidDescription)
}

pub fn normalize_poll_path(universe_id: &str, path: &str) -> Result<String, AuthorityError> {
    let universe_id = validate_roblox_id(universe_id)?;
    let normalized = path
        .strip_prefix('/')
        .unwrap_or(path)
        .strip_prefix("analytics-query-api/")
        .unwrap_or_else(|| path.strip_prefix('/').unwrap_or(path));
    let prefix = format!("v1/universes/{universe_id}/operations/metrics/");
    let operation_id = normalized
        .strip_prefix(&prefix)
        .ok_or(AuthorityError::InvalidOperationPath)?;
    let valid_operation = !operation_id.is_empty()
        && operation_id.len() <= 128
        && operation_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'));

    valid_operation
        .then(|| format!("{prefix}{operation_id}"))
        .ok_or(AuthorityError::InvalidOperationPath)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PublishHttpDisposition {
    Succeeded,
    Rejected,
    OutcomeUnknown,
}

impl PublishHttpDisposition {
    pub fn from_response(status: u16, version_number: Option<u64>) -> Self {
        match status {
            200..=299 if version_number.is_some_and(|version| version > 0) => Self::Succeeded,
            200..=299 => Self::OutcomeUnknown,
            429 | 500..=599 => Self::OutcomeUnknown,
            _ => Self::Rejected,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CredentialPurpose {
    Publish,
    Analytics,
}

impl CredentialPurpose {
    pub fn alias(self) -> &'static str {
        match self {
            Self::Publish => PUBLISH_CREDENTIAL_ALIAS,
            Self::Analytics => ANALYTICS_CREDENTIAL_ALIAS,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CredentialSlotStatus {
    pub purpose: CredentialPurpose,
    pub configured: bool,
    pub alias: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verified_at: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CapabilityState {
    Ready,
    SetupRequired,
    Unsupported,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityDetail {
    pub state: CapabilityState,
    pub ready: bool,
    pub required_scopes: Vec<String>,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RobloxCapabilities {
    pub auth_mode: String,
    pub create_universe: CapabilityDetail,
    pub publish_existing_place: CapabilityDetail,
    pub update_place_metadata: CapabilityDetail,
    pub owned_analytics: CapabilityDetail,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VerifiedRobloxTarget {
    pub id: String,
    pub label: String,
    pub universe_id: String,
    pub root_place_id: String,
    pub publish_credential_alias: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub analytics_credential_alias: Option<String>,
    pub verified_at: String,
    pub game_url: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RobloxAuthorityState {
    pub create_universe_supported: bool,
    pub publish_credential: CredentialSlotStatus,
    pub analytics_credential: CredentialSlotStatus,
    pub targets: Vec<VerifiedRobloxTarget>,
    pub capabilities: RobloxCapabilities,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum AnalyticsMetric {
    DailyActiveUsers,
    DailyRevenue,
    ForwardD1Retention,
    #[serde(rename = "PayingUsersCVR")]
    PayingUsersCvr,
}

impl AnalyticsMetric {
    pub fn as_wire(self) -> &'static str {
        match self {
            Self::DailyActiveUsers => "DailyActiveUsers",
            Self::DailyRevenue => "DailyRevenue",
            Self::ForwardD1Retention => "ForwardD1Retention",
            Self::PayingUsersCvr => "PayingUsersCVR",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum AnalyticsGranularity {
    OneDay,
    OneWeek,
    OneMonth,
    None,
}

impl AnalyticsGranularity {
    pub fn as_wire(self) -> &'static str {
        match self {
            Self::OneDay => "OneDay",
            Self::OneWeek => "OneWeek",
            Self::OneMonth => "OneMonth",
            Self::None => "None",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsRange {
    pub metric: AnalyticsMetric,
    pub granularity: AnalyticsGranularity,
    pub start_time: String,
    pub end_time: String,
}

impl AnalyticsRange {
    pub fn validate(&self) -> Result<(), AuthorityError> {
        let start = DateTime::parse_from_rfc3339(&self.start_time)
            .map_err(|_| AuthorityError::InvalidAnalyticsRange)?;
        let end = DateTime::parse_from_rfc3339(&self.end_time)
            .map_err(|_| AuthorityError::InvalidAnalyticsRange)?;
        let valid = start < end
            && end.signed_duration_since(start).num_days() <= 1_462
            && end <= Utc::now() + chrono::Duration::minutes(5);
        valid
            .then_some(())
            .ok_or(AuthorityError::InvalidAnalyticsRange)
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AnalyticsPointQuality {
    Valid,
    Projected,
    Insufficient,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsDataPoint {
    pub time: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,
    #[serde(default)]
    pub string_values: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quality: Option<AnalyticsPointQuality>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsBreakdown {
    pub dimension: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsSeries {
    #[serde(default)]
    pub breakdowns: Vec<AnalyticsBreakdown>,
    #[serde(default)]
    pub data_points: Vec<AnalyticsDataPoint>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AnalyticsResultStatus {
    Available,
    Pending,
    NoData,
    Insufficient,
    Projected,
    Stale,
    Failed,
}

pub fn analytics_status(points: &[AnalyticsDataPoint], stale: bool) -> AnalyticsResultStatus {
    if points.is_empty() {
        AnalyticsResultStatus::NoData
    } else if points
        .iter()
        .any(|point| point.quality == Some(AnalyticsPointQuality::Insufficient))
    {
        AnalyticsResultStatus::Insufficient
    } else if points
        .iter()
        .any(|point| point.quality == Some(AnalyticsPointQuality::Projected))
    {
        AnalyticsResultStatus::Projected
    } else if stale {
        AnalyticsResultStatus::Stale
    } else {
        AnalyticsResultStatus::Available
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AnalyticsErrorView {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<i64>,
    pub category: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnedAnalyticsResponse {
    pub receipt: OperationReceipt,
    pub target_id: String,
    pub universe_id: String,
    pub metric: AnalyticsMetric,
    pub granularity: AnalyticsGranularity,
    pub start_time: String,
    pub end_time: String,
    pub status: AnalyticsResultStatus,
    pub observed_at: String,
    pub stale_after: String,
    pub series: Vec<AnalyticsSeries>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<AnalyticsErrorView>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PublishReceiptValue {
    pub target_id: String,
    pub universe_id: String,
    pub root_place_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version_number: Option<u64>,
    pub game_url: String,
    pub upload_completed: bool,
    pub metadata_completed: bool,
}

pub fn timestamp() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub fn game_url(root_place_id: &str) -> String {
    format!("https://www.roblox.com/games/start?placeId={root_place_id}")
}
