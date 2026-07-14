use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use thiserror::Error;
use uuid::Uuid;

pub const MAX_DIAGNOSTICS: usize = 8;
pub const MAX_DIAGNOSTIC_LENGTH: usize = 256;
pub const MAX_MESSAGE_LENGTH: usize = 256;
pub const MAX_RECOVERY_ACTION_LENGTH: usize = 256;
pub const MAX_OPERATION_LENGTH: usize = 64;
pub const MAX_CORRELATION_ID_LENGTH: usize = 128;
pub const MAX_EXTERNAL_RESOURCE_ID_LENGTH: usize = 128;
pub const MAX_VALUE_DEPTH: usize = 4;
pub const MAX_VALUE_OBJECT_ENTRIES: usize = 16;
pub const MAX_VALUE_ARRAY_ITEMS: usize = 16;
pub const MAX_VALUE_KEY_LENGTH: usize = 64;
pub const MAX_VALUE_STRING_LENGTH: usize = 256;

const REDACTED_TEXT: &str = "[REDACTED]";
const TRUNCATED_VALUE: &str = "[TRUNCATED]";

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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FailureRetrySafety {
    Safe,
    NotRetryable,
}

impl From<FailureRetrySafety> for RetrySafety {
    fn from(value: FailureRetrySafety) -> Self {
        match value {
            FailureRetrySafety::Safe => RetrySafety::Safe,
            FailureRetrySafety::NotRetryable => RetrySafety::NotRetryable,
        }
    }
}

#[derive(Debug, Clone, Copy, Error, PartialEq, Eq)]
pub enum ReceiptValidationError {
    #[error("operation identifier is invalid")]
    InvalidOperation,
    #[error("correlation identifier is invalid")]
    InvalidCorrelationId,
    #[error("external resource identifier is invalid")]
    InvalidExternalResourceId,
    #[error("input hash is invalid")]
    InvalidInputHash,
    #[error("artifact hash is invalid")]
    InvalidArtifactHash,
}

#[derive(Debug)]
pub struct OperationAttempt {
    operation_id: String,
    correlation_id: String,
    operation: String,
    started_at: String,
    input_hash: Option<String>,
}

#[derive(Debug)]
pub struct SuccessEvidence {
    artifact_hash: String,
    external_resource_id: Option<String>,
}

impl SuccessEvidence {
    pub fn new(artifact_hash: impl AsRef<str>) -> Result<Self, ReceiptValidationError> {
        Ok(Self {
            artifact_hash: validate_hash(
                artifact_hash.as_ref(),
                ReceiptValidationError::InvalidArtifactHash,
            )?,
            external_resource_id: None,
        })
    }

    pub fn with_external_resource_id(
        mut self,
        external_resource_id: impl AsRef<str>,
    ) -> Result<Self, ReceiptValidationError> {
        self.external_resource_id = Some(validate_identifier(
            external_resource_id.as_ref(),
            MAX_EXTERNAL_RESOURCE_ID_LENGTH,
            ReceiptValidationError::InvalidExternalResourceId,
        )?);
        Ok(self)
    }
}

#[derive(Debug)]
pub struct PartialSuccessEvidence {
    external_resource_id: String,
    artifact_hash: Option<String>,
}

impl PartialSuccessEvidence {
    pub fn new(external_resource_id: impl AsRef<str>) -> Result<Self, ReceiptValidationError> {
        Ok(Self {
            external_resource_id: validate_identifier(
                external_resource_id.as_ref(),
                MAX_EXTERNAL_RESOURCE_ID_LENGTH,
                ReceiptValidationError::InvalidExternalResourceId,
            )?,
            artifact_hash: None,
        })
    }

    pub fn with_artifact_hash(
        mut self,
        artifact_hash: impl AsRef<str>,
    ) -> Result<Self, ReceiptValidationError> {
        self.artifact_hash = Some(validate_hash(
            artifact_hash.as_ref(),
            ReceiptValidationError::InvalidArtifactHash,
        )?);
        Ok(self)
    }
}

