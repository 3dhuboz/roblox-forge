use chrono::DateTime;
use roblox_forge_lib::platform::receipt::{
    OperationReceipt, OperationState, RetrySafety, MAX_DIAGNOSTICS, MAX_DIAGNOSTIC_LENGTH,
};
use serde_json::json;
use uuid::{Uuid, Version};

const CORRELATION_ID: &str = "create-flow-1";

fn safe_diagnostics() -> Vec<String> {
    vec!["Rojo exited with status 1".to_owned()]
}

#[test]
fn simulated_receipt_is_never_authoritative() {
    let receipt = OperationReceipt::simulated(
        "build",
        CORRELATION_ID,
        "Browser preview only",
        Vec::<String>::new(),
    );

    assert_eq!(receipt.state(), OperationState::Simulated);
    assert!(!receipt.authoritative());
    assert!(!receipt.is_authoritative_success());
}

#[test]
fn succeeded_constructor_is_the_only_authoritative_gate() {
    let success = OperationReceipt::succeeded(
        "build",
        CORRELATION_ID,
        "Build complete",
        Vec::<String>::new(),
        RetrySafety::Safe,
    );
    assert!(success.is_authoritative_success());
}

#[test]
fn constructors_derive_safe_authority_for_every_state() {
    let receipts = [
        OperationReceipt::queued(
            "build",
            CORRELATION_ID,
            "Queued",
            Vec::<String>::new(),
            RetrySafety::Safe,
        ),
        OperationReceipt::running(
            "build",
            CORRELATION_ID,
            "Running",
            Vec::<String>::new(),
            RetrySafety::Safe,
        ),
        OperationReceipt::failed(
            "build",
            CORRELATION_ID,
            "Failed",
            Vec::<String>::new(),
            RetrySafety::Safe,
        ),
        OperationReceipt::cancelled(
            "build",
            CORRELATION_ID,
            "Cancelled",
            Vec::<String>::new(),
            RetrySafety::Safe,
        ),
        OperationReceipt::partial_success(
            "publish",
            CORRELATION_ID,
            "Upload complete; metadata failed",
            "place-version:42",
            Vec::<String>::new(),
        ),
        OperationReceipt::unavailable(
            "publish",
            CORRELATION_ID,
            "Desktop runtime unavailable",
            Vec::<String>::new(),
            RetrySafety::Safe,
        ),
        OperationReceipt::simulated(
            "build",
            CORRELATION_ID,
            "Browser preview only",
            Vec::<String>::new(),
        ),
    ];

    for receipt in receipts {
        assert!(
            !receipt.authoritative(),
            "{:?} must not be authoritative",
            receipt.state()
        );
        assert!(!receipt.is_authoritative_success());
    }
}

#[test]
fn partial_success_is_non_authoritative_and_requires_reconciliation() {
    let receipt = OperationReceipt::partial_success(
        "publish",
        CORRELATION_ID,
        "Version upload succeeded; metadata update failed",
        "place-version:42",
        safe_diagnostics(),
    );

    assert_eq!(receipt.state(), OperationState::PartialSuccess);
    assert!(!receipt.authoritative());
    assert_eq!(receipt.external_resource_id(), Some("place-version:42"));
    assert_eq!(
        receipt.retry_safety(),
        RetrySafety::UnsafeWithoutReconciliation
    );
    assert!(!receipt.is_authoritative_success());
}

#[test]
fn operation_ids_are_distinct_uuid_v4_and_correlation_ids_can_be_shared() {
    let first = OperationReceipt::queued(
        "build",
        CORRELATION_ID,
        "Queued build",
        Vec::<String>::new(),
        RetrySafety::Safe,
    );
    let second = OperationReceipt::running(
        "studio_test",
        CORRELATION_ID,
        "Running Studio proof",
        Vec::<String>::new(),
        RetrySafety::Safe,
    );

    let first_id = Uuid::parse_str(first.operation_id()).expect("operation ID must be a UUID");
    let second_id = Uuid::parse_str(second.operation_id()).expect("operation ID must be a UUID");
    assert_eq!(first_id.get_version(), Some(Version::Random));
    assert_eq!(second_id.get_version(), Some(Version::Random));
    assert_ne!(first.operation_id(), second.operation_id());
    assert_eq!(first.correlation_id(), CORRELATION_ID);
    assert_eq!(second.correlation_id(), CORRELATION_ID);
}

#[test]
fn queued_and_running_omit_finished_at_while_terminal_receipts_use_rfc3339() {
    let queued = OperationReceipt::queued(
        "build",
        CORRELATION_ID,
        "Queued",
        Vec::<String>::new(),
        RetrySafety::Safe,
    );
    let running = OperationReceipt::running(
        "build",
        CORRELATION_ID,
        "Running",
        Vec::<String>::new(),
        RetrySafety::Safe,
    );
    let failed = OperationReceipt::failed(
        "build",
        CORRELATION_ID,
        "Failed",
        Vec::<String>::new(),
        RetrySafety::Safe,
    );

    assert!(queued.finished_at().is_none());
    assert!(running.finished_at().is_none());
    assert!(!serde_json::to_value(&queued)
        .unwrap()
        .as_object()
        .unwrap()
        .contains_key("finishedAt"));
    assert!(!serde_json::to_value(&running)
        .unwrap()
        .as_object()
        .unwrap()
        .contains_key("finishedAt"));

    DateTime::parse_from_rfc3339(queued.started_at()).expect("startedAt must be RFC3339");
    let finished_at = failed
        .finished_at()
        .expect("terminal receipt must have finishedAt");
    DateTime::parse_from_rfc3339(finished_at).expect("finishedAt must be RFC3339");
}

