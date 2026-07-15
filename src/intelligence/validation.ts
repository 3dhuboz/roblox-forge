import Ajv2020, {
  type AnySchema,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  CURRENT_INTELLIGENCE_SCHEMA_VERSION,
  INTELLIGENCE_CONTRACT_KINDS,
  INTELLIGENCE_CONTRACTS,
  type IntelligenceContractDocuments,
  type IntelligenceContractKind,
  type IntelligenceJsonObject,
  type MigratedIntelligenceDocument,
} from "./contracts";

export const MAX_INTELLIGENCE_VALIDATION_ISSUES = 64;
const MAX_ISSUE_PATH_LENGTH = 256;
const SUPPORTED_SCHEMA_MAJOR = 1;

export type IntelligenceValidationErrorCode =
  | "invalid_schema_version"
  | "unsupported_schema_version"
  | "schema_validation_failed";

export interface IntelligenceValidationIssue {
  readonly code: "schema_mismatch";
  readonly path: string;
  readonly message: string;
}

export interface IntelligenceValidationFailure<
  Kind extends IntelligenceContractKind,
> {
  readonly ok: false;
  readonly kind: Kind;
  readonly validated: false;
  readonly code: IntelligenceValidationErrorCode;
  readonly issues: readonly IntelligenceValidationIssue[];
}

export type IntelligenceMigrationResult<
  Kind extends IntelligenceContractKind,
> =
  | {
      readonly ok: true;
      readonly kind: Kind;
      readonly validated: false;
      readonly value: MigratedIntelligenceDocument;
    }
  | IntelligenceValidationFailure<Kind>;

export type IntelligenceValidationResult<
  Kind extends IntelligenceContractKind,
> =
  | {
      readonly ok: true;
      readonly kind: Kind;
      readonly validated: true;
      readonly value: IntelligenceContractDocuments[Kind];
    }
  | IntelligenceValidationFailure<Kind>;

type MinorMigration = (
  document: IntelligenceJsonObject,
) => IntelligenceJsonObject;

// Adding a supported minor revision requires an explicit, reviewable entry.
// The current-version identity migration is intentionally idempotent.
const MINOR_MIGRATION_REGISTRY: ReadonlyMap<string, MinorMigration> = new Map([
  [CURRENT_INTELLIGENCE_SCHEMA_VERSION, (document) => document],
]);

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: true,
});
addFormats(ajv);

for (const kind of INTELLIGENCE_CONTRACT_KINDS) {
  const contract = INTELLIGENCE_CONTRACTS[kind];
  ajv.addSchema(contract.schema as AnySchema, contract.schemaId);
}

const validators = Object.fromEntries(
  INTELLIGENCE_CONTRACT_KINDS.map((kind) => {
    const validator = ajv.getSchema(INTELLIGENCE_CONTRACTS[kind].schemaId);
    if (validator === undefined) {
      throw new Error("intelligence_schema_unavailable");
    }
    return [kind, validator];
  }),
) as Readonly<Record<IntelligenceContractKind, ValidateFunction>>;

function isJsonObject(value: unknown): value is IntelligenceJsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseVersion(value: unknown): readonly [number, number, number] | null {
  if (typeof value !== "string" || value.length > 16) {
    return null;
  }
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  if (match === null) {
    return null;
  }
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part))) {
    return null;
  }
  return [parts[0], parts[1], parts[2]];
}

function versionFailure<Kind extends IntelligenceContractKind>(
  kind: Kind,
  code: Extract<
    IntelligenceValidationErrorCode,
    "invalid_schema_version" | "unsupported_schema_version"
  >,
): IntelligenceValidationFailure<Kind> {
  return {
    ok: false,
    kind,
    validated: false,
    code,
    issues: [
      {
        code: "schema_mismatch",
        path: "/schemaVersion",
        message:
          code === "invalid_schema_version"
            ? "Schema version is missing or malformed."
            : "Schema version is not supported by this runtime.",
      },
    ],
  };
}

export function migrateIntelligenceContract<
  Kind extends IntelligenceContractKind,
>(kind: Kind, value: unknown): IntelligenceMigrationResult<Kind> {
  if (!isJsonObject(value)) {
    return versionFailure(kind, "invalid_schema_version");
  }
  const parsedVersion = parseVersion(value.schemaVersion);
  if (parsedVersion === null) {
    return versionFailure(kind, "invalid_schema_version");
  }
  if (parsedVersion[0] !== SUPPORTED_SCHEMA_MAJOR) {
    return versionFailure(kind, "unsupported_schema_version");
  }

  const migration =
    typeof value.schemaVersion === "string"
      ? MINOR_MIGRATION_REGISTRY.get(value.schemaVersion)
      : undefined;
  if (migration === undefined) {
    return versionFailure(kind, "unsupported_schema_version");
  }

  return {
    ok: true,
    kind,
    validated: false,
    value: migration(value) as MigratedIntelligenceDocument,
  };
}

function boundedText(value: string, maximumLength: number): string {
  let result = "";
  for (const character of value) {
    if (result.length + character.length > maximumLength) {
      break;
    }
    result += character;
  }
  return result;
}

function issueMessage(keyword: string): string {
  switch (keyword) {
    case "additionalProperties":
      return "Property is not allowed by the committed contract.";
    case "required":
      return "A required property is missing from the contract.";
    case "format":
      return "Value does not satisfy the required public format.";
    case "const":
      return "Value does not match the committed contract version.";
    default:
      return "Value does not satisfy the committed contract.";
  }
}

function schemaIssue(error: ErrorObject): IntelligenceValidationIssue {
  return {
    code: "schema_mismatch",
    path: boundedText(error.instancePath || "/", MAX_ISSUE_PATH_LENGTH),
    message: issueMessage(error.keyword),
  };
}

export function validateIntelligenceContract<
  Kind extends IntelligenceContractKind,
>(kind: Kind, value: unknown): IntelligenceValidationResult<Kind> {
  const migrated = migrateIntelligenceContract(kind, value);
  if (!migrated.ok) {
    return migrated;
  }

  const validator = validators[kind];
  if (validator(migrated.value)) {
    return {
      ok: true,
      kind,
      validated: true,
      value: migrated.value as IntelligenceContractDocuments[Kind],
    };
  }

  const issues = (validator.errors ?? [])
    .slice(0, MAX_INTELLIGENCE_VALIDATION_ISSUES)
    .map(schemaIssue);
  return {
    ok: false,
    kind,
    validated: false,
    code: "schema_validation_failed",
    issues,
  };
}

export function validateGameOperatingModel(
  value: unknown,
): IntelligenceValidationResult<"gameOperatingModel"> {
  return validateIntelligenceContract("gameOperatingModel", value);
}
