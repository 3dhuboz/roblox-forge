export type SemanticIssueCode =
  | "invalid_document"
  | "model_mismatch"
  | "duplicate_id"
  | "target_mismatch"
  | "payload_mismatch"
  | "inverse_mismatch";

export interface SemanticIssue {
  readonly code: SemanticIssueCode;
  readonly path: string;
  readonly message: string;
  readonly relatedPath?: string;
  readonly id?: string;
  readonly operationType?: string;
}

export interface SemanticValidationResult {
  readonly valid: boolean;
  readonly issues: readonly SemanticIssue[];
}

type JsonRecord = Record<string, unknown>;

interface UpdateOperationContract {
  readonly targetKey: string;
  readonly inverseKey: string;
}

interface AddOperationContract {
  readonly addedKey: string;
  readonly inverseIdKey: string;
}

interface RemoveOperationContract {
  readonly targetKey: string;
  readonly inverseKey: string;
}

const UPDATE_OPERATION_CONTRACTS: Readonly<
  Record<string, UpdateOperationContract>
> = {
  "scene.update": {
    targetKey: "targetSceneId",
    inverseKey: "restoreScene",
  },
  "objective.update": {
    targetKey: "targetObjectiveId",
    inverseKey: "restoreObjective",
  },
  "progression.update": {
    targetKey: "targetProgressionId",
    inverseKey: "restoreProgression",
  },
  "economy.update": {
    targetKey: "targetEconomyId",
    inverseKey: "restoreEconomy",
  },
  "runtime_rule.update": {
    targetKey: "targetRuntimeRuleId",
    inverseKey: "restoreRuntimeRule",
  },
  "feedback.update": {
    targetKey: "targetFeedbackId",
    inverseKey: "restoreFeedback",
  },
  "acceptance_test.update": {
    targetKey: "targetAcceptanceTestId",
    inverseKey: "restoreAcceptanceTest",
  },
};

const ADD_OPERATION_CONTRACTS: Readonly<Record<string, AddOperationContract>> = {
  "scene.add": {
    addedKey: "addedScene",
    inverseIdKey: "removeSceneId",
  },
  "objective.add": {
    addedKey: "addedObjective",
    inverseIdKey: "removeObjectiveId",
  },
};

const REMOVE_OPERATION_CONTRACTS: Readonly<
  Record<string, RemoveOperationContract>
> = {
  "scene.remove": {
    targetKey: "targetSceneId",
    inverseKey: "restoreScene",
  },
  "objective.remove": {
    targetKey: "targetObjectiveId",
    inverseKey: "restoreObjective",
  },
};

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function deepEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => deepEqual(item, right[index]))
    );
  }

  if (!isRecord(left) || !isRecord(right)) {
    return false;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) => hasOwn(right, key) && deepEqual(left[key], right[key]),
    )
  );
}

function addIssue(
  issues: SemanticIssue[],
  issue: SemanticIssue,
): void {
  issues.push(issue);
}

function recordAt(
  value: unknown,
  path: string,
  issues: SemanticIssue[],
  operationType?: string,
): JsonRecord | undefined {
  if (isRecord(value)) {
    return value;
  }
  addIssue(issues, {
    code: "invalid_document",
    path,
    message: "Expected a parsed JSON object at this path.",
    operationType,
  });
  return undefined;
}

function reportDuplicateIds(
  value: unknown,
  path: string,
  issues: SemanticIssue[],
): void {
  if (Array.isArray(value)) {
    const firstPathById = new Map<string, string>();
    value.forEach((item, index) => {
      if (isRecord(item) && typeof item.id === "string") {
        const idPath = `${path}/${index}/id`;
        const firstPath = firstPathById.get(item.id);
        if (firstPath === undefined) {
          firstPathById.set(item.id, idPath);
        } else {
          addIssue(issues, {
            code: "duplicate_id",
            path: idPath,
            relatedPath: firstPath,
            id: item.id,
            message: `ID ${item.id} duplicates an earlier item in this collection.`,
          });
        }
      }
      reportDuplicateIds(item, `${path}/${index}`, issues);
    });
    return;
  }

  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      reportDuplicateIds(child, `${path}/${key}`, issues);
    }
  }
}

function compareModelField(
  gom: JsonRecord,
  proposal: JsonRecord,
  proposalKey: string,
  gomKey: string,
  issues: SemanticIssue[],
): void {
  if (!deepEqual(proposal[proposalKey], gom[gomKey])) {
    addIssue(issues, {
      code: "model_mismatch",
      path: `/directorProposal/${proposalKey}`,
      relatedPath: `/gameOperatingModel/${gomKey}`,
      message: `Director proposal ${proposalKey} must match GOM ${gomKey}.`,
    });
  }
}

