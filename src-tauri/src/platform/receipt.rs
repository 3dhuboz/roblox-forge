use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

pub const MAX_DIAGNOSTICS: usize = 8;
pub const MAX_DIAGNOSTIC_LENGTH: usize = 256;

const REDACTED_DIAGNOSTIC: &str = "[REDACTED: unsafe diagnostic]";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OperationState {
    Queued,
    Running,
    Succeeded,
    Failed,
    Cancelled,
    PartialSuccess,
    Unavailable,
    Simulated,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RetrySafety {
    Safe,
    UnsafeWithoutReconciliation,
    NotRetryable,
}

/// A Rust-issued record of one privileged operation.
///
/// Callers cannot mutate authority-bearing fields after construction:
///
/// ```compile_fail
/// use roblox_forge_lib::platform::receipt::OperationReceipt;
///
/// let mut receipt = OperationReceipt::simulated(
///     "build",
///     "correlation-1",
///     "Browser preview",
///     Vec::<String>::new(),
/// );
/// receipt.authoritative = true;
/// ```
///
/// Callers also cannot construct a receipt literal:
///
/// ```compile_fail
/// use roblox_forge_lib::platform::receipt::{OperationReceipt, OperationState, RetrySafety};
///
/// let _receipt = OperationReceipt {
///     operation_id: String::new(),
///     correlation_id: String::new(),
///     operation: String::new(),
///     state: OperationState::Succeeded,
///     authoritative: true,
///     started_at: String::new(),
///     finished_at: None,
///     input_hash: None,
///     artifact_hash: None,
///     external_resource_id: None,
///     message: String::new(),
///     diagnostics: Vec::new(),
///     retry_safety: RetrySafety::Safe,
///     recovery_action: None,
///     value: None,
/// };
/// ```
///
/// Receipts cannot be manufactured by deserializing untrusted JSON:
///
/// ```compile_fail
/// use roblox_forge_lib::platform::receipt::OperationReceipt;
///
/// let _receipt: OperationReceipt = serde_json::from_str("{}").unwrap();
/// ```
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OperationReceipt {
    operation_id: String,
    correlation_id: String,
    operation: String,
    state: OperationState,
    authoritative: bool,
    started_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    finished_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    input_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    artifact_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    external_resource_id: Option<String>,
    message: String,
    diagnostics: Vec<String>,
    retry_safety: RetrySafety,
    #[serde(skip_serializing_if = "Option::is_none")]
    recovery_action: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    value: Option<Value>,
}

impl OperationReceipt {
    pub fn queued(
        operation: impl Into<String>,
        correlation_id: impl Into<String>,
        message: impl Into<String>,
        diagnostics: Vec<String>,
        retry_safety: RetrySafety,
    ) -> Self {
        Self::new(
            operation,
            correlation_id,
            OperationState::Queued,
            false,
            false,
            message,
            diagnostics,
            retry_safety,
        )
    }

    pub fn running(
        operation: impl Into<String>,
        correlation_id: impl Into<String>,
        message: impl Into<String>,
        diagnostics: Vec<String>,
        retry_safety: RetrySafety,
    ) -> Self {
        Self::new(
            operation,
            correlation_id,
            OperationState::Running,
            false,
            false,
            message,
            diagnostics,
            retry_safety,
        )
    }

    pub fn succeeded(
        operation: impl Into<String>,
        correlation_id: impl Into<String>,
        message: impl Into<String>,
        diagnostics: Vec<String>,
        retry_safety: RetrySafety,
    ) -> Self {
        Self::new(
            operation,
            correlation_id,
            OperationState::Succeeded,
            true,
            true,
            message,
            diagnostics,
            retry_safety,
        )
    }

    pub fn failed(
        operation: impl Into<String>,
        correlation_id: impl Into<String>,
        message: impl Into<String>,
        diagnostics: Vec<String>,
        retry_safety: RetrySafety,
    ) -> Self {
        Self::new(
            operation,
            correlation_id,
            OperationState::Failed,
            false,
            true,
            message,
            diagnostics,
            retry_safety,
        )
    }

    pub fn cancelled(
        operation: impl Into<String>,
        correlation_id: impl Into<String>,
        message: impl Into<String>,
        diagnostics: Vec<String>,
        retry_safety: RetrySafety,
    ) -> Self {
        Self::new(
            operation,
            correlation_id,
            OperationState::Cancelled,
            false,
            true,
            message,
            diagnostics,
            retry_safety,
        )
    }

    pub fn partial_success(
        operation: impl Into<String>,
        correlation_id: impl Into<String>,
        message: impl Into<String>,
        external_resource_id: impl Into<String>,
        diagnostics: Vec<String>,
    ) -> Self {
        let mut receipt = Self::new(
            operation,
            correlation_id,
            OperationState::PartialSuccess,
            false,
            true,
            message,
            diagnostics,
            RetrySafety::UnsafeWithoutReconciliation,
        );
        receipt.external_resource_id = Some(external_resource_id.into());
        receipt
    }

    pub fn unavailable(
        operation: impl Into<String>,
        correlation_id: impl Into<String>,
        message: impl Into<String>,
        diagnostics: Vec<String>,
        retry_safety: RetrySafety,
    ) -> Self {
        Self::new(
            operation,
            correlation_id,
            OperationState::Unavailable,
            false,
            true,
            message,
            diagnostics,
            retry_safety,
        )
    }

    pub fn simulated(
        operation: impl Into<String>,
        correlation_id: impl Into<String>,
        message: impl Into<String>,
        diagnostics: Vec<String>,
    ) -> Self {
        Self::new(
            operation,
            correlation_id,
            OperationState::Simulated,
            false,
            true,
            message,
            diagnostics,
            RetrySafety::NotRetryable,
        )
    }

    pub fn is_authoritative_success(&self) -> bool {
        self.authoritative && self.state == OperationState::Succeeded
    }

    pub fn operation_id(&self) -> &str {
        &self.operation_id
    }

    pub fn correlation_id(&self) -> &str {
        &self.correlation_id
    }

    pub fn operation(&self) -> &str {
        &self.operation
    }

    pub fn state(&self) -> OperationState {
        self.state
    }

    pub fn authoritative(&self) -> bool {
        self.authoritative
    }

    pub fn started_at(&self) -> &str {
        &self.started_at
    }

    pub fn finished_at(&self) -> Option<&str> {
        self.finished_at.as_deref()
    }

    pub fn input_hash(&self) -> Option<&str> {
        self.input_hash.as_deref()
    }

    pub fn artifact_hash(&self) -> Option<&str> {
        self.artifact_hash.as_deref()
    }

    pub fn external_resource_id(&self) -> Option<&str> {
        self.external_resource_id.as_deref()
    }

    pub fn message(&self) -> &str {
        &self.message
    }

    pub fn diagnostics(&self) -> &[String] {
        &self.diagnostics
    }

    pub fn retry_safety(&self) -> RetrySafety {
        self.retry_safety
    }

    pub fn recovery_action(&self) -> Option<&str> {
        self.recovery_action.as_deref()
    }

    pub fn value(&self) -> Option<&Value> {
        self.value.as_ref()
    }

    #[must_use]
    pub fn with_input_hash(mut self, input_hash: impl Into<String>) -> Self {
        self.input_hash = Some(input_hash.into());
        self
    }

    #[must_use]
    pub fn with_artifact_hash(mut self, artifact_hash: impl Into<String>) -> Self {
        self.artifact_hash = Some(artifact_hash.into());
        self
    }

    #[must_use]
    pub fn with_external_resource_id(mut self, external_resource_id: impl Into<String>) -> Self {
        self.external_resource_id = Some(external_resource_id.into());
        self
    }

    #[must_use]
    pub fn with_recovery_action(mut self, recovery_action: impl Into<String>) -> Self {
        self.recovery_action = Some(recovery_action.into());
        self
    }

    #[must_use]
    pub fn with_value(mut self, value: Value) -> Self {
        self.value = Some(value);
        self
    }

    #[allow(clippy::too_many_arguments)]
    fn new(
        operation: impl Into<String>,
        correlation_id: impl Into<String>,
        state: OperationState,
        authoritative: bool,
        terminal: bool,
        message: impl Into<String>,
        diagnostics: Vec<String>,
        retry_safety: RetrySafety,
    ) -> Self {
        debug_assert_eq!(authoritative, state == OperationState::Succeeded);

        let started_at = timestamp();
        Self {
            operation_id: Uuid::new_v4().to_string(),
            correlation_id: correlation_id.into(),
            operation: operation.into(),
            state,
            authoritative,
            started_at: started_at.clone(),
            finished_at: terminal.then_some(started_at),
            input_hash: None,
            artifact_hash: None,
            external_resource_id: None,
            message: message.into(),
            diagnostics: sanitize_diagnostics(diagnostics),
            retry_safety,
            recovery_action: None,
            value: None,
        }
    }
}

fn timestamp() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn sanitize_diagnostics(diagnostics: Vec<String>) -> Vec<String> {
    diagnostics
        .into_iter()
        .filter_map(|diagnostic| {
            let trimmed = diagnostic.trim();
            if trimmed.is_empty() {
                return None;
            }

            let safe = if is_unsafe_diagnostic(trimmed) {
                REDACTED_DIAGNOSTIC.to_owned()
            } else {
                trimmed.chars().take(MAX_DIAGNOSTIC_LENGTH).collect()
            };
            Some(safe)
        })
        .take(MAX_DIAGNOSTICS)
        .collect()
}

fn is_unsafe_diagnostic(diagnostic: &str) -> bool {
    let lower = diagnostic.to_ascii_lowercase();
    let secret_or_body = [
        "authorization",
        "bearer ",
        "api_key",
        "api key",
        "password",
        "secret",
        "token",
        "response body",
        "response_body",
        "sk-or-",
    ]
    .iter()
    .any(|marker| lower.contains(marker));

    secret_or_body || contains_absolute_host_path(diagnostic, &lower)
}

fn contains_absolute_host_path(diagnostic: &str, lower: &str) -> bool {
    let bytes = diagnostic.as_bytes();
    let windows_drive = bytes.windows(3).any(|window| {
        window[0].is_ascii_alphabetic() && window[1] == b':' && matches!(window[2], b'\\' | b'/')
    });
    let windows_unc = diagnostic.contains("\\\\");
    let unix_host_path = ["/users/", "/home/", "/etc/", "/var/", "/tmp/"]
        .iter()
        .any(|prefix| lower.contains(prefix));

    windows_drive || windows_unc || unix_host_path
}
