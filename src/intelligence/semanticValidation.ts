import { validateGameDocuments } from "./gameDocumentValidation";

export type SemanticIssueCode =
  | "invalid_document"
  | "model_mismatch"
  | "duplicate_id"
  | "target_mismatch"
  | "payload_mismatch"
  | "inverse_mismatch"
  | "precondition_mismatch"
  | "schema_mismatch"
  | "reference_mismatch";

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
  readonly collectionKey?: string;
  readonly recordKey?: string;
}

interface AddOperationContract {
  readonly addedKey: string;
  readonly inverseIdKey: string;
  readonly collectionKey: string;
}

interface RemoveOperationContract {
  readonly targetKey: string;
  readonly inverseKey: string;
  readonly collectionKey: string;
}

interface AppliedOperation {
  readonly operation: JsonRecord;
  readonly index: number;
  readonly beforeBrief: JsonRecord;
  readonly beforeGom: JsonRecord;
}

const UPDATE_OPERATION_CONTRACTS: Readonly<
  Record<string, UpdateOperationContract>
> = {
  "scene.update": {
    targetKey: "targetSceneId",
    inverseKey: "restoreScene",
    collectionKey: "sceneNodes",
  },
  "objective.update": {
    targetKey: "targetObjectiveId",
    inverseKey: "restoreObjective",
    collectionKey: "objectives",
  },
  "progression.update": {
    targetKey: "targetProgressionId",
    inverseKey: "restoreProgression",
    recordKey: "progression",
  },
  "economy.update": {
    targetKey: "targetEconomyId",
    inverseKey: "restoreEconomy",
    recordKey: "economy",
  },
  "runtime_rule.update": {
    targetKey: "targetRuntimeRuleId",
    inverseKey: "restoreRuntimeRule",
    collectionKey: "runtimeRules",
  },
  "feedback.update": {
    targetKey: "targetFeedbackId",
    inverseKey: "restoreFeedback",
    collectionKey: "feedback",
  },
  "acceptance_test.update": {
    targetKey: "targetAcceptanceTestId",
    inverseKey: "restoreAcceptanceTest",
    collectionKey: "acceptanceTests",
  },
};

const ADD_OPERATION_CONTRACTS: Readonly<Record<string, AddOperationContract>> = {
  "scene.add": {
    addedKey: "addedScene",
    inverseIdKey: "removeSceneId",
    collectionKey: "sceneNodes",
  },
  "objective.add": {
    addedKey: "addedObjective",
    inverseIdKey: "removeObjectiveId",
    collectionKey: "objectives",
  },
};

const REMOVE_OPERATION_CONTRACTS: Readonly<
  Record<string, RemoveOperationContract>