/// A Rust-issued record of one privileged operation.
///
/// Callers cannot mutate authority-bearing fields after construction:
///
/// ```compile_fail
/// use roblox_forge_lib::platform::receipt::OperationAttempt;
///
/// let attempt = OperationAttempt::new("build", "correlation-1", None).unwrap();
/// let mut receipt = attempt.simulated("Browser preview", Vec::<String>::new());
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
///
/// Authority cannot be created without an operation attempt and typed evidence:
///
/// ```compile_fail
/// use roblox_forge_lib::platform::receipt::{OperationReceipt, RetrySafety};
///
/// let _receipt = OperationReceipt::succeeded(
///     "publish",
///     "correlation-1",
///     "Published",
///     Vec::<String>::new(),
///     RetrySafety::Safe,
/// );
/// ```
///
/// Output evidence cannot be attached to a failed receipt after construction:
///
/// ```compile_fail
/// use roblox_forge_lib::platform::receipt::{FailureRetrySafety, OperationAttempt};
///
/// let attempt = OperationAttempt::new("publish", "correlation-1", None).unwrap();
/// let receipt = attempt.failed(
///     "Failed",
///     Vec::<String>::new(),
///     FailureRetrySafety::NotRetryable,
/// );
/// let _receipt = receipt.with_artifact_hash(
///     "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
/// );
/// ```
///
/// External resources cannot be attached through a generic receipt builder:
///
/// ```compile_fail
/// use roblox_forge_lib::platform::receipt::OperationAttempt;
///
/// let attempt = OperationAttempt::new("publish", "correlation-1", None).unwrap();
/// let receipt = attempt.simulated("Preview", Vec::<String>::new());
/// let _receipt = receipt.with_external_resource_id("place-version:42");
/// ```
///
/// A terminal result consumes its attempt, so the same operation cannot emit a
/// conflicting terminal result or return to a running state:
///
/// ```compile_fail
/// use roblox_forge_lib::platform::receipt::{FailureRetrySafety, OperationAttempt};
///
/// let attempt = OperationAttempt::new("publish", "correlation-1", None).unwrap();
/// let _failed = attempt.failed(
///     "Publish failed",
///     Vec::<String>::new(),
///     FailureRetrySafety::NotRetryable,
/// );
/// let _running_after_terminal = attempt.running("Running again", Vec::<String>::new());
/// ```
///
/// Attempts cannot be cloned to bypass terminal ownership:
///
/// ```compile_fail
/// use roblox_forge_lib::platform::receipt::OperationAttempt;
///
/// let attempt = OperationAttempt::new("publish", "correlation-1", None).unwrap();
/// let _duplicate = attempt.clone();
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
    pub fn with_recovery_action(mut self, recovery_action: impl AsRef<str>) -> Self {
        self.recovery_action = Some(sanitize_text(
            recovery_action.as_ref(),
            MAX_RECOVERY_ACTION_LENGTH,
        ));
        self
    }

    #[must_use]
    pub fn with_value(mut self, value: Value) -> Self {
        self.value = Some(sanitize_value(value, 0));
        self
    }
}

impl OperationAttempt {
    pub fn new(
        operation: impl AsRef<str>,
        correlation_id: impl AsRef<str>,
        input_hash: Option<&str>,
    ) -> Result<Self, ReceiptValidationError> {
        Ok(Self {
            operation_id: Uuid::new_v4().to_string(),
            correlation_id: validate_identifier(
                correlation_id.as_ref(),
                MAX_CORRELATION_ID_LENGTH,
                ReceiptValidationError::InvalidCorrelationId,
            )?,
            operation: validate_identifier(
                operation.as_ref(),
                MAX_OPERATION_LENGTH,
                ReceiptValidationError::InvalidOperation,
            )?,
            started_at: timestamp(),
            input_hash: input_hash
                .map(|hash| validate_hash(hash, ReceiptValidationError::InvalidInputHash))
                .transpose()?,
        })
    }

