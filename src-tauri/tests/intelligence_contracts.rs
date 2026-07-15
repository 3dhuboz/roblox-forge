use roblox_forge_lib::intelligence::{
    canonical_json::canonical_sha256,
    contracts::{supported_schema_versions, ContractKind},
    validation::{
        migrate_contract, validate_contract, validate_game_operating_model, MAX_VALIDATION_ISSUES,
    },
};
use serde_json::{json, Value};

const VALID_FIXTURE: &str = include_str!("../../schemas/intelligence/fixtures/valid/obby.json");
const INVALID_RADAR_FIXTURE: &str =
    include_str!("../../schemas/intelligence/fixtures/invalid/competitor-revenue.json");

fn valid_fixture() -> Value {
    serde_json::from_str(VALID_FIXTURE).expect("valid fixture must contain JSON")
}

fn fixture_document(key: &str) -> Value {
    valid_fixture()
        .get(key)
        .unwrap_or_else(|| panic!("valid fixture must contain {key}"))
        .clone()
}

#[test]
fn canonical_hash_is_stable_across_recursive_key_order() {
    let a = json!({
        "schemaVersion": "1.0.0",
        "revision": 1,
        "metadata": {"title": "Obby", "tags": ["obby", "mobile"]}
    });
    let b = json!({
        "metadata": {"tags": ["obby", "mobile"], "title": "Obby"},
        "revision": 1,
        "schemaVersion": "1.0.0"
    });

    let first = canonical_sha256(&a).expect("canonical JSON must hash");
    let second = canonical_sha256(&b).expect("canonical JSON must hash");

    assert_eq!(first, second);
    assert!(first.starts_with("sha256:"));
    assert_eq!(first.len(), "sha256:".len() + 64);
}

#[test]
fn every_committed_valid_document_matches_its_schema() {
    let fixture = valid_fixture();
    let cases = [
        (ContractKind::Common, "common"),
        (ContractKind::GameBrief, "gameBrief"),
        (ContractKind::GameOperatingModel, "gameOperatingModel"),
        (ContractKind::DirectorProposal, "directorProposal"),
        (ContractKind::Provenance, "provenance"),
        (ContractKind::CorpusRecord, "corpusRecord"),
        (ContractKind::ReferenceAnalysis, "referenceAnalysis"),
        (ContractKind::RadarSnapshot, "radarSnapshot"),
        (
            ContractKind::MonetizationOpportunitySignal,
            "monetizationOpportunitySignal",
        ),
        (ContractKind::Recommendation, "recommendation"),
    ];

    for (kind, key) in cases {
        let document = fixture
            .get(key)
            .unwrap_or_else(|| panic!("valid fixture must contain {key}"));
        validate_contract(kind, document)
            .unwrap_or_else(|error| panic!("{key} should be valid: {error}"));
    }
}

#[test]
fn committed_invalid_fixture_is_rejected_by_its_schema() {
    let fixture: Value =
        serde_json::from_str(INVALID_RADAR_FIXTURE).expect("invalid fixture must contain JSON");

    let error = validate_contract(ContractKind::RadarSnapshot, &fixture)
        .expect_err("competitor revenue must not be accepted as public radar evidence");

    assert_eq!(error.code(), "schema_validation_failed");
    assert!(!error.issues().is_empty());
    assert!(error.issues().len() <= MAX_VALIDATION_ISSUES);
}

#[test]
fn future_major_schema_fails_closed() {
    let mut fixture = fixture_document("gameOperatingModel");
    fixture["schemaVersion"] = json!("2.0.0");

    let error = validate_game_operating_model(&fixture)
        .expect_err("an unsupported future major must fail closed");

    assert_eq!(error.code(), "unsupported_schema_version");
}

#[test]
fn supported_minor_migration_registry_is_explicit_and_idempotent() {
    assert_eq!(supported_schema_versions(), &["1.0.0"]);

    let original = fixture_document("gameOperatingModel");
    let migrated_once = migrate_contract(ContractKind::GameOperatingModel, &original)
        .expect("the current supported minor must migrate");
    let migrated_twice = migrate_contract(ContractKind::GameOperatingModel, &migrated_once)
        .expect("migration must be safe to repeat");

    assert_eq!(migrated_once, original);
    assert_eq!(migrated_twice, migrated_once);
}

#[test]
fn unsupported_minor_revision_fails_closed_without_guessing() {
    let mut fixture = fixture_document("gameOperatingModel");
    fixture["schemaVersion"] = json!("1.1.0");

    let error = migrate_contract(ContractKind::GameOperatingModel, &fixture)
        .expect_err("unregistered minor revisions must fail closed");

    assert_eq!(error.code(), "unsupported_schema_version");
}

#[test]
fn validation_errors_are_bounded_and_do_not_echo_document_content() {
    let sentinel = "sk-live-do-not-log-this-credential-material";
    let mut fixture = fixture_document("gameOperatingModel");
    fixture["unexpectedCredential"] = json!(sentinel);

    let error = validate_game_operating_model(&fixture)
        .expect_err("unknown credential-shaped content must be rejected");
    let rendered = error.to_string();

    assert_eq!(error.code(), "schema_validation_failed");
    assert!(error.issues().len() <= MAX_VALIDATION_ISSUES);
    assert!(rendered.len() <= 256);
    assert!(!rendered.contains(sentinel));
    assert!(error
        .issues()
        .iter()
        .all(|issue| issue.path().len() <= 256 && issue.message().len() <= 160));
}
