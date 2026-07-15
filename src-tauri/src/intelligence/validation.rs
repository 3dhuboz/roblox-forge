use std::{collections::HashMap, error::Error, fmt, sync::OnceLock};

use jsonschema::{Draft, Retrieve, Uri, Validator};
use serde_json::Value;

use super::contracts::{
    supported_schema_versions, ContractKind, CURRENT_SCHEMA_VERSION, INTELLIGENCE_SCHEMA_DIALECT,
    SUPPORTED_SCHEMA_MAJOR,
};

pub const MAX_VALIDATION_ISSUES: usize = 64;
const MAX_ISSUE_PATH_LENGTH: usize = 256;
const MAX_ISSUE_MESSAGE_LENGTH: usize = 160;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ContractErrorCode {
    InvalidSchemaVersion,
    UnsupportedSchemaVersion,
    SchemaMigrationFailed,
    SchemaUnavailable,
    SchemaValidationFailed,
}

impl ContractErrorCode {
    const fn as_str(self) -> &'static str {
        match self {
            Self::InvalidSchemaVersion => "invalid_schema_version",
            Self::UnsupportedSchemaVersion => "unsupported_schema_version",
            Self::SchemaMigrationFailed => "schema_migration_failed",
            Self::SchemaUnavailable => "schema_unavailable",
            Self::SchemaValidationFailed => "schema_validation_failed",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractValidationIssue {
    path: String,
    message: &'static str,
}

impl ContractValidationIssue {
    pub fn path(&self) -> &str {
        &self.path
    }

    pub const fn message(&self) -> &'static str {
        self.message
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractValidationError {
    code: ContractErrorCode,
    issues: Vec<ContractValidationIssue>,
}

impl ContractValidationError {
    fn new(code: ContractErrorCode, issues: Vec<ContractValidationIssue>) -> Self {
        Self {
            code,
            issues: issues.into_iter().take(MAX_VALIDATION_ISSUES).collect(),
        }
    }

    fn version(code: ContractErrorCode) -> Self {
        let message = match code {
            ContractErrorCode::InvalidSchemaVersion => "Schema version is missing or malformed.",
            ContractErrorCode::UnsupportedSchemaVersion => {
                "Schema version is not supported by this runtime."
            }
            _ => "Schema version could not be validated.",
        };
        Self::new(
            code,
            vec![ContractValidationIssue {
                path: "/schemaVersion".to_owned(),
                message,
            }],
        )
    }

    fn unavailable() -> Self {
        Self::new(ContractErrorCode::SchemaUnavailable, Vec::new())
    }

    fn migration_failed() -> Self {
        Self::new(
            ContractErrorCode::SchemaMigrationFailed,
            vec![ContractValidationIssue {
                path: "/schemaVersion".to_owned(),
                message: "Schema migration did not produce its declared target.",
            }],
        )
    }

    pub const fn code(&self) -> &'static str {
        self.code.as_str()
    }

    pub fn issues(&self) -> &[ContractValidationIssue] {
        &self.issues
    }
}

impl fmt::Display for ContractValidationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "{}: intelligence contract rejected ({} issue(s))",
            self.code(),
            self.issues.len()
        )
    }
}

impl Error for ContractValidationError {}

type MigrationFn = fn(ContractKind, Value) -> Value;

struct MinorMigration {
    kind: ContractKind,
    source_version: &'static str,
    target_version: &'static str,
    migrate: MigrationFn,
}

fn identity_migration(_kind: ContractKind, document: Value) -> Value {
    document
}

