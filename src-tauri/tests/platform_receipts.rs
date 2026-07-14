use chrono::DateTime;
use roblox_forge_lib::platform::receipt::{
    FailureRetrySafety, OperationAttempt, PartialSuccessEvidence, RetrySafety, SuccessEvidence,
    MAX_CORRELATION_ID_LENGTH, MAX_DIAGNOSTICS, MAX_DIAGNOSTIC_LENGTH,
    MAX_EXTERNAL_RESOURCE_ID_LENGTH, MAX_MESSAGE_LENGTH, MAX_OPERATION_LENGTH,
    MAX_RECOVERY_ACTION_LENGTH, MAX_VALUE_ARRAY_ITEMS, MAX_VALUE_DEPTH, MAX_VALUE_KEY_LENGTH,
    MAX_VALUE_OBJECT_ENTRIES, MAX_VALUE_STRING_LENGTH,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::{Uuid, Version};

const CORRELATION_ID: &str = "create-flow-1";
const INPUT_HASH: &str = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ARTIFACT_HASH: &str =
    "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RedactionFixture {
    sentinel: String,
    redacted: String,
    truncated: String,
    vectors: Vec<RedactionVector>,
    safe_strings: Vec<String>,
    limits: FixtureLimits,
}

#[derive(Debug, Deserialize)]
struct RedactionVector {
    name: String,
    input: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FixtureLimits {
    message_length: usize,
    recovery_action_length: usize,
    diagnostics_count: usize,
    diagnostic_length: usize,
    operation_length: usize,
    correlation_id_length: usize,
    external_resource_id_length: usize,
    value_depth: usize,
    value_object_entries: usize,
    value_array_items: usize,
    value_key_length: usize,
    value_string_length: usize,
}

fn redaction_fixture() -> RedactionFixture {
    serde_json::from_str(include_str!(
        "../../tests/fixtures/receipt-redaction-vectors.json"
    ))
    .expect("redaction fixture must be valid JSON")
}

fn attempt(operation: &str) -> OperationAttempt {
    OperationAttempt::new(operation, CORRELATION_ID, None).unwrap()
}

#[test]
fn lifecycle_receipts_preserve_attempt_identity_and_start_time() {
    let attempt = OperationAttempt::new("build", CORRELATION_ID, Some(INPUT_HASH)).unwrap();
    let queued = attempt.queued("Build queued", Vec::<String>::new());
    let running = attempt.running("Build running", Vec::<String>::new());
    let success = attempt.succeeded(
        SuccessEvidence::new(ARTIFACT_HASH).unwrap(),
        "Build complete",
        Vec::<String>::new(),
    );

    let operation_id = Uuid::parse_str(queued.operation_id()).unwrap();
    assert_eq!(operation_id.get_version(), Some(Version::Random));
    assert_eq!(queued.operation_id(), running.operation_id());
    assert_eq!(running.operation_id(), success.operation_id());
    assert_eq!(queued.started_at(), running.started_at());
    assert_eq!(running.started_at(), success.started_at());
    assert_eq!(queued.input_hash(), Some(INPUT_HASH));
    assert_eq!(success.artifact_hash(), Some(ARTIFACT_HASH));
    assert!(queued.finished_at().is_none());
    assert!(running.finished_at().is_none());
    DateTime::parse_from_rfc3339(success.finished_at().unwrap()).unwrap();
    assert!(success.is_authoritative_success());
}

#[test]
fn distinct_attempts_share_correlation_but_not_operation_identity() {
    let build = attempt("build").queued("Queued", Vec::<String>::new());
    let publish = attempt("publish").queued("Queued", Vec::<String>::new());

    assert_ne!(build.operation_id(), publish.operation_id());
    assert_eq!(build.correlation_id(), CORRELATION_ID);
    assert_eq!(publish.correlation_id(), CORRELATION_ID);
}

#[test]
fn authoritative_success_requires_valid_typed_evidence() {
    for invalid in [
        "not-a-sha256",
        "sha256:ABCDEF",
        "sha256:0123",
        "sha256:RF_SENTINEL_NEVER_LEAK_7A9C",
    ] {
        let error = SuccessEvidence::new(invalid).unwrap_err().to_string();
        assert_eq!(error, "artifact hash is invalid");
        assert!(!error.contains(invalid));
    }

    let evidence = SuccessEvidence::new(ARTIFACT_HASH)
        .unwrap()
        .with_external_resource_id("place-version:42")
        .unwrap();
    let receipt = attempt("publish")
        .succeeded(evidence, "Published", Vec::<String>::new())
        .with_value(json!({ "claimedSuccess": true }));

    assert_eq!(receipt.artifact_hash(), Some(ARTIFACT_HASH));
    assert_eq!(receipt.external_resource_id(), Some("place-version:42"));
    assert!(receipt.is_authoritative_success());
}

#[test]
fn state_specific_evidence_cannot_promote_failed_simulated_or_unavailable() {
    let failed = OperationAttempt::new("publish", CORRELATION_ID, Some(INPUT_HASH))
        .unwrap()
        .failed(
            "Upload failed",
            Vec::<String>::new(),
            FailureRetrySafety::NotRetryable,
        );
    let partial = OperationAttempt::new("publish", CORRELATION_ID, Some(INPUT_HASH))
        .unwrap()
        .partial_success(
            PartialSuccessEvidence::new("place-version:42")
                .unwrap()
                .with_artifact_hash(ARTIFACT_HASH)
                .unwrap(),
            "Upload succeeded; metadata failed",
            Vec::<String>::new(),
        );
    let simulated = OperationAttempt::new("publish", CORRELATION_ID, Some(INPUT_HASH))
        .unwrap()
        .simulated("Browser preview", Vec::<String>::new())
        .with_value(json!({ "claimedSuccess": true }));
    let unavailable = OperationAttempt::new("publish", CORRELATION_ID, Some(INPUT_HASH))
        .unwrap()
        .unavailable("Desktop unavailable", Vec::<String>::new());

    assert_eq!(failed.retry_safety(), RetrySafety::NotRetryable);
    assert!(failed.artifact_hash().is_none());
    assert!(failed.external_resource_id().is_none());
    assert_eq!(partial.artifact_hash(), Some(ARTIFACT_HASH));
    assert_eq!(partial.external_resource_id(), Some("place-version:42"));
    assert_eq!(
        partial.retry_safety(),
        RetrySafety::UnsafeWithoutReconciliation
    );
    assert!(!partial.is_authoritative_success());
    for receipt in [simulated, unavailable] {
        assert!(receipt.input_hash().is_none());
        assert!(receipt.artifact_hash().is_none());
        assert!(receipt.external_resource_id().is_none());
        assert!(!receipt.is_authoritative_success());
    }
}

#[test]
fn invalid_identifiers_and_partial_evidence_return_static_errors() {
    let fixture = redaction_fixture();
    let oversized_operation = "x".repeat(MAX_OPERATION_LENGTH + 1);
    let oversized_correlation = "x".repeat(MAX_CORRELATION_ID_LENGTH + 1);
    let oversized_external = "x".repeat(MAX_EXTERNAL_RESOURCE_ID_LENGTH + 1);

    for invalid in [
        "",
        "bad operation",
        oversized_operation.as_str(),
        fixture.vectors[0].input.as_str(),
    ] {
        let error = OperationAttempt::new(invalid, CORRELATION_ID, None)
            .unwrap_err()
            .to_string();
        assert_eq!(error, "operation identifier is invalid");
        assert!(!error.contains(&fixture.sentinel));
    }
    for invalid in [
        "",
        "bad correlation",
        oversized_correlation.as_str(),
        fixture.vectors[1].input.as_str(),
    ] {
        let error = OperationAttempt::new("build", invalid, None)
            .unwrap_err()
            .to_string();
        assert_eq!(error, "correlation identifier is invalid");
        assert!(!error.contains(&fixture.sentinel));
    }
    for invalid in [
        "",
        "bad resource",
        oversized_external.as_str(),
        fixture.vectors[2].input.as_str(),
    ] {
        let error = PartialSuccessEvidence::new(invalid)
            .unwrap_err()
            .to_string();
        assert_eq!(error, "external resource identifier is invalid");
        assert!(!error.contains(&fixture.sentinel));
    }
    let input_error = OperationAttempt::new("build", CORRELATION_ID, Some("invalid"))
        .unwrap_err()
        .to_string();
    assert_eq!(input_error, "input hash is invalid");
}

#[test]
fn shared_golden_vectors_are_redacted_from_every_serialized_surface() {
    let fixture = redaction_fixture();

    for vector in &fixture.vectors {
        let receipt = attempt("publish")
            .failed(
                &vector.input,
                vec![vector.input.clone()],
                FailureRetrySafety::Safe,
            )
            .with_recovery_action(&vector.input)
            .with_value(json!({
                "nested": { vector.input.clone(): vector.input.clone() }
            }));
        let serialized = serde_json::to_string(&receipt).unwrap();

        assert_eq!(
            receipt.message(),
            fixture.redacted,
            "{} message",
            vector.name
        );
        assert_eq!(receipt.recovery_action(), Some(fixture.redacted.as_str()));
        assert_eq!(receipt.diagnostics(), &[fixture.redacted.clone()]);
        assert!(serialized.contains(&fixture.redacted));
        assert!(
            !serialized.contains(&fixture.sentinel),
            "{} leaked",
            vector.name
        );
        assert!(
            !serialized.contains(&vector.input),
            "{} raw input leaked",
            vector.name
        );
    }
}

#[test]
fn text_and_recursive_value_bounds_match_the_shared_fixture() {
    let fixture = redaction_fixture();
    let limits = &fixture.limits;
    assert_eq!(MAX_MESSAGE_LENGTH, limits.message_length);
    assert_eq!(MAX_RECOVERY_ACTION_LENGTH, limits.recovery_action_length);
    assert_eq!(MAX_DIAGNOSTICS, limits.diagnostics_count);
    assert_eq!(MAX_DIAGNOSTIC_LENGTH, limits.diagnostic_length);
    assert_eq!(MAX_OPERATION_LENGTH, limits.operation_length);
    assert_eq!(MAX_CORRELATION_ID_LENGTH, limits.correlation_id_length);
    assert_eq!(
        MAX_EXTERNAL_RESOURCE_ID_LENGTH,
        limits.external_resource_id_length
    );
    assert_eq!(MAX_VALUE_DEPTH, limits.value_depth);
    assert_eq!(MAX_VALUE_OBJECT_ENTRIES, limits.value_object_entries);
    assert_eq!(MAX_VALUE_ARRAY_ITEMS, limits.value_array_items);
    assert_eq!(MAX_VALUE_KEY_LENGTH, limits.value_key_length);
    assert_eq!(MAX_VALUE_STRING_LENGTH, limits.value_string_length);

    let long = "z".repeat(MAX_VALUE_STRING_LENGTH + 50);
    let many = (0..MAX_VALUE_ARRAY_ITEMS + 5)
        .map(|index| Value::String(format!("item-{index}")))
        .collect::<Vec<_>>();
    let deep = json!({ "a": { "b": { "c": { "d": { "e": fixture.sentinel } } } } });
    let receipt = attempt("analytics")
        .failed(
            &long,
            vec![long.clone(); MAX_DIAGNOSTICS + 5],
            FailureRetrySafety::Safe,
        )
        .with_recovery_action(&long)
        .with_value(json!({
            "long": long,
            "array": many,
            "deep": deep,
            fixture.vectors[0].input.clone(): fixture.vectors[0].input.clone(),
        }));

    assert!(receipt.message().chars().count() <= MAX_MESSAGE_LENGTH);
    assert!(receipt.recovery_action().unwrap().chars().count() <= MAX_RECOVERY_ACTION_LENGTH);
    assert!(receipt.diagnostics().len() <= MAX_DIAGNOSTICS);
    assert!(receipt
        .diagnostics()
        .iter()
        .all(|diagnostic| diagnostic.chars().count() <= MAX_DIAGNOSTIC_LENGTH));
    let serialized_value = serde_json::to_string(receipt.value().unwrap()).unwrap();
    assert!(serialized_value.contains(&fixture.truncated));
    assert!(!serialized_value.contains(&fixture.sentinel));
    assert_value_bounds(receipt.value().unwrap(), 0, limits);
}

#[test]
fn safe_text_and_json_shape_are_preserved() {
    let fixture = redaction_fixture();
    let safe = fixture.safe_strings[0].clone();
    let receipt = attempt("build")
        .failed(&safe, vec![safe.clone()], FailureRetrySafety::Safe)
        .with_recovery_action(&safe)
        .with_value(json!({ "status": safe }));
    let serialized = serde_json::to_value(&receipt).unwrap();

    assert_eq!(receipt.message(), fixture.safe_strings[0]);
    assert_eq!(
        receipt.recovery_action(),
        Some(fixture.safe_strings[0].as_str())
    );
    assert_eq!(serialized["state"], json!("failed"));
    assert_eq!(serialized["authoritative"], json!(false));
    assert!(serialized.get("operationId").is_some());
}

fn assert_value_bounds(value: &Value, depth: usize, limits: &FixtureLimits) {
    if depth >= limits.value_depth {
        assert!(value.is_string());
        return;
    }

    match value {
        Value::String(text) => assert!(text.chars().count() <= limits.value_string_length),
        Value::Array(items) => {
            assert!(items.len() <= limits.value_array_items);
            for item in items {
                assert_value_bounds(item, depth + 1, limits);
            }
        }
        Value::Object(object) => {
            assert!(object.len() <= limits.value_object_entries);
            for (key, item) in object {
                assert!(key.chars().count() <= limits.value_key_length);
                assert_value_bounds(item, depth + 1, limits);
            }
        }
        Value::Null | Value::Bool(_) | Value::Number(_) => {}
    }
}