    pub fn queued(&self, message: impl AsRef<str>, diagnostics: Vec<String>) -> OperationReceipt {
        self.receipt(
            OperationState::Queued,
            false,
            true,
            message,
            diagnostics,
            RetrySafety::Safe,
            None,
            None,
        )
    }

    pub fn running(&self, message: impl AsRef<str>, diagnostics: Vec<String>) -> OperationReceipt {
        self.receipt(
            OperationState::Running,
            false,
            true,
            message,
            diagnostics,
            RetrySafety::Safe,
            None,
            None,
        )
    }

    pub fn succeeded(
        self,
        evidence: SuccessEvidence,
        message: impl AsRef<str>,
        diagnostics: Vec<String>,
    ) -> OperationReceipt {
        self.receipt(
            OperationState::Succeeded,
            true,
            true,
            message,
            diagnostics,
            RetrySafety::Safe,
            Some(evidence.artifact_hash),
            evidence.external_resource_id,
        )
    }

    pub fn failed(
        self,
        message: impl AsRef<str>,
        diagnostics: Vec<String>,
        retry_safety: FailureRetrySafety,
    ) -> OperationReceipt {
        self.receipt(
            OperationState::Failed,
            true,
            true,
            message,
            diagnostics,
            retry_safety.into(),
            None,
            None,
        )
    }

    pub fn cancelled(self, message: impl AsRef<str>, diagnostics: Vec<String>) -> OperationReceipt {
        self.receipt(
            OperationState::Cancelled,
            true,
            true,
            message,
            diagnostics,
            RetrySafety::NotRetryable,
            None,
            None,
        )
    }

    pub fn partial_success(
        self,
        evidence: PartialSuccessEvidence,
        message: impl AsRef<str>,
        diagnostics: Vec<String>,
    ) -> OperationReceipt {
        self.receipt(
            OperationState::PartialSuccess,
            true,
            true,
            message,
            diagnostics,
            RetrySafety::UnsafeWithoutReconciliation,
            evidence.artifact_hash,
            Some(evidence.external_resource_id),
        )
    }

    pub fn unavailable(
        self,
        message: impl AsRef<str>,
        diagnostics: Vec<String>,
    ) -> OperationReceipt {
        self.receipt(
            OperationState::Unavailable,
            true,
            false,
            message,
            diagnostics,
            RetrySafety::NotRetryable,
            None,
            None,
        )
    }

    pub fn simulated(self, message: impl AsRef<str>, diagnostics: Vec<String>) -> OperationReceipt {
        self.receipt(
            OperationState::Simulated,
            true,
            false,
            message,
            diagnostics,
            RetrySafety::NotRetryable,
            None,
            None,
        )
    }