// Every supported minor revision is scoped by contract kind and source
// version. Current-version identity entries are explicit and idempotent.
const MINOR_MIGRATION_REGISTRY: &[MinorMigration] = &[
    MinorMigration {
        kind: ContractKind::Common,
        source_version: CURRENT_SCHEMA_VERSION,
        target_version: CURRENT_SCHEMA_VERSION,
        migrate: identity_migration,
    },
    MinorMigration {
        kind: ContractKind::GameBrief,
        source_version: CURRENT_SCHEMA_VERSION,
        target_version: CURRENT_SCHEMA_VERSION,
        migrate: identity_migration,
    },
    MinorMigration {
        kind: ContractKind::GameOperatingModel,
        source_version: CURRENT_SCHEMA_VERSION,
        target_version: CURRENT_SCHEMA_VERSION,
        migrate: identity_migration,
    },
    MinorMigration {
        kind: ContractKind::DirectorProposal,
        source_version: CURRENT_SCHEMA_VERSION,
        target_version: CURRENT_SCHEMA_VERSION,
        migrate: identity_migration,
    },
    MinorMigration {
        kind: ContractKind::Provenance,
        source_version: CURRENT_SCHEMA_VERSION,
        target_version: CURRENT_SCHEMA_VERSION,
        migrate: identity_migration,
    },
    MinorMigration {
        kind: ContractKind::CorpusRecord,
        source_version: CURRENT_SCHEMA_VERSION,
        target_version: CURRENT_SCHEMA_VERSION,
        migrate: identity_migration,
    },
    MinorMigration {
        kind: ContractKind::ReferenceAnalysis,
        source_version: CURRENT_SCHEMA_VERSION,
        target_version: CURRENT_SCHEMA_VERSION,
        migrate: identity_migration,
    },
    MinorMigration {
        kind: ContractKind::RadarSnapshot,
        source_version: CURRENT_SCHEMA_VERSION,
        target_version: CURRENT_SCHEMA_VERSION,
        migrate: identity_migration,
    },
    MinorMigration {
        kind: ContractKind::MonetizationOpportunitySignal,
        source_version: CURRENT_SCHEMA_VERSION,
        target_version: CURRENT_SCHEMA_VERSION,
        migrate: identity_migration,
    },
    MinorMigration {
        kind: ContractKind::Recommendation,
        source_version: CURRENT_SCHEMA_VERSION,
        target_version: CURRENT_SCHEMA_VERSION,
        migrate: identity_migration,
    },
];

fn registered_migration(
    kind: ContractKind,
    source_version: &str,
) -> Option<&'static MinorMigration> {
    MINOR_MIGRATION_REGISTRY.iter().find(|registration| {
        registration.kind == kind
            && registration.source_version == source_version
            && supported_schema_versions().contains(&registration.target_version)
    })
}

pub fn migration_target(kind: ContractKind, source_version: &str) -> Option<&'static str> {
    registered_migration(kind, source_version).map(|registration| registration.target_version)
}

pub fn migrate_contract(
    kind: ContractKind,
    document: &Value,
) -> Result<Value, ContractValidationError> {
    let version = document
        .as_object()
        .and_then(|object| object.get("schemaVersion"))
        .and_then(Value::as_str)
        .ok_or_else(|| ContractValidationError::version(ContractErrorCode::InvalidSchemaVersion))?;

    let (major, _, _) = parse_schema_version(version)
        .ok_or_else(|| ContractValidationError::version(ContractErrorCode::InvalidSchemaVersion))?;
    if major != SUPPORTED_SCHEMA_MAJOR {
        return Err(ContractValidationError::version(
            ContractErrorCode::UnsupportedSchemaVersion,
        ));
    }

    let migration = registered_migration(kind, version).ok_or_else(|| {
        ContractValidationError::version(ContractErrorCode::UnsupportedSchemaVersion)
    })?;
    let migrated = (migration.migrate)(kind, document.clone());
    if migrated
        .as_object()
        .and_then(|object| object.get("schemaVersion"))
        .and_then(Value::as_str)
        != Some(migration.target_version)
    {
        return Err(ContractValidationError::migration_failed());
    }
    Ok(migrated)
}

