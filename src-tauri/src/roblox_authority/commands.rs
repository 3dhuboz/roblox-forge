use super::{
    analytics_status, default_credential_vault, game_url, timestamp, validate_api_key_secret,
    validate_credential_alias, validate_description, validate_display_name, validate_roblox_id,
    validate_target_label, AnalyticsErrorView, AnalyticsRange, AnalyticsResultStatus,
    AuthorityError, CapabilityDetail, CapabilityState, CredentialMetadata, CredentialPurpose,
    CredentialSlotStatus, CredentialVault, HttpFailure, HttpFailureKind, OwnedAnalyticsResponse,
    PublishHttpDisposition, PublishReceiptValue, RegistryDocument, RegistryStore, ReqwestRobloxApi,
    RobloxApi, RobloxAuthorityState, RobloxCapabilities, SecretValue, VerifiedRobloxTarget,
    ANALYTICS_CREDENTIAL_ALIAS, MAX_PLACE_BYTES, PUBLISH_CREDENTIAL_ALIAS,
};
use crate::{
    commands,
    platform::receipt::{
        FailureRetrySafety, OperationAttempt, OperationReceipt, OutcomeUnknownEvidence,
        PartialSuccessEvidence, SuccessEvidence,
    },
};
use chrono::{Duration as ChronoDuration, Utc};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};
use tauri::State;
use uuid::Uuid;

const PUBLISH_SCOPES: &[&str] = &["universe-places:write", "universe.place:write"];
const ANALYTICS_SCOPES: &[&str] = &["universe.analytics:read"];
const ANALYTICS_POLL_ATTEMPTS: usize = 5;

pub struct RobloxAuthority {
    vault: Arc<dyn CredentialVault>,
    registry: Arc<RegistryStore>,
    api: Arc<dyn RobloxApi>,
}

impl RobloxAuthority {
    pub fn production() -> Result<Self, AuthorityError> {
        Ok(Self::new(
            default_credential_vault(),
            Arc::new(RegistryStore::production()?),
            Arc::new(ReqwestRobloxApi::production()?),
        ))
    }

    pub fn new(
        vault: Arc<dyn CredentialVault>,
        registry: Arc<RegistryStore>,
        api: Arc<dyn RobloxApi>,
    ) -> Self {
        Self {
            vault,
            registry,
            api,
        }
    }

    async fn vault_get(&self, alias: &str) -> Result<Option<SecretValue>, AuthorityError> {
        let vault = Arc::clone(&self.vault);
        let alias = alias.to_owned();
        tokio::task::spawn_blocking(move || vault.get(&alias))
            .await
            .map_err(|_| AuthorityError::CredentialStoreUnavailable)?
    }

    async fn vault_set(&self, alias: &str, secret: &SecretValue) -> Result<(), AuthorityError> {
        let vault = Arc::clone(&self.vault);
        let alias = alias.to_owned();
        let secret = SecretValue::new(secret.expose().to_owned());
        tokio::task::spawn_blocking(move || vault.set(&alias, secret.expose()))
            .await
            .map_err(|_| AuthorityError::CredentialStoreUnavailable)?
    }

    async fn vault_delete(&self, alias: &str) -> Result<(), AuthorityError> {
        let vault = Arc::clone(&self.vault);
        let alias = alias.to_owned();
        tokio::task::spawn_blocking(move || vault.delete(&alias))
            .await
            .map_err(|_| AuthorityError::CredentialStoreUnavailable)?
    }

