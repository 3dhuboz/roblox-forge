import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  validateIntelligenceSemantics,
  type SemanticIssueCode,
  type SemanticValidationResult,
} from "../../src/intelligence/semanticValidation";

type JsonRecord = Record<string, unknown>;

interface GomCollectionCase {
  readonly label: string;
  readonly segments: readonly string[];
}

interface OperationMutationCase {
  readonly type: string;
  readonly expectedCode: SemanticIssueCode;
  readonly mutate: (operation: JsonRecord) => void;
}

const fixture = JSON.parse(
  readFileSync(
    join(
      process.cwd(),
      "schemas",
      "intelligence",
      "fixtures",
      "valid",
      "obby.json",
    ),
    "utf8",
  ),
) as JsonRecord;

function record(value: unknown, label: string): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function records(value: unknown, label: string): JsonRecord[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  value.forEach((item, index) => record(item, `${label}/${index}`));
  return value as JsonRecord[];
}

function clonedDocuments(): { gom: JsonRecord; proposal: JsonRecord } {
  return {
    gom: structuredClone(record(fixture.gameOperatingModel, "gameOperatingModel")),
    proposal: structuredClone(record(fixture.directorProposal, "directorProposal")),
  };
}

function collectionAt(root: JsonRecord, segments: readonly string[]): JsonRecord[] {
  let current: unknown = root;
  for (const segment of segments) {
    current = record(current, segments.join("."))[segment];
  }
  return records(current, segments.join("."));
}

const GOM_ID_COLLECTIONS: readonly GomCollectionCase[] = [
  { label: "objectives", segments: ["objectives"] },
  { label: "progression stages", segments: ["progression", "stages"] },
  { label: "economy sources", segments: ["economy", "sources"] },
  { label: "economy sinks", segments: ["economy", "sinks"] },
  { label: "economy safeguards", segments: ["economy", "safeguards"] },
  { label: "runtime rules", segments: ["runtimeRules"] },
  { label: "scene nodes", segments: ["sceneNodes"] },
  { label: "systems", segments: ["systems"] },
  { label: "feedback", segments: ["feedback"] },
  {
    label: "allowed monetization offers",
    segments: ["monetizationSafety", "allowedOffers"],
  },
  { label: "analytics event contracts", segments: ["analyticsEventContracts"] },
  { label: "acceptance tests", segments: ["acceptanceTests"] },
];

function operationOf(proposal: JsonRecord, type: string): JsonRecord {
  const operation = records(proposal.operations, "directorProposal.operations").find(
    (candidate) => candidate.type === type,
  );
  if (!operation) {
    throw new Error(`Missing operation ${type}`);
  }
  return operation;
}

function expectIssue(
  result: SemanticValidationResult,
  code: SemanticIssueCode,
  operationType?: string,
): void {
  expect(result.valid).toBe(false);
  expect(result.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code,
        ...(operationType === undefined ? {} : { operationType }),
      }),
    ]),
  );
}

const OPERATION_MUTATIONS: readonly OperationMutationCase[] = [
  {
    type: "brief.set_field",
    expectedCode: "inverse_mismatch",
    mutate: (operation) => {
      record(operation.inverse, "operation.inverse").restoreValue =
        "not the before value";
    },
  },
  {
    type: "question.answer",
    expectedCode: "inverse_mismatch",
    mutate: (operation) => {
      record(
        record(operation.inverse, "operation.inverse").restoreAnswer,
        "operation.inverse.restoreAnswer",
      ).response = "not the previous answer";
    },
  },
  {
    type: "scene.add",
    expectedCode: "payload_mismatch",
    mutate: (operation) => {
      record(operation.addedScene, "operation.addedScene").name = "Different scene";
    },
  },
  {
    type: "scene.update",
    expectedCode: "inverse_mismatch",
    mutate: (operation) => {
      record(
        record(operation.inverse, "operation.inverse").restoreScene,
        "operation.inverse.restoreScene",
      ).purpose = "Not the prior scene";
    },
  },
  {
    type: "scene.remove",
    expectedCode: "target_mismatch",
    mutate: (operation) => {
      operation.targetSceneId = "element:wrong-scene";
    },
  },
  {
    type: "objective.add",
    expectedCode: "inverse_mismatch",
    mutate: (operation) => {
      record(operation.inverse, "operation.inverse").removeObjectiveId =
        "objective:wrong-objective";
    },
  },
  {
    type: "objective.update",
    expectedCode: "target_mismatch",
    mutate: (operation) => {
      record(operation.after, "operation.after").id = "objective:wrong-objective";
    },
  },
  {
    type: "objective.remove",
    expectedCode: "inverse_mismatch",
    mutate: (operation) => {
      record(
        record(operation.inverse, "operation.inverse").restoreObjective,
        "operation.inverse.restoreObjective",
      ).title = "Not the removed objective";
    },
  },
  {
    type: "progression.update",
    expectedCode: "target_mismatch",
    mutate: (operation) => {
      operation.targetProgressionId = "progression:wrong-progression";
    },
  },
  {
    type: "economy.update",
    expectedCode: "inverse_mismatch",
    mutate: (operation) => {
      const restore = record(
        record(operation.inverse, "operation.inverse").restoreEconomy,
        "operation.inverse.restoreEconomy",
      );
      records(restore.safeguards, "restoreEconomy.safeguards")[0].rule =
        "Not the prior safeguard";
    },
  },
  {
    type: "runtime_rule.update",
    expectedCode: "target_mismatch",
    mutate: (operation) => {
      record(operation.after, "operation.after").id = "rule:wrong-rule";
    },
  },
  {
    type: "feedback.update",
    expectedCode: "inverse_mismatch",
    mutate: (operation) => {
      record(
        record(operation.inverse, "operation.inverse").restoreFeedback,
        "operation.inverse.restoreFeedback",
      ).message = "Not the prior feedback";
    },
  },
  {
    type: "acceptance_test.update",
    expectedCode: "target_mismatch",
    mutate: (operation) => {
      operation.targetAcceptanceTestId = "acceptance:wrong-test";
    },
  },
];

