import Ajv2020, {
  type AnySchema,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import commonSchemaJson from "../../schemas/intelligence/common.schema.json?raw";
import gameBriefSchemaJson from "../../schemas/intelligence/game-brief.v1.schema.json?raw";
import gameOperatingModelSchemaJson from "../../schemas/intelligence/game-operating-model.v1.schema.json?raw";

export const MAX_GAME_DOCUMENT_ISSUES = 64;

export type GameDocumentIssueCode = "schema_mismatch" | "reference_mismatch";

export interface GameDocumentIssue {
  readonly code: GameDocumentIssueCode;
  readonly path: string;
  readonly message: string;
  readonly relatedPath?: string;
  readonly operationType?: string;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(JSON.parse(commonSchemaJson) as AnySchema);

const validateGameBrief = ajv.compile(
  JSON.parse(gameBriefSchemaJson) as AnySchema,
);
const validateGameOperatingModel = ajv.compile(
  JSON.parse(gameOperatingModelSchemaJson) as AnySchema,
);

function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, "~0").replace(/\//g, "~1");
}

function schemaIssuePath(basePath: string, error: ErrorObject): string {
  const path = `${basePath}${error.instancePath}`;
  if (error.keyword === "required") {
    const missingProperty = error.params.missingProperty;
    return typeof missingProperty === "string"
      ? `${path}/${escapePointerSegment(missingProperty)}`
      : path;
  }
  if (error.keyword === "additionalProperties") {
    const additionalProperty = error.params.additionalProperty;
    return typeof additionalProperty === "string"
      ? `${path}/${escapePointerSegment(additionalProperty)}`
      : path;
  }
  return path;
}

function schemaIssueMessage(keyword: string): string {
  switch (keyword) {
    case "required":
      return "Required property is missing from the proposed document.";
    case "additionalProperties":
      return "Property is not allowed in the proposed document.";
    case "minItems":
      return "Collection does not meet its minimum size.";
    case "maxItems":
      return "Collection exceeds its maximum size.";
    case "minLength":
      return "Text does not meet its minimum length.";
    case "maxLength":
      return "Text exceeds its maximum length.";
    case "format":
      return "Value does not satisfy the required format.";
    case "pattern":
      return "Value does not satisfy the required identifier pattern.";
    case "enum":
      return "Value is not an allowed schema value.";
    case "type":
      return "Value does not have the required schema type.";
    default:
      return "Proposed document does not satisfy a schema constraint.";
  }
}

function collectSchemaIssues(
  validator: ValidateFunction,
  value: unknown,
  basePath: string,
): GameDocumentIssue[] {
  validator(value);
  return (validator.errors ?? []).map((error) => ({
    code: "schema_mismatch",
    path: schemaIssuePath(basePath, error),
    message: schemaIssueMessage(error.keyword),
  }));
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function recordArray(value: unknown): readonly JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function declaredIds(value: unknown): ReadonlySet<string> {
  return new Set(
    recordArray(value)
      .map((item) => item.id)
      .filter((id): id is string => typeof id === "string"),
  );
}

function stringSet(value: unknown): ReadonlySet<string> {
  return new Set(
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [],
  );
}

function addReferenceIssue(
  issues: GameDocumentIssue[],
  path: string,
  relatedPath: string,
  message: string,
  operationType?: string,
): void {
  issues.push({
    code: "reference_mismatch",
    path,
    relatedPath,
    message,
    ...(operationType === undefined ? {} : { operationType }),
  });
}

function checkStringReference(
  value: unknown,
  path: string,
  declared: ReadonlySet<string>,
  relatedPath: string,
  message: string,
  issues: GameDocumentIssue[],
  operationType?: string,
): void {
  if (typeof value === "string" && !declared.has(value)) {
    addReferenceIssue(
      issues,
      path,
      relatedPath,
      message,
      operationType,
    );
  }
}

function checkReferenceArray(
  value: unknown,
  path: string,
  declared: ReadonlySet<string>,
  relatedPath: string,
  message: string,
  issues: GameDocumentIssue[],
  operationType?: string,
): void {
  if (!Array.isArray(value)) {
    return;
  }
  value.forEach((reference, index) =>
    checkStringReference(
      reference,
      `${path}/${index}`,
      declared,
      relatedPath,
      message,
      issues,
      operationType,
    ),
  );
}

const TRACE_DEFINITION_PATHS = new Set([
  "/gameBrief/provenance/traceIds",
  "/gameOperatingModel/provenance/traceIds",
]);

function collectTraceIssues(
  value: unknown,
  path: string,
  declaredTraceIds: ReadonlySet<string>,
  issues: GameDocumentIssue[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectTraceIssues(item, `${path}/${index}`, declaredTraceIds, issues),
    );
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}/${escapePointerSegment(key)}`;
    if (key === "traceIds" && !TRACE_DEFINITION_PATHS.has(childPath)) {
      checkReferenceArray(
        child,
        childPath,
        declaredTraceIds,
        "/gameOperatingModel/provenance/traceIds",
        "Trace reference must resolve to a declared document trace.",
        issues,
      );
      continue;
    }
    collectTraceIssues(child, childPath, declaredTraceIds, issues);
  }
}

function collectReferenceIssues(
  gameBrief: unknown,
  gameOperatingModel: unknown,
  operations: readonly unknown[],
): GameDocumentIssue[] {
  if (!isRecord(gameBrief) || !isRecord(gameOperatingModel)) {
    return [];
  }

  const issues: GameDocumentIssue[] = [];
  const scenes = recordArray(gameOperatingModel.sceneNodes);
  const systems = recordArray(gameOperatingModel.systems);
  const objectives = recordArray(gameOperatingModel.objectives);
  const acceptanceTests = recordArray(gameOperatingModel.acceptanceTests);
  const sceneIds = declaredIds(scenes);
  const systemIds = declaredIds(systems);
  const objectiveIds = declaredIds(objectives);
  const analyticsIds = declaredIds(gameOperatingModel.analyticsEventContracts);
  const acceptanceTestIds = declaredIds(acceptanceTests);
  const briefProvenance = isRecord(gameBrief.provenance)
    ? gameBrief.provenance
    : {};
  const gomProvenance = isRecord(gameOperatingModel.provenance)
    ? gameOperatingModel.provenance
    : {};
  const declaredTraceIds = new Set([
    ...stringSet(briefProvenance.traceIds),
    ...stringSet(gomProvenance.traceIds),
  ]);

  scenes.forEach((scene, sceneIndex) =>
    checkReferenceArray(
      scene.systemIds,
      `/gameOperatingModel/sceneNodes/${sceneIndex}/systemIds`,
      systemIds,
      "/gameOperatingModel/systems",
      "Scene system reference must resolve to a final system.",
      issues,
    ),
  );
  systems.forEach((system, systemIndex) => {
    checkReferenceArray(
      system.dependencyIds,
      `/gameOperatingModel/systems/${systemIndex}/dependencyIds`,
      systemIds,
      "/gameOperatingModel/systems",
      "System dependency must resolve to a final system.",
      issues,
    );
    checkReferenceArray(
      system.sceneIds,
      `/gameOperatingModel/systems/${systemIndex}/sceneIds`,
      sceneIds,
      "/gameOperatingModel/sceneNodes",
      "System scene reference must resolve to a final scene.",
      issues,
    );
  });
  objectives.forEach((objective, objectiveIndex) => {
    checkReferenceArray(
      objective.dependencyIds,
      `/gameOperatingModel/objectives/${objectiveIndex}/dependencyIds`,
      objectiveIds,
      "/gameOperatingModel/objectives",
      "Objective dependency must resolve to a final objective.",
      issues,
    );
    const success = isRecord(objective.success) ? objective.success : {};
    checkStringReference(
      success.observableSignal,
      `/gameOperatingModel/objectives/${objectiveIndex}/success/observableSignal`,
      analyticsIds,
      "/gameOperatingModel/analyticsEventContracts",
      "Objective analytics reference must resolve to a final event contract.",
      issues,
    );
  });

  const firstSessionPromise = isRecord(gameOperatingModel.firstSessionPromise)
    ? gameOperatingModel.firstSessionPromise
    : {};
  checkStringReference(
    firstSessionPromise.successSignal,
    "/gameOperatingModel/firstSessionPromise/successSignal",
    analyticsIds,
    "/gameOperatingModel/analyticsEventContracts",
    "First-session analytics reference must resolve to a final event contract.",
    issues,
  );
  acceptanceTests.forEach((acceptanceTest, acceptanceIndex) =>
    checkReferenceArray(
      acceptanceTest.observableSignals,
      `/gameOperatingModel/acceptanceTests/${acceptanceIndex}/observableSignals`,
      analyticsIds,
      "/gameOperatingModel/analyticsEventContracts",
      "Acceptance-test analytics reference must resolve to a final event contract.",
      issues,
    ),
  );

  collectTraceIssues(gameBrief, "/gameBrief", declaredTraceIds, issues);
  collectTraceIssues(
    gameOperatingModel,
    "/gameOperatingModel",
    declaredTraceIds,
    issues,
  );

  operations.forEach((value, index) => {
    if (!isRecord(value)) {
      return;
    }
    const operationType =
      typeof value.type === "string" ? value.type : undefined;
    checkReferenceArray(
      value.traceIds,
      `/directorProposal/operations/${index}/traceIds`,
      declaredTraceIds,
      "/gameOperatingModel/provenance/traceIds",
      "Operation trace reference must resolve to a declared document trace.",
      issues,
      operationType,
    );
    checkReferenceArray(
      value.affectedAcceptanceTestIds,
      `/directorProposal/operations/${index}/affectedAcceptanceTestIds`,
      acceptanceTestIds,
      "/gameOperatingModel/acceptanceTests",
      "Affected acceptance-test reference must resolve to a final acceptance test.",
      issues,
      operationType,
    );
  });

  return issues;
}

function boundedIssues(issues: readonly GameDocumentIssue[]): GameDocumentIssue[] {
  const unique = new Map<string, GameDocumentIssue>();
  for (const issue of issues) {
    const key = `${issue.code}\u0000${issue.path}\u0000${issue.relatedPath ?? ""}\u0000${issue.message}`;
    if (!unique.has(key)) {
      unique.set(key, issue);
    }
  }
  return [...unique.values()]
    .sort(
      (left, right) =>
        compareText(left.path, right.path) ||
        compareText(left.code, right.code) ||
        compareText(left.relatedPath ?? "", right.relatedPath ?? "") ||
        compareText(left.message, right.message),
    )
    .slice(0, MAX_GAME_DOCUMENT_ISSUES);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function validateGameDocuments(
  gameBrief: unknown,
  gameOperatingModel: unknown,
  operations: readonly unknown[] = [],
): readonly GameDocumentIssue[] {
  return boundedIssues([
    ...collectSchemaIssues(validateGameBrief, gameBrief, "/gameBrief"),
    ...collectSchemaIssues(
      validateGameOperatingModel,
      gameOperatingModel,
      "/gameOperatingModel",
    ),
    ...collectReferenceIssues(gameBrief, gameOperatingModel, operations),
  ]);
}