    #[allow(clippy::too_many_arguments)]
    fn receipt(
        &self,
        state: OperationState,
        terminal: bool,
        include_input_hash: bool,
        message: impl AsRef<str>,
        diagnostics: Vec<String>,
        retry_safety: RetrySafety,
        artifact_hash: Option<String>,
        external_resource_id: Option<String>,
    ) -> OperationReceipt {
        OperationReceipt {
            operation_id: self.operation_id.clone(),
            correlation_id: self.correlation_id.clone(),
            operation: self.operation.clone(),
            state,
            authoritative: state == OperationState::Succeeded,
            started_at: self.started_at.clone(),
            finished_at: terminal.then(timestamp),
            input_hash: include_input_hash
                .then(|| self.input_hash.clone())
                .flatten(),
            artifact_hash,
            external_resource_id,
            message: sanitize_text(message.as_ref(), MAX_MESSAGE_LENGTH),
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

fn validate_identifier(
    value: &str,
    max_length: usize,
    error: ReceiptValidationError,
) -> Result<String, ReceiptValidationError> {
    let valid = !value.is_empty()
        && value.trim() == value
        && value.chars().count() <= max_length
        && !is_unsafe_text(value)
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "._:-".contains(character));

    valid.then(|| value.to_owned()).ok_or(error)
}

fn validate_hash(
    value: &str,
    error: ReceiptValidationError,
) -> Result<String, ReceiptValidationError> {
    let valid = value.strip_prefix("sha256:").is_some_and(|digest| {
        digest.len() == 64
            && digest
                .bytes()
                .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    });

    valid.then(|| value.to_owned()).ok_or(error)
}

fn sanitize_text(value: &str, max_length: usize) -> String {
    let trimmed = value.trim();
    if is_unsafe_text(trimmed) {
        REDACTED_TEXT.to_owned()
    } else {
        trimmed.chars().take(max_length).collect()
    }
}

fn sanitize_diagnostics(diagnostics: Vec<String>) -> Vec<String> {
    diagnostics
        .into_iter()
        .filter_map(|diagnostic| {
            let trimmed = diagnostic.trim();
            if trimmed.is_empty() {
                return None;
            }
            Some(sanitize_text(trimmed, MAX_DIAGNOSTIC_LENGTH))
        })
        .take(MAX_DIAGNOSTICS)
        .collect()
}

fn sanitize_value(value: Value, depth: usize) -> Value {
    if depth >= MAX_VALUE_DEPTH {
        return Value::String(TRUNCATED_VALUE.to_owned());
    }

    match value {
        Value::String(text) => Value::String(sanitize_text(&text, MAX_VALUE_STRING_LENGTH)),
        Value::Array(items) => Value::Array(
            items
                .into_iter()
                .take(MAX_VALUE_ARRAY_ITEMS)
                .map(|item| sanitize_value(item, depth + 1))
                .collect(),
        ),
        Value::Object(object) => {
            let mut sanitized = Map::new();
            for (index, (key, item)) in object
                .into_iter()
                .take(MAX_VALUE_OBJECT_ENTRIES)
                .enumerate()
            {
                let mut safe_key = sanitize_text(&key, MAX_VALUE_KEY_LENGTH);
                if sanitized.contains_key(&safe_key) {
                    safe_key = format!("{}#{index}", safe_key);
                    safe_key = safe_key.chars().take(MAX_VALUE_KEY_LENGTH).collect();
                }
                sanitized.insert(safe_key, sanitize_value(item, depth + 1));
            }
            Value::Object(sanitized)
        }
        scalar => scalar,
    }
}

fn is_unsafe_text(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    let secret_or_body = [
        ".roblosecurity",
        "cookie:",
        "x-api-key",
        "authorization",
        "bearer ",
        "api_key",
        "api key",
        "password",
        "secret",
        "token",
        "response body",
        "response_body",
        "sk-",
        "sk_live_",
        "sk_test_",
        "sk-or-",
        "pk_live_",
    ]
    .iter()
    .any(|marker| lower.contains(marker));

    secret_or_body
        || contains_resend_credential(&lower)
        || contains_absolute_host_path(value, &lower)
}

fn contains_resend_credential(lower: &str) -> bool {
    let bytes = lower.as_bytes();
    lower.match_indices("re_").any(|(index, _)| {
        let has_token_boundary =
            index == 0 || (!bytes[index - 1].is_ascii_alphanumeric() && bytes[index - 1] != b'_');
        let credential_length = bytes[index + 3..]
            .iter()
            .take_while(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
            .count();

        has_token_boundary && credential_length >= 8
    })
}

fn contains_absolute_host_path(value: &str, lower: &str) -> bool {
    let bytes = value.as_bytes();
    let windows_drive = bytes.windows(3).any(|window| {
        window[0].is_ascii_alphabetic() && window[1] == b':' && matches!(window[2], b'\\' | b'/')
    });
    let windows_unc = value.contains("\\\\");
    let unix_host_path = [
        "/root/",
        "/users/",
        "/home/",
        "/workspace/",
        "/etc/",
        "/var/",
        "/tmp/",
    ]
    .iter()
    .any(|prefix| lower.contains(prefix));

    windows_drive || windows_unc || unix_host_path
}