    pub async fn state(&self) -> Result<RobloxAuthorityState, AuthorityError> {
        let registry = self.registry.load()?;
        let publish_configured = self
            .vault_get(PUBLISH_CREDENTIAL_ALIAS)
            .await
            .map(|value| value.is_some())
            .unwrap_or(false);
        let analytics_configured = self
            .vault_get(ANALYTICS_CREDENTIAL_ALIAS)
            .await
            .map(|value| value.is_some())
            .unwrap_or(false);

        let publish_credential =
            credential_status(CredentialPurpose::Publish, publish_configured, &registry);
        let analytics_credential = credential_status(
            CredentialPurpose::Analytics,
            analytics_configured,
            &registry,
        );
        let has_target = !registry.targets.is_empty();
        let has_analytics_target = registry
            .targets
            .iter()
            .any(|target| target.analytics_credential_alias.is_some());
        let publish_ready = publish_configured && has_target;
        let analytics_ready = analytics_configured && has_analytics_target;

        Ok(RobloxAuthorityState {
            create_universe_supported: false,
            publish_credential,
            analytics_credential,
            targets: registry.targets,
            capabilities: RobloxCapabilities {
                auth_mode: "api_key".to_owned(),
                create_universe: CapabilityDetail {
                    state: CapabilityState::Unsupported,
                    ready: false,
                    required_scopes: Vec::new(),
                    reason: "Roblox Open Cloud cannot create a universe; bootstrap it once in Studio or Creator Dashboard".to_owned(),
                },
                publish_existing_place: capability(
                    publish_ready,
                    PUBLISH_SCOPES,
                    "A publishing credential and verified target are required",
                ),
                update_place_metadata: capability(
                    publish_ready,
                    &["universe.place:write"],
                    "A publishing credential and verified target are required",
                ),
                owned_analytics: capability(
                    analytics_ready,
                    ANALYTICS_SCOPES,
                    "An analytics credential and analytics-enabled verified target are required",
                ),
            },
        })
    }

    pub async fn save_credential(
        &self,
        purpose: CredentialPurpose,
        api_key: String,
    ) -> OperationReceipt {
        let attempt = operation_attempt("roblox.credential.save", None);
        if validate_api_key_secret(&api_key).is_err() {
            return attempt.failed(
                "Credential was not saved",
                vec!["Credential format is invalid".to_owned()],
                FailureRetrySafety::NotRetryable,
            );
        }
        let secret = SecretValue::new(api_key);
        let introspection = match self.api.introspect(&secret).await {
            Ok(document) => document,
            Err(failure) => {
                return attempt.failed(
                    "Credential verification failed",
                    vec![http_diagnostic(&failure)],
                    retry_safety_for_read(&failure),
                )
            }
        };
        if !introspection.allows(purpose, None) {
            return attempt.failed(
                "Credential lacks the required permission",
                vec!["Use a separate least-privilege credential for this purpose".to_owned()],
                FailureRetrySafety::NotRetryable,
            );
        }
        let alias = purpose.alias();
        if let Err(error) = self.vault_set(alias, &secret).await {
            return attempt.failed(
                "Credential could not be stored",
                vec![error.to_string()],
                FailureRetrySafety::Safe,
            );
        }
        let verified_at = timestamp();
        let metadata = CredentialMetadata {
            purpose,
            alias: alias.to_owned(),
            verified_at: verified_at.clone(),
        };
        let status = CredentialSlotStatus {
            purpose,
            configured: true,
            alias: alias.to_owned(),
            verified_at: Some(verified_at),
        };
        if self.registry.set_credential_metadata(metadata).is_err() {
            return attempt
                .partial_success(
                    PartialSuccessEvidence::new(alias).expect("fixed credential alias is valid"),
                    "Credential stored but local status could not be updated",
                    vec!["Credential material remains in Windows Credential Manager".to_owned()],
                )
                .with_recovery_action("Retry saving the credential to refresh local status")
                .with_value(value_or_empty(&status));
        }
        let evidence = SuccessEvidence::new(public_hash(&status))
            .expect("public credential status produces a valid hash");
        attempt
            .succeeded(evidence, "Credential verified and stored", Vec::new())
            .with_value(value_or_empty(&status))
    }