function validateBriefOperation(
  operation: JsonRecord,
  index: number,
  gom: JsonRecord,
  issues: SemanticIssue[],
): void {
  const type = "brief.set_field";
  const path = `/directorProposal/operations/${index}`;
  if (operation.targetBriefId !== gom.briefId) {
    addIssue(issues, {
      code: "target_mismatch",
      path: `${path}/targetBriefId`,
      relatedPath: "/gameOperatingModel/briefId",
      message: "Brief operation must target the GOM brief.",
      operationType: type,
    });
  }

  const before = recordAt(operation.before, `${path}/before`, issues, type);
  const inverse = recordAt(operation.inverse, `${path}/inverse`, issues, type);
  if (before && inverse && !deepEqual(inverse.restoreValue, before.value)) {
    addIssue(issues, {
      code: "inverse_mismatch",
      path: `${path}/inverse/restoreValue`,
      relatedPath: `${path}/before/value`,
      message: "Brief inverse must restore the exact before value.",
      operationType: type,
    });
  }
}

function validateQuestionOperation(
  operation: JsonRecord,
  index: number,
  issues: SemanticIssue[],
): void {
  const type = "question.answer";
  const path = `/directorProposal/operations/${index}`;
  const before = recordAt(operation.before, `${path}/before`, issues, type);
  const inverse = recordAt(operation.inverse, `${path}/inverse`, issues, type);
  if (before && inverse && !deepEqual(inverse.restoreAnswer, before)) {
    addIssue(issues, {
      code: "inverse_mismatch",
      path: `${path}/inverse/restoreAnswer`,
      relatedPath: `${path}/before`,
      message: "Question inverse must restore the exact before answer.",
      operationType: type,
    });
  }
}

function validateAddOperation(
  operation: JsonRecord,
  index: number,
  type: string,
  contract: AddOperationContract,
  issues: SemanticIssue[],
): void {
  const path = `/directorProposal/operations/${index}`;
  const before = recordAt(operation.before, `${path}/before`, issues, type);
  const added = recordAt(
    operation[contract.addedKey],
    `${path}/${contract.addedKey}`,
    issues,
    type,
  );
  const after = recordAt(operation.after, `${path}/after`, issues, type);
  const inverse = recordAt(operation.inverse, `${path}/inverse`, issues, type);

  if (before && before.absent !== true) {
    addIssue(issues, {
      code: "payload_mismatch",
      path: `${path}/before/absent`,
      message: "Add operations must start from an absent state.",
      operationType: type,
    });
  }
  if (added && after && !deepEqual(added, after)) {
    addIssue(issues, {
      code: "payload_mismatch",
      path: `${path}/${contract.addedKey}`,
      relatedPath: `${path}/after`,
      message: "Added payload must exactly equal the after entity.",
      operationType: type,
    });
  }
  if (
    added &&
    inverse &&
    (typeof added.id !== "string" || inverse[contract.inverseIdKey] !== added.id)
  ) {
    addIssue(issues, {
      code: "inverse_mismatch",
      path: `${path}/inverse/${contract.inverseIdKey}`,
      relatedPath: `${path}/${contract.addedKey}/id`,
      message: "Add inverse must remove the exact added entity ID.",
      operationType: type,
    });
  }
}

function validateUpdateOperation(
  operation: JsonRecord,
  index: number,
  type: string,
  contract: UpdateOperationContract,
  issues: SemanticIssue[],
): void {
  const path = `/directorProposal/operations/${index}`;
  const target = operation[contract.targetKey];
  const before = recordAt(operation.before, `${path}/before`, issues, type);
  const after = recordAt(operation.after, `${path}/after`, issues, type);
  const inverse = recordAt(operation.inverse, `${path}/inverse`, issues, type);
  const restored = inverse
    ? recordAt(
        inverse[contract.inverseKey],
        `${path}/inverse/${contract.inverseKey}`,
        issues,
        type,
      )
    : undefined;

  const identities: readonly (readonly [unknown, string])[] = [
    [before?.id, `${path}/before/id`],
    [after?.id, `${path}/after/id`],
    [restored?.id, `${path}/inverse/${contract.inverseKey}/id`],
  ];
  for (const [identity, identityPath] of identities) {
    if (identity !== target) {
      addIssue(issues, {
        code: "target_mismatch",
        path: identityPath,
        relatedPath: `${path}/${contract.targetKey}`,
        message: "Update target must match before, after, and restored entity IDs.",
        operationType: type,
      });
    }
  }
  if (before && restored && !deepEqual(restored, before)) {
    addIssue(issues, {
      code: "inverse_mismatch",
      path: `${path}/inverse/${contract.inverseKey}`,
      relatedPath: `${path}/before`,
      message: "Update inverse must restore the exact before entity.",
      operationType: type,
    });
  }
}