#[test]
fn rust_json_uses_camel_case_snake_case_enums_and_omits_optional_fields() {
    let receipt = OperationReceipt::queued(
        "build",
        CORRELATION_ID,
        "Queued",
        Vec::<String>::new(),
        RetrySafety::NotRetryable,
    );
    let json = serde_json::to_value(receipt).unwrap();
    let object = json.as_object().unwrap();

    assert!(object.contains_key("operationId"));
    assert!(object.contains_key("correlationId"));
    assert!(object.contains_key("startedAt"));
    assert_eq!(object.get("state"), Some(&json!("queued")));
    assert_eq!(object.get("retrySafety"), Some(&json!("not_retryable")));
    for optional in [
        "finishedAt",
        "inputHash",
        "artifactHash",
        "externalResourceId",
        "recoveryAction",
        "value",
    ] {
        assert!(!object.contains_key(optional), "{optional} must be omitted");
    }
}

#[test]
fn diagnostics_are_deterministically_bounded_and_pre_redacted() {
    let mut diagnostics = vec![
        "safe diagnostic".to_owned(),
        "Authorization: Bearer bearer-sentinel".to_owned(),
        "api_key=sk-or-v1-api-sentinel".to_owned(),
        r"C:\Users\Steve\secret-project\.env".to_owned(),
        "/home/steve/secret-project/.env".to_owned(),
        "response body: {\"token\":\"body-sentinel\"}".to_owned(),
        "x".repeat(MAX_DIAGNOSTIC_LENGTH + 40),
    ];
    diagnostics.extend((0..MAX_DIAGNOSTICS + 4).map(|index| format!("bounded-{index}")));

    let first = OperationReceipt::failed(
        "publish",
        CORRELATION_ID,
        "Publish failed",
        diagnostics.clone(),
        RetrySafety::NotRetryable,
    );
    let second = OperationReceipt::failed(
        "publish",
        CORRELATION_ID,
        "Publish failed",
        diagnostics,
        RetrySafety::NotRetryable,
    );

    assert_eq!(first.diagnostics(), second.diagnostics());
    assert!(first.diagnostics().len() <= MAX_DIAGNOSTICS);
    assert!(first
        .diagnostics()
        .iter()
        .all(|diagnostic| diagnostic.chars().count() <= MAX_DIAGNOSTIC_LENGTH));

    let serialized = serde_json::to_string(first.diagnostics()).unwrap();
    for forbidden in [
        "bearer-sentinel",
        "api-sentinel",
        "C:\\\\Users",
        "/home/steve",
        "body-sentinel",
    ] {
        assert!(!serialized.contains(forbidden), "leaked {forbidden}");
    }
}

#[test]
fn value_is_data_and_never_grants_authority() {
    let expected = json!({ "claimedSuccess": true, "visits": 1_000_000 });
    let receipt = OperationReceipt::simulated(
        "analytics",
        CORRELATION_ID,
        "Browser preview only",
        Vec::<String>::new(),
    )
    .with_value(expected.clone());

    assert_eq!(receipt.value(), Some(&expected));
    assert!(!receipt.is_authoritative_success());
}

#[test]
fn consuming_builders_preserve_non_authoritative_core_fields() {
    let receipt = OperationReceipt::simulated(
        "build",
        CORRELATION_ID,
        "Browser preview only",
        Vec::<String>::new(),
    );
    let operation_id = receipt.operation_id().to_owned();
    let started_at = receipt.started_at().to_owned();
    let finished_at = receipt.finished_at().map(str::to_owned);

    let receipt = receipt
        .with_input_hash("input-hash")
        .with_artifact_hash("artifact-hash")
        .with_external_resource_id("preview:1")
        .with_recovery_action("Run in the desktop app")
        .with_value(json!({ "preview": true }));

    assert_eq!(receipt.operation_id(), operation_id);
    assert_eq!(receipt.correlation_id(), CORRELATION_ID);
    assert_eq!(receipt.operation(), "build");
    assert_eq!(receipt.state(), OperationState::Simulated);
    assert!(!receipt.authoritative());
    assert_eq!(receipt.started_at(), started_at);
    assert_eq!(receipt.finished_at(), finished_at.as_deref());
    assert_eq!(receipt.input_hash(), Some("input-hash"));
    assert_eq!(receipt.artifact_hash(), Some("artifact-hash"));
    assert_eq!(receipt.external_resource_id(), Some("preview:1"));
    assert_eq!(receipt.recovery_action(), Some("Run in the desktop app"));
    assert_eq!(receipt.value(), Some(&json!({ "preview": true })));
    assert!(!receipt.is_authoritative_success());
}

#[test]
fn consuming_builders_preserve_authoritative_success() {
    let receipt = OperationReceipt::succeeded(
        "publish",
        CORRELATION_ID,
        "Published",
        Vec::<String>::new(),
        RetrySafety::Safe,
    )
    .with_input_hash("input-hash")
    .with_artifact_hash("artifact-hash")
    .with_external_resource_id("place-version:42")
    .with_recovery_action("Open Creator Dashboard")
    .with_value(json!({ "placeVersion": 42 }));

    assert_eq!(receipt.state(), OperationState::Succeeded);
    assert!(receipt.authoritative());
    assert!(receipt.is_authoritative_success());
}