    pub async fn delete_credential(&self, purpose: CredentialPurpose) -> OperationReceipt {
        let attempt = operation_attempt("roblox.credential.delete", None);
        let alias = purpose.alias();
        if let Err(error) = self.vault_delete(alias).await {
            return attempt.failed(
                "Credential could not be deleted",
                vec![error.to_string()],
                FailureRetrySafety::Safe,
            );
        }
        let status = CredentialSlotStatus {
            purpose,
            configured: false,
            alias: alias.to_owned(),
            verified_at: None,
        };
        if self.registry.clear_credential_metadata(purpose).is_err() {
            return attempt
                .partial_success(
                    PartialSuccessEvidence::new(alias).expect("fixed credential alias is valid"),
                    "Credential deleted but local status cleanup failed",
                    Vec::new(),
                )
                .with_recovery_action("Restart the app and retry status cleanup")
                .with_value(value_or_empty(&status));
        }
        let evidence = SuccessEvidence::new(public_hash(&status))
            .expect("public credential status produces a valid hash");
        attempt
            .succeeded(evidence, "Credential deleted", Vec::new())
            .with_value(value_or_empty(&status))
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn register_target(
        &self,
        label: String,
        universe_id: String,
        root_place_id: String,
        publish_credential_alias: String,
        analytics_credential_alias: Option<String>,
    ) -> OperationReceipt {
        let attempt = operation_attempt("roblox.target.register", None);
        let label = match validate_target_label(&label) {
            Ok(value) => value,
            Err(error) => return validation_failure(attempt, error),
        };
        let universe_id = match validate_roblox_id(&universe_id) {
            Ok(value) => value,
            Err(error) => return validation_failure(attempt, error),
        };
        let root_place_id = match validate_roblox_id(&root_place_id) {
            Ok(value) => value,
            Err(error) => return validation_failure(attempt, error),
        };
        let publish_alias = match validate_credential_alias(&publish_credential_alias) {
            Ok(value) if value == PUBLISH_CREDENTIAL_ALIAS => value,
            _ => return validation_failure(attempt, AuthorityError::InvalidCredentialAlias),
        };
        let analytics_alias = match analytics_credential_alias {
            Some(alias) => match validate_credential_alias(&alias) {
                Ok(value) if value == ANALYTICS_CREDENTIAL_ALIAS => Some(value),
                _ => return validation_failure(attempt, AuthorityError::InvalidCredentialAlias),
            },
            None => None,
        };

        let publish_secret = match self.vault_get(&publish_alias).await {
            Ok(Some(secret)) => secret,
            Ok(None) => {
                return validation_failure(attempt, AuthorityError::CredentialNotConfigured)
            }
            Err(error) => return validation_failure(attempt, error),
        };
        let publish_introspection = match self.api.introspect(&publish_secret).await {
            Ok(document) => document,
            Err(failure) => {
                return http_failure_receipt(attempt, "Target verification failed", &failure)
            }
        };
        if !publish_introspection.allows(CredentialPurpose::Publish, Some(&universe_id)) {
            return attempt.failed(
                "Publishing credential is not authorized for this universe",
                vec![
                    "Update the credential resource restriction and required permissions"
                        .to_owned(),
                ],
                FailureRetrySafety::NotRetryable,
            );
        }
        if let Err(failure) = self
            .api
            .verify_place(&publish_secret, &universe_id, &root_place_id)
            .await
        {
            return http_failure_receipt(
                attempt,
                "Universe and place relationship was not verified",
                &failure,
            );
        }

        if let Some(alias) = analytics_alias.as_deref() {
            let analytics_secret = match self.vault_get(alias).await {
                Ok(Some(secret)) => secret,
                Ok(None) => {
                    return validation_failure(attempt, AuthorityError::CredentialNotConfigured)
                }
                Err(error) => return validation_failure(attempt, error),
            };
            let introspection = match self.api.introspect(&analytics_secret).await {
                Ok(document) => document,
                Err(failure) => {
                    return http_failure_receipt(
                        attempt,
                        "Analytics credential verification failed",
                        &failure,
                    )
                }
            };
            if !introspection.allows(CredentialPurpose::Analytics, Some(&universe_id)) {
                return attempt.failed(
                    "Analytics credential is not authorized for this universe",
                    vec![
                        "Update the credential resource restriction and read permission".to_owned(),
                    ],
                    FailureRetrySafety::NotRetryable,
                );
            }
        }

        let target = VerifiedRobloxTarget {
            id: Uuid::new_v4().to_string(),
            label,
            universe_id,
            root_place_id: root_place_id.clone(),
            publish_credential_alias: publish_alias,
            analytics_credential_alias: analytics_alias,
            verified_at: timestamp(),
            game_url: game_url(&root_place_id),
        };
        if let Err(error) = self.registry.add_target(target.clone()) {
            return validation_failure(attempt, error);
        }
        let evidence = SuccessEvidence::new(public_hash(&target))
            .expect("verified target produces a valid hash")
            .with_external_resource_id(&target.id)
            .expect("generated target identifier is valid");
        attempt
            .succeeded(evidence, "Target verified and registered", Vec::new())
            .with_value(value_or_empty(&target))
    }

    pub async fn publish_project(
        &self,
        project_path: String,
        target_id: String,
        name: String,
        description: String,
    ) -> OperationReceipt {
        let attempt = operation_attempt("roblox.place.publish", None);
        let display_name = match validate_display_name(&name) {
            Ok(value) => value,
            Err(error) => return validation_failure(attempt, error),
        };
        let description = match validate_description(&description) {
            Ok(value) => value,
            Err(error) => return validation_failure(attempt, error),
        };
        let target = match self.registry.find_target(&target_id) {
            Ok(target) => target,
            Err(error) => return validation_failure(attempt, error),
        };
        let publish_secret = match self.vault_get(&target.publish_credential_alias).await {
            Ok(Some(secret)) => secret,
            Ok(None) => {
                return validation_failure(attempt, AuthorityError::CredentialNotConfigured)
            }
            Err(error) => return validation_failure(attempt, error),
        };

        let project = match canonical_project_directory(&project_path).await {
            Ok(path) => path,
            Err(error) => return validation_failure(attempt, error),
        };
        let project_text = match project.to_str() {
            Some(value) => value.to_owned(),
            None => return validation_failure(attempt, AuthorityError::InvalidProjectPath),
        };
        let validation_issues = match commands::validate::validate_project(project_text.clone())
            .await
        {
            Ok(issues) => issues,
            Err(_) => return validation_failure(attempt, AuthorityError::ProjectValidationFailed),
        };
        let blocking_issues = validation_issues
            .iter()
            .filter(|issue| validation_issue_blocks(issue))
            .count();
        if blocking_issues > 0 {
            return attempt.failed(
                "Project did not pass the publish validation gate",
                vec![format!("{blocking_issues} blocking validation issue(s)")],
                FailureRetrySafety::NotRetryable,
            );
        }
        let build = match commands::build::build_project(project_text).await {
            Ok(build) => build,
            Err(_) => return validation_failure(attempt, AuthorityError::ProjectBuildFailed),
        };
        let artifact = match load_built_artifact(&project, &build.rbxl_path).await {
            Ok(artifact) => artifact,
            Err(error) => return validation_failure(attempt, error),
        };
        let artifact_hash = hash_bytes(&artifact);

        let introspection = match self.api.introspect(&publish_secret).await {
            Ok(document) => document,
            Err(failure) => {
                return http_failure_receipt(attempt, "Publish preflight failed", &failure)
            }
        };
        if !introspection.allows(CredentialPurpose::Publish, Some(&target.universe_id)) {
            return attempt.failed(
                "Publishing credential is no longer authorized for this universe",
                Vec::new(),
                FailureRetrySafety::NotRetryable,
            );
        }
        if let Err(failure) = self
            .api
            .verify_place(&publish_secret, &target.universe_id, &target.root_place_id)
            .await
        {
            return http_failure_receipt(attempt, "Publish target revalidation failed", &failure);
        }

        let upload = match self
            .api
            .publish_place(
                &publish_secret,
                &target.universe_id,
                &target.root_place_id,
                artifact,
            )
            .await
        {
            Ok(result) => result,
            Err(failure) => {
                if failure.kind == HttpFailureKind::Transport {
                    let evidence = OutcomeUnknownEvidence::new(&artifact_hash)
                        .expect("artifact hash is valid");
                    return attempt.outcome_unknown(
                        evidence,
                        "Publish outcome is unknown",
                        vec![
                            "The upload connection ended without an authoritative response"
                                .to_owned(),
                        ],
                        "Check place version history before retrying",
                    );
                }
                return http_failure_receipt(attempt, "Publish request failed", &failure);
            }
        };
        match PublishHttpDisposition::from_response(upload.status, upload.version_number) {
            PublishHttpDisposition::OutcomeUnknown => {
                let evidence =
                    OutcomeUnknownEvidence::new(&artifact_hash).expect("artifact hash is valid");
                let diagnostic = if (200..=299).contains(&upload.status) {
                    format!(
                        "Roblox returned HTTP {} without a valid authoritative version number",
                        upload.status
                    )
                } else {
                    format!("Roblox returned HTTP {}", upload.status)
                };
                return attempt.outcome_unknown(
                    evidence,
                    "Publish outcome is unknown",
                    vec![diagnostic],
                    "Check place version history before retrying",
                );
            }
            PublishHttpDisposition::Rejected => {
                return attempt.failed(
                    "Roblox rejected the place upload",
                    vec![format!("Roblox returned HTTP {}", upload.status)],
                    FailureRetrySafety::NotRetryable,
                );
            }
            PublishHttpDisposition::Succeeded => {}
        }
        let version_number = upload
            .version_number
            .expect("succeeded publish has an authoritative version number");

        let receipt_value = PublishReceiptValue {
            target_id: target.id.clone(),
            universe_id: target.universe_id.clone(),
            root_place_id: target.root_place_id.clone(),
            version_number: Some(version_number),
            game_url: target.game_url.clone(),
            upload_completed: true,
            metadata_completed: false,
        };
        let metadata = self
            .api
            .update_place_metadata(
                &publish_secret,
                &target.universe_id,
                &target.root_place_id,
                &display_name,
                &description,
            )
            .await;
        let metadata_succeeded = metadata
            .as_ref()
            .is_ok_and(|result| (200..=299).contains(&result.status));
        if !metadata_succeeded {
            let external = format!("place-version:{version_number}");
            let evidence = PartialSuccessEvidence::new(external)
                .expect("place resource identifier is valid")
                .with_artifact_hash(&artifact_hash)
                .expect("artifact hash is valid");
            let diagnostic = metadata
                .as_ref()
                .map(|result| format!("Metadata update returned HTTP {}", result.status))
                .unwrap_or_else(|failure| http_diagnostic(failure));
            return attempt
                .partial_success(
                    evidence,
                    "Place uploaded but metadata was not authoritatively confirmed",
                    vec![diagnostic],
                )
                .with_recovery_action("Inspect the place metadata before retrying only that update")
                .with_value(value_or_empty(&receipt_value));
        }

        let receipt_value = PublishReceiptValue {
            metadata_completed: true,
            ..receipt_value
        };
        let external = format!("place-version:{version_number}");
        let evidence = SuccessEvidence::new(&artifact_hash)
            .expect("artifact hash is valid")
            .with_external_resource_id(external)
            .expect("place resource identifier is valid");
        let warnings = validation_issues
            .iter()
            .filter(|issue| !validation_issue_blocks(issue))
            .count();
        let diagnostics = (warnings > 0)
            .then(|| format!("{warnings} non-blocking validation warning(s)"))
            .into_iter()
            .collect();
        attempt
            .succeeded(
                evidence,
                "Place published and metadata updated",
                diagnostics,
            )
            .with_value(value_or_empty(&receipt_value))
    }

    pub async fn query_analytics(
        &self,
        target_id: String,
        range: AnalyticsRange,
    ) -> OwnedAnalyticsResponse {
        let attempt = operation_attempt("roblox.analytics.query", None);
        if let Err(error) = range.validate() {
            return failed_analytics(attempt, &target_id, None, &range, error.to_string(), None);
        }
        let target = match self.registry.find_target(&target_id) {
            Ok(target) => target,
            Err(error) => {
                return failed_analytics(attempt, &target_id, None, &range, error.to_string(), None)
            }
        };
        let alias = match target.analytics_credential_alias.as_deref() {
            Some(alias) => alias,
            None => {
                return failed_analytics(
                    attempt,
                    &target.id,
                    Some(&target.universe_id),
                    &range,
                    AuthorityError::CredentialNotConfigured.to_string(),
                    None,
                )
            }
        };
        let secret = match self.vault_get(alias).await {
            Ok(Some(secret)) => secret,
            Ok(None) => {
                return failed_analytics(
                    attempt,
                    &target.id,
                    Some(&target.universe_id),
                    &range,
                    AuthorityError::CredentialNotConfigured.to_string(),
                    None,
                )
            }
            Err(error) => {
                return failed_analytics(
                    attempt,
                    &target.id,
                    Some(&target.universe_id),
                    &range,
                    error.to_string(),
                    None,
                )
            }
        };
        let introspection = match self.api.introspect(&secret).await {
            Ok(document) => document,
            Err(failure) => {
                return failed_analytics(
                    attempt,
                    &target.id,
                    Some(&target.universe_id),
                    &range,
                    "Credential verification failed".to_owned(),
                    Some(AnalyticsErrorView {
                        code: failure.code,
                        category: failure.category().to_owned(),
                        message: "Roblox analytics authorization could not be verified".to_owned(),
                    }),
                )
            }
        };
        if !introspection.allows(CredentialPurpose::Analytics, Some(&target.universe_id)) {
            return failed_analytics(
                attempt,
                &target.id,
                Some(&target.universe_id),
                &range,
                "Credential is not authorized for this universe".to_owned(),
                None,
            );
        }

        let mut operation = match self
            .api
            .query_analytics(&secret, &target.universe_id, &range)
            .await
        {
            Ok(operation) => operation,
            Err(failure) => {
                return failed_analytics(
                    attempt,
                    &target.id,
                    Some(&target.universe_id),
                    &range,
                    "Analytics query failed".to_owned(),
                    Some(AnalyticsErrorView {
                        code: failure.code,
                        category: failure.category().to_owned(),
                        message: "Roblox did not return analytics data".to_owned(),
                    }),
                )
            }
        };

        for poll_index in 0..ANALYTICS_POLL_ATTEMPTS {
            if operation.done {
                break;
            }
            tokio::time::sleep(Duration::from_millis(300 * (poll_index as u64 + 1))).await;
            operation = match self
                .api
                .poll_analytics(&secret, &target.universe_id, &operation.path)
                .await
            {
                Ok(operation) => operation,
                Err(failure) => {
                    return failed_analytics(
                        attempt,
                        &target.id,
                        Some(&target.universe_id),
                        &range,
                        "Analytics polling failed".to_owned(),
                        Some(AnalyticsErrorView {
                            code: failure.code,
                            category: failure.category().to_owned(),
                            message: "Roblox analytics operation could not be completed".to_owned(),
                        }),
                    )
                }
            };
        }

        let observed_at = Utc::now();
        let pending_stale_after = observed_at + ChronoDuration::minutes(15);
        if !operation.done {
            return OwnedAnalyticsResponse {
                receipt: attempt.running(
                    "Analytics query is still pending",
                    vec!["Bounded polling ended without a completed operation".to_owned()],
                ),
                target_id: target.id,
                universe_id: target.universe_id,
                metric: range.metric,
                granularity: range.granularity,
                start_time: range.start_time,
                end_time: range.end_time,
                status: AnalyticsResultStatus::Pending,
                observed_at: observed_at.to_rfc3339(),
                stale_after: pending_stale_after.to_rfc3339(),
                series: Vec::new(),
                error: None,
            };
        }
        if let Some(code) = operation.error_code {
            return failed_analytics(
                attempt,
                &target.id,
                Some(&target.universe_id),
                &range,
                "Roblox analytics operation failed".to_owned(),
                Some(AnalyticsErrorView {
                    code: Some(code),
                    category: "operation_failed".to_owned(),
                    message: "Roblox analytics operation returned an error".to_owned(),
                }),
            );
        }

        let points = operation
            .series
            .iter()
            .flat_map(|series| series.data_points.iter().cloned())
            .collect::<Vec<_>>();
        let stale = operation.created_at < observed_at - ChronoDuration::minutes(15);
        let stale_after = operation.created_at + ChronoDuration::minutes(15);
        let status = analytics_status(&points, stale);
        let evidence_payload = json!({
            "targetId": target.id,
            "universeId": target.universe_id,
            "metric": range.metric.as_wire(),
            "granularity": range.granularity.as_wire(),
            "createdAt": operation.created_at.to_rfc3339(),
            "pointCount": points.len(),
        });
        let evidence = SuccessEvidence::new(public_hash(&evidence_payload))
            .expect("analytics evidence produces a valid hash");
        let receipt = attempt
            .succeeded(evidence, "Owned analytics query completed", Vec::new())
            .with_value(json!({ "status": status, "pointCount": points.len() }));
        OwnedAnalyticsResponse {
            receipt,
            target_id: target.id,
            universe_id: target.universe_id,
            metric: range.metric,
            granularity: range.granularity,
            start_time: range.start_time,
            end_time: range.end_time,
            status,
            observed_at: observed_at.to_rfc3339(),
            stale_after: stale_after.to_rfc3339(),
            series: operation.series,
            error: None,
        }
    }
}

#[tauri::command]
pub async fn get_roblox_authority_state(
    state: State<'_, RobloxAuthority>,
) -> Result<RobloxAuthorityState, String> {
    state.state().await.map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn set_roblox_api_key(
    purpose: CredentialPurpose,
    api_key: String,
    state: State<'_, RobloxAuthority>,
) -> Result<OperationReceipt, String> {
    Ok(state.save_credential(purpose, api_key).await)
}

#[tauri::command]
pub async fn delete_roblox_api_key(
    purpose: CredentialPurpose,
    state: State<'_, RobloxAuthority>,
) -> Result<OperationReceipt, String> {
    Ok(state.delete_credential(purpose).await)
}

#[tauri::command]
pub async fn register_roblox_target(
    label: String,
    universe_id: String,
    root_place_id: String,
    publish_credential_alias: String,
    analytics_credential_alias: Option<String>,
    state: State<'_, RobloxAuthority>,
) -> Result<OperationReceipt, String> {
    Ok(state
        .register_target(
            label,
            universe_id,
            root_place_id,
            publish_credential_alias,
            analytics_credential_alias,
        )
        .await)
}

#[tauri::command]
pub async fn publish_roblox_project(
    project_path: String,
    target_id: String,
    name: String,
    description: String,
    state: State<'_, RobloxAuthority>,
) -> Result<OperationReceipt, String> {
    Ok(state
        .publish_project(project_path, target_id, name, description)
        .await)
}

#[tauri::command]
pub async fn query_owned_analytics(
    target_id: String,
    range: AnalyticsRange,
    state: State<'_, RobloxAuthority>,
) -> Result<OwnedAnalyticsResponse, String> {
    Ok(state.query_analytics(target_id, range).await)
}

fn capability(ready: bool, scopes: &[&str], setup_reason: &str) -> CapabilityDetail {
    CapabilityDetail {
        state: if ready {
            CapabilityState::Ready
        } else {
            CapabilityState::SetupRequired
        },
        ready,
        required_scopes: scopes.iter().map(|scope| (*scope).to_owned()).collect(),
        reason: if ready {
            "Desktop authority is configured".to_owned()
        } else {
            setup_reason.to_owned()
        },
    }
}

fn credential_status(
    purpose: CredentialPurpose,
    configured: bool,
    registry: &RegistryDocument,
) -> CredentialSlotStatus {
    let alias = purpose.alias().to_owned();
    let verified_at = configured.then(|| {
        registry
            .credential_metadata
            .iter()
            .find(|metadata| metadata.purpose == purpose && metadata.alias == alias)
            .map(|metadata| metadata.verified_at.clone())
    });
    CredentialSlotStatus {
        purpose,
        configured,
        alias,
        verified_at: verified_at.flatten(),
    }
}

fn operation_attempt(operation: &str, input_hash: Option<&str>) -> OperationAttempt {
    OperationAttempt::new(operation, Uuid::new_v4().to_string(), input_hash)
        .expect("fixed operation and generated correlation identifiers are valid")
}

fn validation_failure(attempt: OperationAttempt, error: AuthorityError) -> OperationReceipt {
    attempt.failed(
        "Request did not pass the authority gate",
        vec![error.to_string()],
        FailureRetrySafety::NotRetryable,
    )
}

fn http_failure_receipt(
    attempt: OperationAttempt,
    message: &str,
    failure: &HttpFailure,
) -> OperationReceipt {
    attempt.failed(
        message,
        vec![http_diagnostic(failure)],
        retry_safety_for_read(failure),
    )
}

fn retry_safety_for_read(failure: &HttpFailure) -> FailureRetrySafety {
    match (failure.kind, failure.status) {
        (HttpFailureKind::Transport, _) | (_, Some(429 | 500..=599)) => FailureRetrySafety::Safe,
        _ => FailureRetrySafety::NotRetryable,
    }
}

fn http_diagnostic(failure: &HttpFailure) -> String {
    failure
        .status
        .map(|status| format!("{} (HTTP {status})", failure.category()))
        .unwrap_or_else(|| failure.category().to_owned())
}

fn public_hash<T: serde::Serialize>(value: &T) -> String {
    let bytes = serde_json::to_vec(value).unwrap_or_default();
    hash_bytes(&bytes)
}

fn hash_bytes(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut output = String::with_capacity(71);
    output.push_str("sha256:");
    for byte in digest {
        use std::fmt::Write as _;
        let _ = write!(output, "{byte:02x}");
    }
    output
}

fn value_or_empty<T: serde::Serialize>(value: &T) -> Value {
    serde_json::to_value(value).unwrap_or_else(|_| json!({}))
}

async fn canonical_project_directory(value: &str) -> Result<PathBuf, AuthorityError> {
    if value.trim() != value || value.is_empty() {
        return Err(AuthorityError::InvalidProjectPath);
    }
    let supplied = PathBuf::from(value);
    if !supplied.is_absolute() {
        return Err(AuthorityError::InvalidProjectPath);
    }
    let canonical = tokio::fs::canonicalize(&supplied)
        .await
        .map_err(|_| AuthorityError::InvalidProjectPath)?;
    let metadata = tokio::fs::metadata(&canonical)
        .await
        .map_err(|_| AuthorityError::InvalidProjectPath)?;
    if !metadata.is_dir() {
        return Err(AuthorityError::InvalidProjectPath);
    }
    Ok(canonical)
}

async fn load_built_artifact(project: &Path, value: &str) -> Result<Vec<u8>, AuthorityError> {
    let supplied = PathBuf::from(value);
    let artifact = tokio::fs::canonicalize(&supplied)
        .await
        .map_err(|_| AuthorityError::ProjectBuildFailed)?;
    if !artifact.starts_with(project)
        || artifact
            .extension()
            .and_then(|extension| extension.to_str())
            .is_none_or(|extension| !extension.eq_ignore_ascii_case("rbxl"))
    {
        return Err(AuthorityError::ProjectBuildFailed);
    }
    let before = tokio::fs::metadata(&artifact)
        .await
        .map_err(|_| AuthorityError::ProjectBuildFailed)?;
    if !before.is_file() {
        return Err(AuthorityError::ProjectBuildFailed);
    }
    if before.len() == 0 {
        return Err(AuthorityError::EmptyPlaceArtifact);
    }
    if before.len() > MAX_PLACE_BYTES as u64 {
        return Err(AuthorityError::PlaceArtifactTooLarge);
    }
    let bytes = tokio::fs::read(&artifact)
        .await
        .map_err(|_| AuthorityError::ProjectBuildFailed)?;
    let after_path = tokio::fs::canonicalize(&supplied)
        .await
        .map_err(|_| AuthorityError::ProjectBuildFailed)?;
    let after = tokio::fs::metadata(&after_path)
        .await
        .map_err(|_| AuthorityError::ProjectBuildFailed)?;
    if after_path != artifact || before.len() != after.len() || bytes.len() as u64 != after.len() {
        return Err(AuthorityError::ProjectBuildFailed);
    }
    Ok(bytes)
}

fn validation_issue_blocks<T: serde::Serialize>(issue: &T) -> bool {
    let serialized = serde_json::to_value(issue).unwrap_or(Value::Null);
    !matches!(
        serialized.get("severity").and_then(Value::as_str),
        Some("warning" | "info")
    )
}

fn failed_analytics(
    attempt: OperationAttempt,
    target_id: &str,
    universe_id: Option<&str>,
    range: &AnalyticsRange,
    message: String,
    error: Option<AnalyticsErrorView>,
) -> OwnedAnalyticsResponse {
    let observed_at = Utc::now();
    let receipt = attempt.failed(
        "Owned analytics query failed",
        vec![message],
        FailureRetrySafety::NotRetryable,
    );
    OwnedAnalyticsResponse {
        receipt,
        target_id: target_id.to_owned(),
        universe_id: universe_id.unwrap_or_default().to_owned(),
        metric: range.metric,
        granularity: range.granularity,
        start_time: range.start_time.clone(),
        end_time: range.end_time.clone(),
        status: AnalyticsResultStatus::Failed,
        observed_at: observed_at.to_rfc3339(),
        stale_after: observed_at.to_rfc3339(),
        series: Vec::new(),
        error,
    }
}