function validateRemoveOperation(
  operation: JsonRecord,
  index: number,
  type: string,
  contract: RemoveOperationContract,
  issues: SemanticIssue[],
): void {
  const path = `/directorProposal/operations/${index}`;
  const target = operation[contract.targetKey];
  const before = recordAt(operation.before, `${path}/before`, issues, type);
  const after = recordAt(operation.after, `${path}/after`, issues, type);
  const inverse = recordAt(operation.inverse, `${path}/inverse`, issues, type);
  const restored = inverse
    ? recordAt(
        inverse[contract.inverseKey],
        `${path}/inverse/${contract.inverseKey}`,
        issues,
        type,
      )
    : undefined;

  if (before?.id !== target) {
    addIssue(issues, {
      code: "target_mismatch",
      path: `${path}/before/id`,
      relatedPath: `${path}/${contract.targetKey}`,
      message: "Remove target must match the before entity ID.",
      operationType: type,
    });
  }
  if (restored?.id !== target) {
    addIssue(issues, {
      code: "target_mismatch",
      path: `${path}/inverse/${contract.inverseKey}/id`,
      relatedPath: `${path}/${contract.targetKey}`,
      message: "Remove inverse must re-add the target entity ID.",
      operationType: type,
    });
  }
  if (after && after.absent !== true) {
    addIssue(issues, {
      code: "payload_mismatch",
      path: `${path}/after/absent`,
      message: "Remove operations must end in an absent state.",
      operationType: type,
    });
  }
  if (before && restored && !deepEqual(restored, before)) {
    addIssue(issues, {
      code: "inverse_mismatch",
      path: `${path}/inverse/${contract.inverseKey}`,
      relatedPath: `${path}/before`,
      message: "Remove inverse must re-add the exact before entity.",
      operationType: type,
    });
  }
}

function validateOperation(
  operation: JsonRecord,
  index: number,
  gom: JsonRecord,
  issues: SemanticIssue[],
): void {
  const type = operation.type;
  if (typeof type !== "string") {
    addIssue(issues, {
      code: "invalid_document",
      path: `/directorProposal/operations/${index}/type`,
      message: "Operation type must be a string.",
    });
    return;
  }
  if (type === "brief.set_field") {
    validateBriefOperation(operation, index, gom, issues);
    return;
  }
  if (type === "question.answer") {
    validateQuestionOperation(operation, index, issues);
    return;
  }
  const addContract = ADD_OPERATION_CONTRACTS[type];
  if (addContract) {
    validateAddOperation(operation, index, type, addContract, issues);
    return;
  }
  const updateContract = UPDATE_OPERATION_CONTRACTS[type];
  if (updateContract) {
    validateUpdateOperation(operation, index, type, updateContract, issues);
    return;
  }
  const removeContract = REMOVE_OPERATION_CONTRACTS[type];
  if (removeContract) {
    validateRemoveOperation(operation, index, type, removeContract, issues);
    return;
  }
  addIssue(issues, {
    code: "invalid_document",
    path: `/directorProposal/operations/${index}/type`,
    message: `Unsupported operation type ${type}.`,
    operationType: type,
  });
}

export function validateIntelligenceSemantics(
  gameOperatingModel: unknown,
  directorProposal: unknown,
): SemanticValidationResult {
  const issues: SemanticIssue[] = [];
  const gom = recordAt(gameOperatingModel, "/gameOperatingModel", issues);
  const proposal = recordAt(directorProposal, "/directorProposal", issues);
  if (!gom || !proposal) {
    return { valid: false, issues };
  }

  compareModelField(gom, proposal, "baseModelId", "id", issues);
  compareModelField(gom, proposal, "baseModelRevision", "revision", issues);
  compareModelField(gom, proposal, "baseModelHash", "hash", issues);

  reportDuplicateIds(gom, "/gameOperatingModel", issues);

  if (!Array.isArray(proposal.operations)) {
    addIssue(issues, {
      code: "invalid_document",
      path: "/directorProposal/operations",
      message: "Director proposal operations must be an array.",
    });
  } else {
    reportDuplicateIds(proposal.operations, "/directorProposal/operations", issues);
    proposal.operations.forEach((value, index) => {
      const operation = recordAt(
        value,
        `/directorProposal/operations/${index}`,
        issues,
      );
      if (operation) {
        validateOperation(operation, index, gom, issues);
      }
    });
  }

  return { valid: issues.length === 0, issues };
}
