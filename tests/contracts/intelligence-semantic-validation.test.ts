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

interface OperationChainCase {
  readonly label: string;
  readonly operations: (proposal: JsonRecord) => JsonRecord[];
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

function clonedDocuments(): {
  brief: JsonRecord;
  gom: JsonRecord;
  proposal: JsonRecord;
} {
  return {
    brief: structuredClone(record(fixture.gameBrief, "gameBrief")),
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

function chainedUpdatePair(
  proposal: JsonRecord,
  type: string,
  inverseKey: string,
): JsonRecord[] {
  const first = structuredClone(operationOf(proposal, type));
  const second = structuredClone(first);
  second.id = `${String(first.id)}-chain`;
  second.before = structuredClone(first.after);
  record(second.inverse, `${type}.inverse`)[inverseKey] =
    structuredClone(first.after);
  return [first, second];
}

const OPERATION_CHAIN_CASES: readonly OperationChainCase[] = [
  {
    label: "Brief field",
    operations: (proposal) => {
      const first = structuredClone(operationOf(proposal, "brief.set_field"));
      const second = structuredClone(first);
      second.id = `${String(first.id)}-chain`;
      second.before = structuredClone(first.after);
      record(second.inverse, "brief.inverse").restoreValue =
        record(first.after, "brief.after").value;
      return [first, second];
    },
  },
  {
    label: "material question",
    operations: (proposal) => {
      const first = structuredClone(operationOf(proposal, "question.answer"));
      const second = structuredClone(first);
      second.id = `${String(first.id)}-chain`;
      second.before = structuredClone(first.after);
      record(second.inverse, "question.inverse").restoreAnswer =
        structuredClone(first.after);
      return [first, second];
    },
  },
  {
    label: "scene collection",
    operations: (proposal) => {
      const types = new Set(["scene.add", "scene.update", "scene.remove"]);
      const operations = records(proposal.operations, "operations")
        .filter((operation) => types.has(String(operation.type)))
        .map((operation) => structuredClone(operation));
      record(operationOf({ operations }, "scene.remove").inverse, "scene.remove.inverse")
        .restoreIndex = 0;
      return operations;
    },
  },
  {
    label: "objective collection",
    operations: (proposal) => {
      const types = new Set([
        "objective.add",
        "objective.update",
        "objective.remove",
      ]);
      const operations = records(proposal.operations, "operations")
        .filter((operation) => types.has(String(operation.type)))
        .map((operation) => structuredClone(operation));
      record(
        operationOf({ operations }, "objective.remove").inverse,
        "objective.remove.inverse",
      ).restoreIndex = 1;
      return operations;
    },
  },
  {
    label: "progression",
    operations: (proposal) =>
      chainedUpdatePair(
        proposal,
        "progression.update",
        "restoreProgression",
      ),
  },
  {
    label: "economy",
    operations: (proposal) =>
      chainedUpdatePair(proposal, "economy.update", "restoreEconomy"),
  },
  {
    label: "runtime rule",
    operations: (proposal) =>
      chainedUpdatePair(
        proposal,
        "runtime_rule.update",
        "restoreRuntimeRule",
      ),
  },
  {
    label: "feedback",
    operations: (proposal) =>
      chainedUpdatePair(proposal, "feedback.update", "restoreFeedback"),
  },
  {
    label: "acceptance test",
    operations: (proposal) =>
      chainedUpdatePair(
        proposal,
        "acceptance_test.update",
        "restoreAcceptanceTest",
      ),
  },
];

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
    const { brief, gom, proposal } = clonedDocuments();
    const objectives = records(gom.objectives, "gameOperatingModel.objectives");
    objectives.push(structuredClone(objectives[0]));
    gom.objectives = objectives;

    const result = validateIntelligenceSemantics(brief, gom, proposal);

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
      const { brief, gom, proposal } = clonedDocuments();
      const collection = collectionAt(gom, segments);
      collection.push(structuredClone(collection[0]));

      const result = validateIntelligenceSemantics(brief, gom, proposal);
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
    const { brief, gom, proposal } = clonedDocuments();
    const objectives = collectionAt(gom, ["objectives"]);
    objectives.push(structuredClone(objectives[0]), structuredClone(objectives[0]));

    const result = validateIntelligenceSemantics(brief, gom, proposal);

    expect(
      result.issues.filter(
        (issue) =>
          issue.code === "duplicate_id" &&
          issue.path.startsWith("/gameOperatingModel/objectives/"),
      ),
    ).toHaveLength(2);
  });