pub fn validate_contract(
    kind: ContractKind,
    document: &Value,
) -> Result<Value, ContractValidationError> {
    let migrated = migrate_contract(kind, document)?;
    let validator = validators()?
        .get(&kind)
        .ok_or_else(ContractValidationError::unavailable)?;

    let mut issues = validator
        .iter_errors(&migrated)
        .map(|error| ContractValidationIssue {
            path: bounded_text(error.instance_path().as_str(), MAX_ISSUE_PATH_LENGTH),
            message: bounded_static_message(
                "Value does not satisfy the committed intelligence contract.",
            ),
        })
        .take(MAX_VALIDATION_ISSUES)
        .collect::<Vec<_>>();
    issues.sort_by(|left, right| left.path.cmp(&right.path));
    issues.dedup();

    if issues.is_empty() {
        Ok(migrated)
    } else {
        Err(ContractValidationError::new(
            ContractErrorCode::SchemaValidationFailed,
            issues,
        ))
    }
}

pub fn validate_game_operating_model(document: &Value) -> Result<Value, ContractValidationError> {
    validate_contract(ContractKind::GameOperatingModel, document)
}

fn parse_schema_version(value: &str) -> Option<(u64, u64, u64)> {
    if value.is_empty() || value.len() > 16 {
        return None;
    }
    let mut components = value.split('.');
    let major = parse_version_component(components.next()?)?;
    let minor = parse_version_component(components.next()?)?;
    let patch = parse_version_component(components.next()?)?;
    if components.next().is_some() {
        return None;
    }
    Some((major, minor, patch))
}

fn parse_version_component(value: &str) -> Option<u64> {
    if value.is_empty()
        || !value.bytes().all(|byte| byte.is_ascii_digit())
        || (value.len() > 1 && value.starts_with('0'))
    {
        return None;
    }
    value.parse().ok()
}

fn bounded_text(value: &str, maximum_bytes: usize) -> String {
    if value.len() <= maximum_bytes {
        return if value.is_empty() {
            "/".to_owned()
        } else {
            value.to_owned()
        };
    }
    let boundary = value
        .char_indices()
        .map(|(index, _)| index)
        .take_while(|index| *index <= maximum_bytes)
        .last()
        .unwrap_or(0);
    value[..boundary].to_owned()
}

const fn bounded_static_message(message: &'static str) -> &'static str {
    assert!(message.len() <= MAX_ISSUE_MESSAGE_LENGTH);
    message
}

static VALIDATORS: OnceLock<Result<HashMap<ContractKind, Validator>, ()>> = OnceLock::new();

fn validators() -> Result<&'static HashMap<ContractKind, Validator>, ContractValidationError> {
    VALIDATORS
        .get_or_init(build_validators)
        .as_ref()
        .map_err(|_| ContractValidationError::unavailable())
}

fn build_validators() -> Result<HashMap<ContractKind, Validator>, ()> {
    let mut validators = HashMap::with_capacity(ContractKind::ALL.len());
    for kind in ContractKind::ALL {
        let schema: Value = serde_json::from_str(kind.schema_source()).map_err(|_| ())?;
        if schema.get("$schema").and_then(Value::as_str) != Some(INTELLIGENCE_SCHEMA_DIALECT)
            || schema.get("$id").and_then(Value::as_str) != Some(kind.schema_id())
        {
            return Err(());
        }
        let validator = jsonschema::options()
            .with_draft(Draft::Draft202012)
            .should_validate_formats(true)
            .with_retriever(CommittedSchemaRetriever)
            .build(&schema)
            .map_err(|_| ())?;
        validators.insert(kind, validator);
    }
    Ok(validators)
}

#[derive(Clone, Copy)]
struct CommittedSchemaRetriever;

impl Retrieve for CommittedSchemaRetriever {
    fn retrieve(&self, uri: &Uri<String>) -> Result<Value, Box<dyn Error + Send + Sync>> {
        let kind = ContractKind::ALL
            .into_iter()
            .find(|kind| kind.schema_id() == uri.as_str())
            .ok_or_else(|| Box::new(SchemaRetrievalDenied) as Box<dyn Error + Send + Sync>)?;
        serde_json::from_str(kind.schema_source())
            .map_err(|_| Box::new(SchemaRetrievalDenied) as Box<dyn Error + Send + Sync>)
    }
}

#[derive(Debug)]
struct SchemaRetrievalDenied;

impl fmt::Display for SchemaRetrievalDenied {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("schema retrieval denied")
    }
}

impl Error for SchemaRetrievalDenied {}
