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
  SUPPORTED_INTELLIGENCE_SCHEMA_VERSIONS,
  type IntelligenceContractDocuments,
  type IntelligenceContractKind,
  type IntelligenceJsonObject,
  type IntelligenceJsonValue,
  type MigratedIntelligenceDocument,
} from "./contracts";

export const MAX_INTELLIGENCE_VALIDATION_ISSUES = 64;
// The largest committed contract shape is a 1,104,853-node Director proposal.
// Keep substantial headroom without allowing unbounded traversal.
export const MAX_INTELLIGENCE_DOCUMENT_NODES = 2_097_152;
export const MAX_INTELLIGENCE_DOCUMENT_DEPTH = 64;
const MAX_ISSUE_PATH_LENGTH = 256;
const SUPPORTED_SCHEMA_MAJOR = 1;

export type IntelligenceValidationErrorCode =
  | "invalid_schema_version"
  | "unsupported_schema_version"
  | "invalid_json_document"
  | "input_budget_exceeded"
  | "schema_migration_failed"
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
  kind: IntelligenceContractKind,
  document: IntelligenceJsonObject,
) => IntelligenceJsonObject;

interface MinorMigrationRegistration {
  readonly targetVersion: string;
  readonly migrate: MinorMigration;
}

function identityMigration(
  _kind: IntelligenceContractKind,
  document: IntelligenceJsonObject,
): IntelligenceJsonObject {
  return document;
}

function currentIdentityMigration(): ReadonlyMap<
  string,
  MinorMigrationRegistration
> {
  return new Map([
    [
      CURRENT_INTELLIGENCE_SCHEMA_VERSION,
      {
        targetVersion: CURRENT_INTELLIGENCE_SCHEMA_VERSION,
        migrate: identityMigration,
      },
    ],
  ]);
}

// Registrations are deliberately scoped by both contract kind and source
// version. Adding a minor revision requires an explicit entry for each kind.
const MINOR_MIGRATION_REGISTRY = {
  common: currentIdentityMigration(),
  gameBrief: currentIdentityMigration(),
  gameOperatingModel: currentIdentityMigration(),
  directorProposal: currentIdentityMigration(),
  provenance: currentIdentityMigration(),
  corpusRecord: currentIdentityMigration(),
  referenceAnalysis: currentIdentityMigration(),
  radarSnapshot: currentIdentityMigration(),
  monetizationOpportunitySignal: currentIdentityMigration(),
  recommendation: currentIdentityMigration(),
} as const satisfies Readonly<
  Record<
    IntelligenceContractKind,
    ReadonlyMap<string, MinorMigrationRegistration>
  >
>;

const SUPPORTED_SCHEMA_VERSION_SET: ReadonlySet<string> = new Set(
  SUPPORTED_INTELLIGENCE_SCHEMA_VERSIONS,
);

function registeredMigration(
  kind: IntelligenceContractKind,
  sourceVersion: string,
): MinorMigrationRegistration | undefined {
  const registration = MINOR_MIGRATION_REGISTRY[kind].get(sourceVersion);
  return registration !== undefined &&
    SUPPORTED_SCHEMA_VERSION_SET.has(registration.targetVersion)
    ? registration
    : undefined;
}

export function intelligenceMigrationTarget(
  kind: IntelligenceContractKind,
  sourceVersion: string,
): string | undefined {
  return registeredMigration(kind, sourceVersion)?.targetVersion;
}