  it("rejects duplicate Director operation IDs", () => {
    const { brief, gom, proposal } = clonedDocuments();
    const operations = records(proposal.operations, "directorProposal.operations");
    operations[1].id = operations[0].id;

    const result = validateIntelligenceSemantics(brief, gom, proposal);

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
    const { brief, gom, proposal } = clonedDocuments();
    const operation = records(proposal.operations, "directorProposal.operations")[0];
    record(operation.inverse, "operation.inverse").restoreValue = "not the before value";

    const result = validateIntelligenceSemantics(brief, gom, proposal);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "inverse_mismatch", path: "/directorProposal/operations/0/inverse/restoreValue" }),
      ]),
    );
  });

  it("accepts the coherent Brief, GOM, and Director proposal", () => {
    const { brief, gom, proposal } = clonedDocuments();

    expect(validateIntelligenceSemantics(brief, gom, proposal)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it("returns structured issues for non-record inputs", () => {
    const result = validateIntelligenceSemantics(null, [], undefined);

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "invalid_document",
          path: "/gameBrief",
        }),
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
    const { brief, gom, proposal } = clonedDocuments();
    proposal.baseModelId = "gom:wrong-model";
    proposal.baseModelRevision = 999;
    proposal.baseModelHash = `sha256:${"f".repeat(64)}`;

    const result = validateIntelligenceSemantics(brief, gom, proposal);

    expect(result.issues.filter((issue) => issue.code === "model_mismatch")).toHaveLength(
      3,
    );
  });

  it.each(OPERATION_MUTATIONS)(
    "rejects a non-reversible $type operation",
    ({ type, expectedCode, mutate }) => {
      const { brief, gom, proposal } = clonedDocuments();
      mutate(operationOf(proposal, type));

      expectIssue(
        validateIntelligenceSemantics(brief, gom, proposal),
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
        validateIntelligenceSemantics(
          payloadMismatch.brief,
          payloadMismatch.gom,
          payloadMismatch.proposal,
        ),
        "payload_mismatch",
        type,
      );

      const inverseMismatch = clonedDocuments();
      const inverseOperation = operationOf(inverseMismatch.proposal, type);
      record(inverseOperation.inverse, "operation.inverse")[inverseKey] =
        "entity:mismatch";
      expectIssue(
        validateIntelligenceSemantics(
          inverseMismatch.brief,
          inverseMismatch.gom,
          inverseMismatch.proposal,
        ),
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
        validateIntelligenceSemantics(
          targetMismatch.brief,
          targetMismatch.gom,
          targetMismatch.proposal,
        ),
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
        validateIntelligenceSemantics(
          inverseMismatch.brief,
          inverseMismatch.gom,
          inverseMismatch.proposal,
        ),
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
      const { brief, gom, proposal } = clonedDocuments();
      const operation = operationOf(proposal, type);
      operation[targetKey] = "entity:mismatch";
      record(operation.after, "operation.after").absent = false;
      record(
        record(operation.inverse, "operation.inverse")[inverseKey],
        inverseKey,
      ).traceIds = ["trace:mismatch"];

      const result = validateIntelligenceSemantics(brief, gom, proposal);
      expectIssue(result, "target_mismatch", type);
      expectIssue(result, "payload_mismatch", type);
      expectIssue(result, "inverse_mismatch", type);
    },
  );

  it("uses structural equality rather than object-key serialization order", () => {
    const { brief, gom, proposal } = clonedDocuments();
    const operation = operationOf(proposal, "scene.update");
    const before = record(operation.before, "operation.before");
    record(operation.inverse, "operation.inverse").restoreScene =
      Object.fromEntries(Object.entries(before).reverse());

    expect(validateIntelligenceSemantics(brief, gom, proposal)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it("rejects an update whose declared before value is fabricated", () => {
    const { brief, gom, proposal } = clonedDocuments();
    const operation = operationOf(proposal, "scene.update");
    const fabricatedBefore = structuredClone(record(operation.before, "before"));
    fabricatedBefore.purpose = "A fabricated current purpose";
    operation.before = fabricatedBefore;
    record(operation.inverse, "inverse").restoreScene =
      structuredClone(fabricatedBefore);
    proposal.operations = [operation];

    expectIssue(
      validateIntelligenceSemantics(brief, gom, proposal),
      "payload_mismatch",
      "scene.update",
    );
  });

  it("rejects an add whose ID already exists in the evolving collection", () => {
    const { brief, gom, proposal } = clonedDocuments();
    const operation = operationOf(proposal, "scene.add");
    const existingScene = structuredClone(records(gom.sceneNodes, "sceneNodes")[0]);
    operation.addedScene = structuredClone(existingScene);
    operation.after = structuredClone(existingScene);
    record(operation.inverse, "inverse").removeSceneId = existingScene.id;
    proposal.operations = [operation];

    expectIssue(
      validateIntelligenceSemantics(brief, gom, proposal),
      "duplicate_id",
      "scene.add",
    );
  });

  it("uses restoreIndex to undo a middle removal without changing array order", () => {
    const { brief, gom, proposal } = clonedDocuments();
    const operation = operationOf(proposal, "scene.remove");
    const originalScene = structuredClone(records(gom.sceneNodes, "sceneNodes")[0]);
    const precedingScene = structuredClone(originalScene);
    precedingScene.id = "element:preceding-scene";
    const followingScene = structuredClone(originalScene);
    followingScene.id = "element:following-scene";
    gom.sceneNodes = [precedingScene, originalScene, followingScene];
    operation.targetSceneId = originalScene.id;
    operation.before = structuredClone(originalScene);
    const inverse = record(operation.inverse, "inverse");
    inverse.restoreScene = structuredClone(originalScene);
    inverse.restoreIndex = 1;
    proposal.operations = [operation];

    expect(validateIntelligenceSemantics(brief, gom, proposal)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it("rejects an update whose target is absent from the evolving collection", () => {
    const { brief, gom, proposal } = clonedDocuments();
    const operation = operationOf(proposal, "runtime_rule.update");
    const missingId = "rule:not-in-the-model";
    operation.targetRuntimeRuleId = missingId;
    record(operation.before, "before").id = missingId;
    record(operation.after, "after").id = missingId;
    record(
      record(operation.inverse, "inverse").restoreRuntimeRule,
      "restoreRuntimeRule",
    ).id = missingId;
    proposal.operations = [operation];

    expectIssue(
      validateIntelligenceSemantics(brief, gom, proposal),
      "target_mismatch",
      "runtime_rule.update",
    );
  });

  it("rejects a question operation for a question outside the Game Brief", () => {
    const { brief, gom, proposal } = clonedDocuments();
    const operation = operationOf(proposal, "question.answer");
    operation.targetQuestionId = "question:not-in-the-brief";
    proposal.operations = [operation];

    expectIssue(
      validateIntelligenceSemantics(brief, gom, proposal),
      "target_mismatch",
      "question.answer",
    );
  });

  it("rejects a duplicate ID produced only after an earlier chained add", () => {
    const { brief, gom, proposal } = clonedDocuments();
    const first = structuredClone(operationOf(proposal, "scene.add"));
    const second = structuredClone(first);
    second.id = `${String(first.id)}-chain`;
    proposal.operations = [first, second];

    expectIssue(
      validateIntelligenceSemantics(brief, gom, proposal),
      "duplicate_id",
      "scene.add",
    );
  });

  it.each(OPERATION_CHAIN_CASES)(
    "applies chained $label operations against the prior operation's result",
    ({ operations }) => {
      const { brief, gom, proposal } = clonedDocuments();
      proposal.operations = operations(proposal);

      expect(validateIntelligenceSemantics(brief, gom, proposal)).toEqual({
        valid: true,
        issues: [],
      });
    },
  );

  it("rejects a restoreIndex that cannot reproduce the original array order", () => {
    const { brief, gom, proposal } = clonedDocuments();
    const operation = operationOf(proposal, "scene.remove");
    const originalScene = structuredClone(records(gom.sceneNodes, "sceneNodes")[0]);
    const precedingScene = structuredClone(originalScene);
    precedingScene.id = "element:preceding-scene";
    gom.sceneNodes = [precedingScene, originalScene];
    operation.targetSceneId = originalScene.id;
    operation.before = structuredClone(originalScene);
    const inverse = record(operation.inverse, "inverse");
    inverse.restoreScene = structuredClone(originalScene);
    inverse.restoreIndex = 0;
    proposal.operations = [operation];

    expectIssue(
      validateIntelligenceSemantics(brief, gom, proposal),
      "inverse_mismatch",
      "scene.remove",
    );
  });

  it("rejects first-operation preconditions that drift from the immutable proposal base", () => {
    const { brief, gom, proposal } = clonedDocuments();
    const operation = records(proposal.operations, "operations")[0];
    const precondition = record(operation.precondition, "precondition");
    precondition.baseRevision = Number(proposal.baseModelRevision) + 1;
    precondition.expectedModelHash = `sha256:${"f".repeat(64)}`;

    const result = validateIntelligenceSemantics(brief, gom, proposal);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "precondition_mismatch",
          path: "/directorProposal/operations/0/precondition/baseRevision",
          operationType: "brief.set_field",
        }),
        expect.objectContaining({
          code: "precondition_mismatch",
          path: "/directorProposal/operations/0/precondition/expectedModelHash",
          operationType: "brief.set_field",
        }),
      ]),
    );
  });

  it("rejects later chained preconditions that drift after valid evolving changes", () => {
    const { brief, gom, proposal } = clonedDocuments();
    const [first, second] = chainedUpdatePair(
      proposal,
      "progression.update",
      "restoreProgression",
    );
    const precondition = record(second.precondition, "second.precondition");
    precondition.baseRevision = Number(gom.revision) + 1;
    precondition.expectedModelHash = `sha256:${"e".repeat(64)}`;
    proposal.operations = [first, second];

    const result = validateIntelligenceSemantics(brief, gom, proposal);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "precondition_mismatch",
          path: "/directorProposal/operations/1/precondition/baseRevision",
          operationType: "progression.update",
        }),
        expect.objectContaining({
          code: "precondition_mismatch",
          path: "/directorProposal/operations/1/precondition/expectedModelHash",
          operationType: "progression.update",
        }),
      ]),
    );
  });
});