> = {
  "scene.remove": {
    targetKey: "targetSceneId",
    inverseKey: "restoreScene",
    collectionKey: "sceneNodes",
  },
  "objective.remove": {
    targetKey: "targetObjectiveId",
    inverseKey: "restoreObjective",
    collectionKey: "objectives",
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

function validateOperationPrecondition(
  operation: JsonRecord,
  index: number,
  proposal: JsonRecord,
  gom: JsonRecord,
  issues: SemanticIssue[],
): void {
  const path = `/directorProposal/operations/${index}`;
  const operationType =
    typeof operation.type === "string" ? operation.type : "unknown";
  const precondition = recordAt(
    operation.precondition,
    `${path}/precondition`,
    issues,
    operationType,
  );
  if (!precondition) {
    return;
  }

  if (
    precondition.baseRevision !== proposal.baseModelRevision ||
    proposal.baseModelRevision !== gom.revision
  ) {
    addIssue(issues, {
      code: "precondition_mismatch",
      path: `${path}/precondition/baseRevision`,
      relatedPath: "/directorProposal/baseModelRevision",
      message:
        "Operation precondition baseRevision must match the immutable proposal and GOM base revision.",
      operationType,
    });
  }

  if (
    precondition.expectedModelHash !== proposal.baseModelHash ||
    proposal.baseModelHash !== gom.hash
  ) {
    addIssue(issues, {
      code: "precondition_mismatch",
      path: `${path}/precondition/expectedModelHash`,
      relatedPath: "/directorProposal/baseModelHash",
      message:
        "Operation precondition expectedModelHash must match the immutable proposal and GOM base hash.",
      operationType,
    });
  }
}

function validateBriefOperation(
  operation: JsonRecord,
  index: number,
  brief: JsonRecord,
  gom: JsonRecord,
  issues: SemanticIssue[],
): void {
  const type = "brief.set_field";
  const path = `/directorProposal/operations/${index}`;
  if (
    operation.targetBriefId !== gom.briefId ||
    operation.targetBriefId !== brief.id
  ) {
    addIssue(issues, {
      code: "target_mismatch",
      path: `${path}/targetBriefId`,
      relatedPath: "/gameBrief/id",
      message: "Brief operation must target the supplied Game Brief and GOM briefId.",
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
  brief: JsonRecord,
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
    validateBriefOperation(operation, index, brief, gom, issues);
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

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function recordCollectionAt(
  owner: JsonRecord,
  key: string,
  ownerPath: string,
  issues: SemanticIssue[],
  operationType: string,
): JsonRecord[] | undefined {
  const value = owner[key];
  const path = `${ownerPath}/${key}`;
  if (!Array.isArray(value)) {
    addIssue(issues, {
      code: "invalid_document",
      path,
      message: "Expected an array collection at this path.",
      operationType,
    });
    return undefined;
  }
  for (const [index, item] of value.entries()) {
    const entity = recordAt(item, `${path}/${index}`, issues, operationType);
    if (!entity) {
      return undefined;
    }
  }
  return value as JsonRecord[];
}

function indexOfId(collection: readonly JsonRecord[], id: unknown): number {
  return collection.findIndex((entity) => entity.id === id);
}

function addCurrentBeforeIssue(
  issues: SemanticIssue[],
  path: string,
  relatedPath: string,
  operationType: string,
): void {
  addIssue(issues, {
    code: "payload_mismatch",
    path,
    relatedPath,
    message: "Operation before must exactly equal the current evolving state.",
    operationType,
  });
}

function applyBriefOperationState(
  operation: JsonRecord,
  index: number,
  brief: JsonRecord,
  issues: SemanticIssue[],
): boolean {
  const type = "brief.set_field";
  const path = `/directorProposal/operations/${index}`;
  const field = operation.field;
  const before = recordAt(operation.before, `${path}/before`, issues, type);
  const after = recordAt(operation.after, `${path}/after`, issues, type);
  if (
    typeof field !== "string" ||
    !hasOwn(brief, field) ||
    !before ||
    !after ||
    !hasOwn(before, "value") ||
    !hasOwn(after, "value")
  ) {
    if (typeof field !== "string" || !hasOwn(brief, field)) {
      addIssue(issues, {
        code: "target_mismatch",
        path: `${path}/field`,
        relatedPath: "/gameBrief",
        message: "Brief field must exist on the supplied Game Brief.",
        operationType: type,
      });
    }
    return false;
  }
  if (!deepEqual(brief[field], before.value)) {
    addCurrentBeforeIssue(
      issues,
      `${path}/before/value`,
      `/gameBrief/${field}`,
      type,
    );
    return false;
  }
  brief[field] = cloneValue(after.value);
  return true;
}

function applyQuestionOperationState(
  operation: JsonRecord,
  index: number,
  brief: JsonRecord,
  issues: SemanticIssue[],
): boolean {
  const type = "question.answer";
  const path = `/directorProposal/operations/${index}`;
  const questions = recordCollectionAt(
    brief,
    "materialQuestions",
    "/gameBrief",
    issues,
    type,
  );
  const before = recordAt(operation.before, `${path}/before`, issues, type);
  const after = recordAt(operation.after, `${path}/after`, issues, type);
  if (!questions || !before || !after) {
    return false;
  }
  const questionIndex = indexOfId(questions, operation.targetQuestionId);
  if (questionIndex < 0) {
    addIssue(issues, {
      code: "target_mismatch",
      path: `${path}/targetQuestionId`,
      relatedPath: "/gameBrief/materialQuestions",
      message: "Question operation target must exist in the evolving Game Brief.",
      operationType: type,
    });
    return false;
  }
  const question = questions[questionIndex];
  if (!deepEqual(question.answer, before)) {
    addCurrentBeforeIssue(
      issues,
      `${path}/before`,
      `/gameBrief/materialQuestions/${questionIndex}/answer`,
      type,
    );
    return false;
  }
  question.answer = cloneValue(after);
  return true;
}

function applyAddOperationState(
  operation: JsonRecord,
  index: number,
  type: string,
  contract: AddOperationContract,
  gom: JsonRecord,
  issues: SemanticIssue[],
): boolean {
  const path = `/directorProposal/operations/${index}`;
  const collection = recordCollectionAt(
    gom,
    contract.collectionKey,
    "/gameOperatingModel",
    issues,
    type,
  );
  const after = recordAt(operation.after, `${path}/after`, issues, type);
  if (!collection || !after || typeof after.id !== "string") {
    return false;
  }
  const existingIndex = indexOfId(collection, after.id);
  if (existingIndex >= 0) {
    addIssue(issues, {
      code: "duplicate_id",
      path: `${path}/${contract.addedKey}/id`,
      relatedPath: `/gameOperatingModel/${contract.collectionKey}/${existingIndex}/id`,
      id: after.id,
      message: "Add operation ID must be absent from the evolving collection.",
      operationType: type,
    });
    return false;
  }
  collection.push(cloneValue(after));
  return true;
}

function applyUpdateOperationState(
  operation: JsonRecord,
  index: number,
  type: string,
  contract: UpdateOperationContract,
  gom: JsonRecord,
  issues: SemanticIssue[],
): boolean {
  const path = `/directorProposal/operations/${index}`;
  const before = recordAt(operation.before, `${path}/before`, issues, type);
  const after = recordAt(operation.after, `${path}/after`, issues, type);
  if (!before || !after) {
    return false;
  }
  const target = operation[contract.targetKey];
  if (contract.collectionKey) {
    const collection = recordCollectionAt(
      gom,
      contract.collectionKey,
      "/gameOperatingModel",
      issues,
      type,
    );
    if (!collection) {
      return false;
    }
    const entityIndex = indexOfId(collection, target);
    if (entityIndex < 0) {
      addIssue(issues, {
        code: "target_mismatch",
        path: `${path}/${contract.targetKey}`,
        relatedPath: `/gameOperatingModel/${contract.collectionKey}`,
        message: "Update target must exist in the evolving collection.",
        operationType: type,
      });
      return false;
    }
    if (!deepEqual(collection[entityIndex], before)) {
      addCurrentBeforeIssue(
        issues,
        `${path}/before`,
        `/gameOperatingModel/${contract.collectionKey}/${entityIndex}`,
        type,
      );
      return false;
    }
    const collisionIndex = collection.findIndex(
      (entity, candidateIndex) =>
        candidateIndex !== entityIndex && entity.id === after.id,
    );
    if (collisionIndex >= 0) {
      addIssue(issues, {
        code: "duplicate_id",
        path: `${path}/after/id`,
        relatedPath: `/gameOperatingModel/${contract.collectionKey}/${collisionIndex}/id`,
        id: typeof after.id === "string" ? after.id : undefined,
        message: "Update after ID must remain collision-free.",
        operationType: type,
      });
      return false;
    }
    collection[entityIndex] = cloneValue(after);
    return true;
  }
  if (!contract.recordKey) {
    return false;
  }
  const current = recordAt(
    gom[contract.recordKey],
    `/gameOperatingModel/${contract.recordKey}`,
    issues,
    type,
  );
  if (!current || current.id !== target) {
    addIssue(issues, {
      code: "target_mismatch",
      path: `${path}/${contract.targetKey}`,
      relatedPath: `/gameOperatingModel/${contract.recordKey}/id`,
      message: "Update target must match the evolving GOM record.",
      operationType: type,
    });
    return false;
  }
  if (!deepEqual(current, before)) {
    addCurrentBeforeIssue(
      issues,
      `${path}/before`,
      `/gameOperatingModel/${contract.recordKey}`,
      type,
    );
    return false;
  }
  gom[contract.recordKey] = cloneValue(after);
  return true;
}

function applyRemoveOperationState(
  operation: JsonRecord,
  index: number,
  type: string,
  contract: RemoveOperationContract,
  gom: JsonRecord,
  issues: SemanticIssue[],
): boolean {
  const path = `/directorProposal/operations/${index}`;
  const collection = recordCollectionAt(
    gom,
    contract.collectionKey,
    "/gameOperatingModel",
    issues,
    type,
  );
  const before = recordAt(operation.before, `${path}/before`, issues, type);
  const inverse = recordAt(operation.inverse, `${path}/inverse`, issues, type);
  if (!collection || !before || !inverse) {
    return false;
  }
  const entityIndex = indexOfId(collection, operation[contract.targetKey]);
  if (entityIndex < 0) {
    addIssue(issues, {
      code: "target_mismatch",
      path: `${path}/${contract.targetKey}`,
      relatedPath: `/gameOperatingModel/${contract.collectionKey}`,
      message: "Remove target must exist in the evolving collection.",
      operationType: type,
    });
    return false;
  }
  if (!deepEqual(collection[entityIndex], before)) {
    addCurrentBeforeIssue(
      issues,
      `${path}/before`,
      `/gameOperatingModel/${contract.collectionKey}/${entityIndex}`,
      type,
    );
    return false;
  }
  const restoreIndex = inverse.restoreIndex;
  if (
    !Number.isInteger(restoreIndex) ||
    typeof restoreIndex !== "number" ||
    restoreIndex < 0 ||
    restoreIndex > 63 ||
    restoreIndex !== entityIndex
  ) {
    addIssue(issues, {
      code: "inverse_mismatch",
      path: `${path}/inverse/restoreIndex`,
      relatedPath: `/gameOperatingModel/${contract.collectionKey}/${entityIndex}`,
      message: "Remove inverse restoreIndex must be bounded and equal the removed entity index.",
      operationType: type,
    });
    return false;
  }
  collection.splice(entityIndex, 1);
  return true;
}

function applyOperationState(
  operation: JsonRecord,
  index: number,
  brief: JsonRecord,
  gom: JsonRecord,
  issues: SemanticIssue[],
): boolean {
  const type = operation.type;
  if (type === "brief.set_field") {
    return applyBriefOperationState(operation, index, brief, issues);
  }
  if (type === "question.answer") {
    return applyQuestionOperationState(operation, index, brief, issues);
  }
  if (typeof type !== "string") {
    return false;
  }
  const addContract = ADD_OPERATION_CONTRACTS[type];
  if (addContract) {
    return applyAddOperationState(
      operation,
      index,
      type,
      addContract,
      gom,
      issues,
    );
  }
  const updateContract = UPDATE_OPERATION_CONTRACTS[type];
  if (updateContract) {
    return applyUpdateOperationState(
      operation,
      index,
      type,
      updateContract,
      gom,
      issues,
    );
  }
  const removeContract = REMOVE_OPERATION_CONTRACTS[type];
  if (removeContract) {
    return applyRemoveOperationState(
      operation,
      index,
      type,
      removeContract,
      gom,
      issues,
    );
  }
  return false;
}

function addUndoIssue(
  issues: SemanticIssue[],
  index: number,
  operationType: string,
  message: string,
): void {
  addIssue(issues, {
    code: "inverse_mismatch",
    path: `/directorProposal/operations/${index}/inverse`,
    message,
    operationType,
  });
}

function undoOperationState(
  operation: JsonRecord,
  index: number,
  brief: JsonRecord,
  gom: JsonRecord,
  issues: SemanticIssue[],
): void {
  const type = operation.type;
  if (typeof type !== "string") {
    return;
  }
  const inverse = isRecord(operation.inverse) ? operation.inverse : undefined;
  if (!inverse) {
    addUndoIssue(issues, index, type, "Operation inverse must be an object.");
    return;
  }

  if (type === "brief.set_field") {
    if (typeof operation.field !== "string" || !hasOwn(inverse, "restoreValue")) {
      addUndoIssue(issues, index, type, "Brief inverse is not applicable.");
      return;
    }
    brief[operation.field] = cloneValue(inverse.restoreValue);
    return;
  }

  if (type === "question.answer") {
    const questions = recordCollectionAt(
      brief,
      "materialQuestions",
      "/gameBrief",
      issues,
      type,
    );
    const questionIndex = questions
      ? indexOfId(questions, operation.targetQuestionId)
      : -1;
    if (!questions || questionIndex < 0 || !isRecord(inverse.restoreAnswer)) {
      addUndoIssue(issues, index, type, "Question inverse target is not restorable.");
      return;
    }
    questions[questionIndex].answer = cloneValue(inverse.restoreAnswer);
    return;
  }

  const addContract = ADD_OPERATION_CONTRACTS[type];
  if (addContract) {
    const collection = recordCollectionAt(
      gom,
      addContract.collectionKey,
      "/gameOperatingModel",
      issues,
      type,
    );
    const removeId = inverse[addContract.inverseIdKey];
    const entityIndex = collection ? indexOfId(collection, removeId) : -1;
    if (!collection || entityIndex < 0) {
      addUndoIssue(issues, index, type, "Add inverse target is absent during undo.");
      return;
    }
    if (!deepEqual(collection[entityIndex], operation.after)) {
      addUndoIssue(
        issues,
        index,
        type,
        "Add inverse target does not equal the operation after state.",
      );
      return;
    }
    collection.splice(entityIndex, 1);
    return;
  }

  const updateContract = UPDATE_OPERATION_CONTRACTS[type];
  if (updateContract) {
    const restored = inverse[updateContract.inverseKey];
    if (!isRecord(restored)) {
      addUndoIssue(issues, index, type, "Update inverse payload is not restorable.");
      return;
    }
    const target = operation[updateContract.targetKey];
    if (updateContract.collectionKey) {
      const collection = recordCollectionAt(
        gom,
        updateContract.collectionKey,
        "/gameOperatingModel",
        issues,
        type,
      );
      const entityIndex = collection ? indexOfId(collection, target) : -1;
      if (!collection || entityIndex < 0) {
        addUndoIssue(issues, index, type, "Update inverse target is absent during undo.");
        return;
      }
      if (!deepEqual(collection[entityIndex], operation.after)) {
        addUndoIssue(
          issues,
          index,
          type,
          "Update inverse target does not equal the operation after state.",
        );
        return;
      }
      collection[entityIndex] = cloneValue(restored);
      return;
    }
    if (!updateContract.recordKey) {
      addUndoIssue(issues, index, type, "Update inverse has no GOM target.");
      return;
    }
    if (!deepEqual(gom[updateContract.recordKey], operation.after)) {
      addUndoIssue(
        issues,
        index,
        type,
        "Update inverse GOM record does not equal the operation after state.",
      );
      return;
    }
    gom[updateContract.recordKey] = cloneValue(restored);
    return;
  }

  const removeContract = REMOVE_OPERATION_CONTRACTS[type];
  if (removeContract) {
    const collection = recordCollectionAt(
      gom,
      removeContract.collectionKey,
      "/gameOperatingModel",
      issues,
      type,
    );
    const restored = inverse[removeContract.inverseKey];
    const restoreIndex = inverse.restoreIndex;
    if (
      !collection ||
      !isRecord(restored) ||
      typeof restored.id !== "string" ||
      typeof restoreIndex !== "number" ||
      !Number.isInteger(restoreIndex) ||
      restoreIndex < 0 ||
      restoreIndex > collection.length ||
      indexOfId(collection, restored.id) >= 0
    ) {
      addUndoIssue(issues, index, type, "Remove inverse cannot restore the entity exactly.");
      return;
    }
    collection.splice(restoreIndex, 0, cloneValue(restored));
  }
}

function proveExactReverseRestoration(
  appliedOperations: readonly AppliedOperation[],
  workingBrief: JsonRecord,
  workingGom: JsonRecord,
  originalBrief: JsonRecord,
  originalGom: JsonRecord,
  issues: SemanticIssue[],
): void {
  for (let cursor = appliedOperations.length - 1; cursor >= 0; cursor -= 1) {
    const applied = appliedOperations[cursor];
    const type =
      typeof applied.operation.type === "string"
        ? applied.operation.type
        : "unknown";
    undoOperationState(
      applied.operation,
      applied.index,
      workingBrief,
      workingGom,
      issues,
    );
    if (
      !deepEqual(workingBrief, applied.beforeBrief) ||
      !deepEqual(workingGom, applied.beforeGom)
    ) {
      addUndoIssue(
        issues,
        applied.index,
        type,
        "Applying this inverse in reverse order must restore the exact pre-operation Brief and GOM.",
      );
    }
  }

  if (!deepEqual(workingBrief, originalBrief) || !deepEqual(workingGom, originalGom)) {
    addIssue(issues, {
      code: "inverse_mismatch",
      path: "/directorProposal/operations",
      message: "Reverse application of all inverses must exactly restore the original Brief and GOM.",
    });
  }
}

export function validateIntelligenceSemantics(
  gameBrief: unknown,
  gameOperatingModel: unknown,
  directorProposal: unknown,
): SemanticValidationResult {
  const issues: SemanticIssue[] = [];
  const brief = recordAt(gameBrief, "/gameBrief", issues);
  const gom = recordAt(gameOperatingModel, "/gameOperatingModel", issues);
  const proposal = recordAt(directorProposal, "/directorProposal", issues);
  if (!brief || !gom || !proposal) {
    return { valid: false, issues };
  }

  if (gom.briefId !== brief.id) {
    addIssue(issues, {
      code: "model_mismatch",
      path: "/gameOperatingModel/briefId",
      relatedPath: "/gameBrief/id",
      message: "GOM briefId must match the supplied Game Brief id.",
    });
  }

  compareModelField(gom, proposal, "baseModelId", "id", issues);
  compareModelField(gom, proposal, "baseModelRevision", "revision", issues);
  compareModelField(gom, proposal, "baseModelHash", "hash", issues);

  reportDuplicateIds(brief, "/gameBrief", issues);
  reportDuplicateIds(gom, "/gameOperatingModel", issues);

  const workingBrief = cloneValue(brief);
  const workingGom = cloneValue(gom);
  const appliedOperations: AppliedOperation[] = [];

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
        const issueCountBeforeOperation = issues.length;
        validateOperationPrecondition(operation, index, proposal, gom, issues);
        validateOperation(
          operation,
          index,
          workingBrief,
          workingGom,
          issues,
        );
        if (issues.length === issueCountBeforeOperation) {
          const beforeBrief = cloneValue(workingBrief);
          const beforeGom = cloneValue(workingGom);
          const applied = applyOperationState(
            operation,
            index,
            workingBrief,
            workingGom,
            issues,
          );
          if (applied) {
            appliedOperations.push({
              operation,
              index,
              beforeBrief,
              beforeGom,
            });
          }
        }
      }
    });
  }

  issues.push(
    ...validateGameDocuments(
      workingBrief,
      workingGom,
      Array.isArray(proposal.operations) ? proposal.operations : [],
    ),
  );

  proveExactReverseRestoration(
    appliedOperations,
    workingBrief,
    workingGom,
    brief,
    gom,
    issues,
  );

  return { valid: issues.length === 0, issues };
}