const ajv = new Ajv2020({
  allErrors: false,
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

type OwnedJsonResult =
  | { readonly ok: true; readonly value: IntelligenceJsonValue }
  | {
      readonly ok: false;
      readonly code: Extract<
        IntelligenceValidationErrorCode,
        "invalid_json_document" | "input_budget_exceeded"
      >;
    };

interface JsonCloneState {
  nodes: number;
  readonly ancestors: Set<object>;
}

function invalidJsonResult(): OwnedJsonResult {
  return { ok: false, code: "invalid_json_document" };
}

function budgetExceededResult(): OwnedJsonResult {
  return { ok: false, code: "input_budget_exceeded" };
}

function cloneOwnedJsonValue(
  value: unknown,
  depth: number,
  state: JsonCloneState,
): OwnedJsonResult {
  if (depth > MAX_INTELLIGENCE_DOCUMENT_DEPTH) {
    return budgetExceededResult();
  }
  state.nodes += 1;
  if (state.nodes > MAX_INTELLIGENCE_DOCUMENT_NODES) {
    return budgetExceededResult();
  }

  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return { ok: true, value };
  }
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? { ok: true, value }
      : invalidJsonResult();
  }
  if (typeof value !== "object") {
    return invalidJsonResult();
  }
  if (state.ancestors.has(value)) {
    return invalidJsonResult();
  }

  state.ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (
        Object.getPrototypeOf(value) !== Array.prototype ||
        value.length > MAX_INTELLIGENCE_DOCUMENT_NODES - state.nodes
      ) {
        return value.length > MAX_INTELLIGENCE_DOCUMENT_NODES - state.nodes
          ? budgetExceededResult()
          : invalidJsonResult();
      }

      const keys = Reflect.ownKeys(value);
      if (
        keys.length !== value.length + 1 ||
        keys.some((key) => typeof key !== "string")
      ) {
        return invalidJsonResult();
      }
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const owned: IntelligenceJsonValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (
          descriptor === undefined ||
          !descriptor.enumerable ||
          !("value" in descriptor)
        ) {
          return invalidJsonResult();
        }
        const child = cloneOwnedJsonValue(
          descriptor.value,
          depth + 1,
          state,
        );
        if (!child.ok) {
          return child;
        }
        owned.push(child.value);
      }
      return { ok: true, value: owned };
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return invalidJsonResult();
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length > MAX_INTELLIGENCE_DOCUMENT_NODES - state.nodes) {
      return budgetExceededResult();
    }
    if (keys.some((key) => typeof key !== "string")) {
      return invalidJsonResult();
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const owned: Record<string, IntelligenceJsonValue> = {};
    for (const key of keys as string[]) {
      const descriptor = descriptors[key];
      if (!descriptor.enumerable || !("value" in descriptor)) {
        return invalidJsonResult();
      }
      const child = cloneOwnedJsonValue(
        descriptor.value,
        depth + 1,
        state,
      );
      if (!child.ok) {
        return child;
      }
      Object.defineProperty(owned, key, {
        configurable: true,
        enumerable: true,
        value: child.value,
        writable: true,
      });
    }
    return { ok: true, value: owned };
  } finally {
    state.ancestors.delete(value);
  }
}

function cloneOwnedJson(value: unknown): OwnedJsonResult {
  try {
    return cloneOwnedJsonValue(value, 0, {
      nodes: 0,
      ancestors: new Set(),
    });
  } catch {
    return invalidJsonResult();
  }
}

function deepFreezeJson(value: IntelligenceJsonValue): void {
  if (value === null || typeof value !== "object") {
    return;
  }
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    deepFreezeJson(child);
  }
  Object.freeze(value);
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

function documentFailure<Kind extends IntelligenceContractKind>(
  kind: Kind,
  code: Extract<
    IntelligenceValidationErrorCode,
    "invalid_json_document" | "input_budget_exceeded"
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
        path: "/",
        message:
          code === "input_budget_exceeded"
            ? "Document exceeds the fixed validation budget."
            : "Document must contain only bounded JSON data.",
      },
    ],
  };
}

function migrationFailure<Kind extends IntelligenceContractKind>(
  kind: Kind,
): IntelligenceValidationFailure<Kind> {
  return {
    ok: false,
    kind,
    validated: false,
    code: "schema_migration_failed",
    issues: [
      {
        code: "schema_mismatch",
        path: "/schemaVersion",
        message: "Schema migration did not produce its declared target.",
      },
    ],
  };
}

export function migrateIntelligenceContract<
  Kind extends IntelligenceContractKind,
>(kind: Kind, value: unknown): IntelligenceMigrationResult<Kind> {
  const owned = cloneOwnedJson(value);
  if (!owned.ok) {
    return documentFailure(kind, owned.code);
  }
  if (!isJsonObject(owned.value)) {
    return versionFailure(kind, "invalid_schema_version");
  }
  const parsedVersion = parseVersion(owned.value.schemaVersion);
  if (parsedVersion === null) {
    return versionFailure(kind, "invalid_schema_version");
  }
  if (parsedVersion[0] !== SUPPORTED_SCHEMA_MAJOR) {
    return versionFailure(kind, "unsupported_schema_version");
  }

  const sourceVersion =
    typeof owned.value.schemaVersion === "string"
      ? owned.value.schemaVersion
      : undefined;
  const registration =
    sourceVersion === undefined
      ? undefined
      : registeredMigration(kind, sourceVersion);
  if (registration === undefined) {
    return versionFailure(kind, "unsupported_schema_version");
  }

  const migrated = cloneOwnedJson(
    registration.migrate(kind, owned.value),
  );
  if (
    !migrated.ok ||
    !isJsonObject(migrated.value) ||
    migrated.value.schemaVersion !== registration.targetVersion
  ) {
    return migrationFailure(kind);
  }

  return {
    ok: true,
    kind,
    validated: false,
    value: migrated.value as MigratedIntelligenceDocument,
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
    deepFreezeJson(migrated.value);
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