describe("intelligence semantic validation", () => {
  it("rejects duplicate IDs in a declared GOM collection", () => {
    const { gom, proposal } = clonedDocuments();
    const objectives = records(gom.objectives, "gameOperatingModel.objectives");
    objectives.push(structuredClone(objectives[0]));
    gom.objectives = objectives;

    const result = validateIntelligenceSemantics(gom, proposal);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate_id", path: "/gameOperatingModel/objectives/1/id" }),
      ]),
    );
  });

  it.each(GOM_ID_COLLECTIONS)(
    "rejects duplicate IDs in $label",
    ({ segments }) => {
      const { gom, proposal } = clonedDocuments();
      const collection = collectionAt(gom, segments);
      collection.push(structuredClone(collection[0]));

      const result = validateIntelligenceSemantics(gom, proposal);
      const collectionPath = `/gameOperatingModel/${segments.join("/")}`;

      expect(result.valid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "duplicate_id",
            path: `${collectionPath}/${collection.length - 1}/id`,
          }),
        ]),
      );
    },
  );

  it("reports every duplicate occurrence instead of collapsing duplicate IDs", () => {
    const { gom, proposal } = clonedDocuments();
    const objectives = collectionAt(gom, ["objectives"]);
    objectives.push(structuredClone(objectives[0]), structuredClone(objectives[0]));

    const result = validateIntelligenceSemantics(gom, proposal);

    expect(
      result.issues.filter(
        (issue) =>
          issue.code === "duplicate_id" &&
          issue.path.startsWith("/gameOperatingModel/objectives/"),
      ),
    ).toHaveLength(2);
  });

  it("rejects duplicate Director operation IDs", () => {
    const { gom, proposal } = clonedDocuments();
    const operations = records(proposal.operations, "directorProposal.operations");
    operations[1].id = operations[0].id;

    const result = validateIntelligenceSemantics(gom, proposal);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "duplicate_id",
          path: "/directorProposal/operations/1/id",
        }),
      ]),
    );
  });

  it("rejects a Director operation whose inverse does not restore before", () => {
    const { gom, proposal } = clonedDocuments();
    const operation = records(proposal.operations, "directorProposal.operations")[0];
    record(operation.inverse, "operation.inverse").restoreValue = "not the before value";

    const result = validateIntelligenceSemantics(gom, proposal);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "inverse_mismatch", path: "/directorProposal/operations/0/inverse/restoreValue" }),
      ]),
    );
  });

  it("accepts the coherent GOM and Director proposal", () => {
    const { gom, proposal } = clonedDocuments();

    expect(validateIntelligenceSemantics(gom, proposal)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it("returns structured issues for non-record inputs", () => {
    const result = validateIntelligenceSemantics(null, []);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_document",
          path: "/gameOperatingModel",
        }),
        expect.objectContaining({
          code: "invalid_document",
          path: "/directorProposal",
        }),
      ]),
    );
  });

  it("requires proposal model identity, revision, and hash to match the GOM", () => {
    const { gom, proposal } = clonedDocuments();
    proposal.baseModelId = "gom:wrong-model";
    proposal.baseModelRevision = 999;
    proposal.baseModelHash = `sha256:${"f".repeat(64)}`;

    const result = validateIntelligenceSemantics(gom, proposal);

    expect(result.issues.filter((issue) => issue.code === "model_mismatch")).toHaveLength(
      3,
    );
  });

  it.each(OPERATION_MUTATIONS)(
    "rejects a non-reversible $type operation",
    ({ type, expectedCode, mutate }) => {
      const { gom, proposal } = clonedDocuments();
      mutate(operationOf(proposal, type));

      expectIssue(
        validateIntelligenceSemantics(gom, proposal),
        expectedCode,
        type,
      );
    },
  );

  it.each([
    ["scene.add", "addedScene", "removeSceneId"],
    ["objective.add", "addedObjective", "removeObjectiveId"],
  ])(
    "enforces exact payload and inverse target semantics for %s",
    (type, addedKey, inverseKey) => {
      const payloadMismatch = clonedDocuments();
      const payloadOperation = operationOf(payloadMismatch.proposal, type);
      record(payloadOperation[addedKey], addedKey).traceIds = ["trace:mismatch"];
      expectIssue(
        validateIntelligenceSemantics(payloadMismatch.gom, payloadMismatch.proposal),
        "payload_mismatch",
        type,
      );

      const inverseMismatch = clonedDocuments();
      const inverseOperation = operationOf(inverseMismatch.proposal, type);
      record(inverseOperation.inverse, "operation.inverse")[inverseKey] =
        "entity:mismatch";
      expectIssue(
        validateIntelligenceSemantics(inverseMismatch.gom, inverseMismatch.proposal),
        "inverse_mismatch",
        type,
      );
    },
  );

  it.each([
    ["scene.update", "targetSceneId", "restoreScene"],
    ["objective.update", "targetObjectiveId", "restoreObjective"],
    ["progression.update", "targetProgressionId", "restoreProgression"],
    ["economy.update", "targetEconomyId", "restoreEconomy"],
    ["runtime_rule.update", "targetRuntimeRuleId", "restoreRuntimeRule"],
    ["feedback.update", "targetFeedbackId", "restoreFeedback"],
    ["acceptance_test.update", "targetAcceptanceTestId", "restoreAcceptanceTest"],
  ])(
    "enforces target identity and exact inverse restoration for %s",
    (type, targetKey, inverseKey) => {
      const targetMismatch = clonedDocuments();
      operationOf(targetMismatch.proposal, type)[targetKey] = "entity:mismatch";
      expectIssue(
        validateIntelligenceSemantics(targetMismatch.gom, targetMismatch.proposal),
        "target_mismatch",
        type,
      );

      const inverseMismatch = clonedDocuments();
      const inverseOperation = operationOf(inverseMismatch.proposal, type);
      record(
        record(inverseOperation.inverse, "operation.inverse")[inverseKey],
        inverseKey,
      ).traceIds = ["trace:mismatch"];
      expectIssue(
        validateIntelligenceSemantics(inverseMismatch.gom, inverseMismatch.proposal),
        "inverse_mismatch",
        type,
      );
    },
  );

  it.each([
    ["scene.remove", "targetSceneId", "restoreScene"],
    ["objective.remove", "targetObjectiveId", "restoreObjective"],
  ])(
    "enforces target, absent after-state, and exact inverse restoration for %s",
    (type, targetKey, inverseKey) => {
      const { gom, proposal } = clonedDocuments();
      const operation = operationOf(proposal, type);
      operation[targetKey] = "entity:mismatch";
      record(operation.after, "operation.after").absent = false;
      record(
        record(operation.inverse, "operation.inverse")[inverseKey],
        inverseKey,
      ).traceIds = ["trace:mismatch"];

      const result = validateIntelligenceSemantics(gom, proposal);
      expectIssue(result, "target_mismatch", type);
      expectIssue(result, "payload_mismatch", type);
      expectIssue(result, "inverse_mismatch", type);
    },
  );

  it("uses structural equality rather than object-key serialization order", () => {
    const { gom, proposal } = clonedDocuments();
    const operation = operationOf(proposal, "scene.update");
    const before = record(operation.before, "operation.before");
    record(operation.inverse, "operation.inverse").restoreScene =
      Object.fromEntries(Object.entries(before).reverse());

    expect(validateIntelligenceSemantics(gom, proposal)).toEqual({
      valid: true,
      issues: [],
    });
  });
});
