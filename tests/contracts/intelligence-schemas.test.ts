import { readFileSync } from "node:fs";
import { join } from "node:path";

import Ajv2020, {
  type AnySchema,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { beforeAll, describe, expect, it } from "vitest";

import {
  INTELLIGENCE_CONTRACT_KINDS,
  INTELLIGENCE_CONTRACTS,
  type IntelligenceContractKind,
} from "../../src/intelligence/contracts";
import {
  MAX_INTELLIGENCE_DOCUMENT_NODES,
  MAX_INTELLIGENCE_VALIDATION_ISSUES,
  intelligenceMigrationTarget,
  migrateIntelligenceContract,
  validateIntelligenceContract,
} from "../../src/intelligence/validation";

const SCHEMA_VERSION = "1.0.0";
const SCHEMA_BASE_ID = "https://schemas.robloxforge.dev/intelligence/";

const schemaFiles = [
  "common.schema.json",
  "game-brief.v1.schema.json",
  "game-operating-model.v1.schema.json",
  "director-proposal.v1.schema.json",
  "provenance.v1.schema.json",
  "corpus-record.v1.schema.json",
  "reference-analysis.v1.schema.json",
  "radar-snapshot.v1.schema.json",
  "monetization-opportunity-signal.v1.schema.json",
  "recommendation.v1.schema.json",
] as const;

type SchemaFile = (typeof schemaFiles)[number];
type JsonObject = Record<string, unknown>;

const intelligenceDirectory = join(process.cwd(), "schemas", "intelligence");

function readJson<T>(...segments: string[]): T {
  return JSON.parse(readFileSync(join(...segments), "utf8")) as T;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function countJsonNodes(value: unknown): number {
  if (value === null || typeof value !== "object") {
    return 1;
  }
  const children = Array.isArray(value) ? value : Object.values(value);
  return 1 + children.reduce((total, child) => total + countJsonNodes(child), 0);
}

function resolveSchemaReference(
  reference: string,
  currentSchemaId: string,
  schemasById: ReadonlyMap<string, JsonObject>,
): { readonly id: string; readonly schema: JsonObject } {
  const resolved = new URL(reference, currentSchemaId);
  const schemaId = `${resolved.origin}${resolved.pathname}`;
  const root = schemasById.get(schemaId);
  if (root === undefined) {
    throw new Error(`cardinality schema unavailable: ${schemaId}`);
  }

  let target: unknown = root;
  if (resolved.hash.length > 0) {
    if (!resolved.hash.startsWith("#/")) {
      throw new Error(`unsupported schema fragment: ${resolved.hash}`);
    }
    for (const encodedSegment of resolved.hash.slice(2).split("/")) {
      const segment = decodeURIComponent(encodedSegment)
        .replaceAll("~1", "/")
        .replaceAll("~0", "~");
      target = asJsonObject(target, `schema pointer ${resolved.href}`)[segment];
    }
  }

  return {
    id: resolved.href,
    schema: asJsonObject(target, `schema reference ${resolved.href}`),
  };
}

function assertNonStructuralAllOf(schema: JsonObject): void {
  if (schema.allOf === undefined) {
    return;
  }
  if (!Array.isArray(schema.allOf)) {
    throw new Error("schema allOf must be an array");
  }

  const declaredProperties = new Set(
    Object.keys(asJsonObject(schema.properties, "schema properties")),
  );
  for (const [index, candidate] of schema.allOf.entries()) {
    const branch = asJsonObject(candidate, `schema allOf/${index}`);
    if (
      Object.keys(branch).some(
        (key) => key !== "if" && key !== "then" && key !== "else",
      )
    ) {
      throw new Error("unsupported structural allOf branch");
    }
    for (const keyword of ["then", "else"] as const) {
      if (branch[keyword] === undefined) {
        continue;
      }
      const consequence = asJsonObject(
        branch[keyword],
        `schema allOf/${index}/${keyword}`,
      );
      if (
        Object.keys(consequence).some((key) => key !== "properties")
      ) {
        throw new Error("unsupported structural allOf consequence");
      }
      const properties = asJsonObject(
        consequence.properties,
        `schema allOf/${index}/${keyword}/properties`,
      );
      if (Object.keys(properties).some((key) => !declaredProperties.has(key))) {
        throw new Error("allOf introduces an uncounted property");
      }
    }
  }
}

function maximumSchemaJsonNodes(
  schema: JsonObject,
  currentSchemaId: string,
  schemasById: ReadonlyMap<string, JsonObject>,
  activeReferences: Set<string> = new Set(),
): number {
  if (typeof schema.$ref === "string") {
    const resolved = resolveSchemaReference(
      schema.$ref,
      currentSchemaId,
      schemasById,
    );
    if (activeReferences.has(resolved.id)) {
      throw new Error(`recursive schema reference: ${resolved.id}`);
    }
    activeReferences.add(resolved.id);
    try {
      return maximumSchemaJsonNodes(
        resolved.schema,
        resolved.id.split("#", 1)[0],
        schemasById,
        activeReferences,
      );
    } finally {
      activeReferences.delete(resolved.id);
    }
  }

  for (const keyword of ["oneOf", "anyOf"] as const) {
    if (schema[keyword] === undefined) {
      continue;
    }
    if (!Array.isArray(schema[keyword]) || schema[keyword].length === 0) {
      throw new Error(`schema ${keyword} must contain branches`);
    }
    return Math.max(
      ...schema[keyword].map((candidate, index) =>
        maximumSchemaJsonNodes(
          asJsonObject(candidate, `schema ${keyword}/${index}`),
          currentSchemaId,
          schemasById,
          activeReferences,
        ),
      ),
    );
  }

  assertNonStructuralAllOf(schema);
  if (schema.type === "object" || schema.properties !== undefined) {
    const properties = asJsonObject(schema.properties, "schema properties");
    return (
      1 +
      Object.values(properties).reduce(
        (total, property, index) =>
          total +
          maximumSchemaJsonNodes(
            asJsonObject(property, `schema property/${index}`),
            currentSchemaId,
            schemasById,
            activeReferences,
          ),
        0,
      )
    );
  }
  if (schema.type === "array") {
    if (
      !Number.isSafeInteger(schema.maxItems) ||
      (schema.maxItems as number) < 0
    ) {
      throw new Error("bounded schema array requires maxItems");
    }
    return (
      1 +
      (schema.maxItems as number) *
        maximumSchemaJsonNodes(
          asJsonObject(schema.items, "schema array items"),
          currentSchemaId,
          schemasById,
          activeReferences,
        )
    );
  }
  return 1;
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  return JSON.stringify(errors ?? [], null, 2);
}

function hasAdditionalPropertyError(
  errors: ErrorObject[] | null | undefined,
  property: string,
): boolean {
  return (errors ?? []).some(
    (error) =>
      error.keyword === "additionalProperties" &&
      error.params.additionalProperty === property,
  );
}

function walkSchema(
  value: unknown,
  path: string,
  visitor: (node: JsonObject, path: string) => void,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkSchema(item, `${path}/${index}`, visitor));
    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  const node = value as JsonObject;
  visitor(node, path);
  Object.entries(node).forEach(([key, child]) =>
    walkSchema(child, `${path}/${key}`, visitor),
  );
}

function asJsonObject(value: unknown, label: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function asJsonObjects(value: unknown, label: string): JsonObject[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value.map((item, index) => asJsonObject(item, `${label}/${index}`));
}

function asStrings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be a string array`);
  }
  return value as string[];
}

function idSet(value: unknown, label: string): Set<string> {
  return new Set(
    asJsonObjects(value, label).map((item, index) => {
      if (typeof item.id !== "string") {
        throw new Error(`${label}/${index}/id must be a string`);
      }
      return item.id;
    }),
  );
}

function collectNamedStringReferences(
  value: unknown,
  singularKeys: ReadonlySet<string>,
  arrayKeys: ReadonlySet<string>,
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) =>
      collectNamedStringReferences(item, singularKeys, arrayKeys),
    );
  }
  if (value === null || typeof value !== "object") {
    return [];
  }

  const references: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (singularKeys.has(key) && typeof child === "string") {
      references.push(child);
    }
    if (arrayKeys.has(key)) {
      references.push(...asStrings(child, key));
    }
    references.push(
      ...collectNamedStringReferences(child, singularKeys, arrayKeys),
    );
  }
  return references;
}

function expectIdsToResolve(
  label: string,
  references: readonly string[],
  declaredIds: ReadonlySet<string>,
): void {
  for (const reference of references) {
    expect(declaredIds.has(reference), `${label}: unresolved ${reference}`).toBe(true);
  }
}

describe("game intelligence JSON contracts", () => {
  const schemas = new Map<SchemaFile, AnySchema>();
  const validators = new Map<SchemaFile, ValidateFunction>();
  let validFixture: JsonObject;
  let invalidCompetitorRevenue: JsonObject;

  beforeAll(() => {
    for (const filename of schemaFiles) {
      schemas.set(filename, readJson<AnySchema>(intelligenceDirectory, filename));
    }

    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);

    for (const schema of schemas.values()) {
      ajv.addSchema(schema);
    }

    for (const filename of schemaFiles) {
      const validator = ajv.getSchema(`${SCHEMA_BASE_ID}${filename}`);
      if (!validator) {
        throw new Error(`Ajv did not register ${filename}`);
      }
      validators.set(filename, validator);
    }

    validFixture = readJson<JsonObject>(
      intelligenceDirectory,
      "fixtures",
      "valid",
      "obby.json",
    );
    invalidCompetitorRevenue = readJson<JsonObject>(
      intelligenceDirectory,
      "fixtures",
      "invalid",
      "competitor-revenue.json",
    );
  });

  function validate(filename: SchemaFile, document: unknown): ValidateFunction {
    const validator = validators.get(filename);
    if (!validator) {
      throw new Error(`Missing validator for ${filename}`);
    }
    validator(document);
    return validator;
  }

  function proposalWithBriefField(
    field: string,
    value: unknown,
    inverseValue: unknown = value,
  ): JsonObject {
    const proposal = clone(asJsonObject(validFixture.directorProposal, "proposal"));
    const operation = clone(asJsonObjects(proposal.operations, "proposal.operations")[0]);
    operation.field = field;
    operation.before = { value: clone(value) };
    operation.after = { value: clone(value) };
    operation.inverse = { restoreValue: clone(inverseValue) };
    proposal.operations = [operation];
    return proposal;
  }

  function publicUrlCases(url: string): Array<{
    label: string;
    filename: SchemaFile;
    document: JsonObject;
  }> {
    const corpus = clone(asJsonObject(validFixture.corpusRecord, "corpusRecord"));
    asJsonObject(corpus.source, "corpusRecord.source").url = url;

    const reference = clone(
      asJsonObject(validFixture.referenceAnalysis, "referenceAnalysis"),
    );
    asJsonObject(reference.sourceGame, "referenceAnalysis.sourceGame").publicUrl = url;

    const radarEntry = clone(asJsonObject(validFixture.radarSnapshot, "radarSnapshot"));
    asJsonObjects(radarEntry.entries, "radarSnapshot.entries")[0].publicUrl = url;

    const radarSignal = clone(asJsonObject(validFixture.radarSnapshot, "radarSnapshot"));
    const radarSignalEntry = asJsonObjects(
      radarSignal.entries,
      "radarSnapshot.entries",
    )[0];
    asJsonObjects(radarSignalEntry.signals, "radarSnapshot.entries/0/signals")[0]
      .sourceUrl = url;

    const radarOffer = clone(asJsonObject(validFixture.radarSnapshot, "radarSnapshot"));
    asJsonObjects(radarOffer.entries, "radarSnapshot.entries")[0].publicOffers = [
      {
        evidenceId: "evidence:tower-of-hell-public-visits",
        offerType: "private_server",
        offerId: null,
        sourceUrl: url,
        observedAt: "2026-07-14T00:00:00Z",
        locale: "en-AU",
        priceContext: "unavailable",
        priceRobux: null,
      },
    ];

    const monetization = clone(
      asJsonObject(
        validFixture.monetizationOpportunitySignal,
        "monetizationOpportunitySignal",
      ),
    );
    asJsonObjects(
      monetization.publicSignals,
      "monetizationOpportunitySignal.publicSignals",
    )[0].sourceUrl = url;

    return [
      {
        label: "corpusRecord.source.url",
        filename: "corpus-record.v1.schema.json",
        document: corpus,
      },
      {
        label: "referenceAnalysis.sourceGame.publicUrl",
        filename: "reference-analysis.v1.schema.json",
        document: reference,
      },
      {
        label: "radarSnapshot.entries.publicUrl",
        filename: "radar-snapshot.v1.schema.json",
        document: radarEntry,
      },
      {
        label: "radarSnapshot.entries.signals.sourceUrl",
        filename: "radar-snapshot.v1.schema.json",
        document: radarSignal,
      },
      {
        label: "radarSnapshot.entries.publicOffers.sourceUrl",
        filename: "radar-snapshot.v1.schema.json",
        document: radarOffer,
      },
      {
        label: "monetizationOpportunitySignal.publicSignals.sourceUrl",
        filename: "monetization-opportunity-signal.v1.schema.json",
        document: monetization,
      },
    ];
  }

  function expectCoherentIntelligenceLinks(fixture: JsonObject): void {
    const common = asJsonObject(fixture.common, "common");
    const brief = asJsonObject(fixture.gameBrief, "gameBrief");
    const gom = asJsonObject(fixture.gameOperatingModel, "gameOperatingModel");
    const proposal = asJsonObject(fixture.directorProposal, "directorProposal");
    const provenance = asJsonObject(fixture.provenance, "provenance");
    const corpus = asJsonObject(fixture.corpusRecord, "corpusRecord");
    const reference = asJsonObject(fixture.referenceAnalysis, "referenceAnalysis");
    const radar = asJsonObject(fixture.radarSnapshot, "radarSnapshot");
    const monetization = asJsonObject(
      fixture.monetizationOpportunitySignal,
      "monetizationOpportunitySignal",
    );
    const recommendation = asJsonObject(fixture.recommendation, "recommendation");

    expect(gom.briefId, "GOM must reference the Brief").toBe(brief.id);
    for (const [index, referenceInput] of asJsonObjects(
      brief.referenceInputs,
      "gameBrief.referenceInputs",
    ).entries()) {
      expect(
        referenceInput.referenceAnalysisId,
        `Brief reference input ${index} must resolve its Reference Analysis`,
      ).toBe(reference.id);
    }

    const briefProvenance = asJsonObject(brief.provenance, "gameBrief.provenance");
    const gomProvenance = asJsonObject(gom.provenance, "gameOperatingModel.provenance");
    const corpusProvenance = asJsonObject(corpus.provenance, "corpusRecord.provenance");
    const referenceProvenance = asJsonObject(
      reference.provenance,
      "referenceAnalysis.provenance",
    );
    const radarProvenance = asJsonObject(radar.provenance, "radarSnapshot.provenance");
    const monetizationProvenance = asJsonObject(
      monetization.provenance,
      "monetizationOpportunitySignal.provenance",
    );
    const recommendationProvenance = asJsonObject(
      recommendation.provenance,
      "recommendation.provenance",
    );
    const provenanceLinks: Array<[string, unknown]> = [
      ["common", common.provenanceId],
      ["gameBrief", briefProvenance.provenanceId],
      ["gameOperatingModel", gomProvenance.provenanceId],
      ["directorProposal", proposal.provenanceId],
      ["corpusRecord", corpusProvenance.provenanceId],
      ["referenceAnalysis", referenceProvenance.provenanceId],
      ["radarSnapshot", radarProvenance.provenanceId],
      ["monetizationOpportunitySignal", monetizationProvenance.provenanceId],
      ["recommendation", recommendationProvenance.provenanceId],
    ];
    for (const [label, provenanceId] of provenanceLinks) {
      expect(provenanceId, `${label} must reference the provenance document`).toBe(
        provenance.id,
      );
    }

    expect(
      asStrings(provenance.sourceIds, "provenance.sourceIds"),
      "provenance must reference the corpus source",
    ).toContain(corpus.id);
    expect(
      asStrings(reference.corpusRecordIds, "referenceAnalysis.corpusRecordIds"),
      "reference analysis must reference the corpus record",
    ).toContain(corpus.id);
    expect(
      asStrings(radar.corpusRecordIds, "radarSnapshot.corpusRecordIds"),
      "radar snapshot must reference the corpus record",
    ).toContain(corpus.id);

    const observationIds = idSet(corpus.observations, "corpusRecord.observations");
    const evidenceSingularKeys = new Set(["evidenceId"]);
    const evidenceArrayKeys = new Set([
      "evidenceIds",
      "sourceEvidenceIds",
      "decisionEvidenceIds",
      "basedOnObservationIds",
    ]);
    expectIdsToResolve(
      "evidence references",
      collectNamedStringReferences(
        fixture,
        evidenceSingularKeys,
        evidenceArrayKeys,
      ),
      observationIds,
    );
    expectIdsToResolve(
      "reference-analysis evidence",
      collectNamedStringReferences(reference, evidenceSingularKeys, evidenceArrayKeys),
      observationIds,
    );
    expectIdsToResolve(
      "radar evidence",
      collectNamedStringReferences(radar, evidenceSingularKeys, evidenceArrayKeys),
      observationIds,
    );

    const corpusSource = asJsonObject(corpus.source, "corpusRecord.source");
    const referenceSource = asJsonObject(
      reference.sourceGame,
      "referenceAnalysis.sourceGame",
    );
    expect(referenceSource.publicUrl, "reference URL must match its corpus source").toBe(
      corpusSource.url,
    );

    const corpusPatternIds = idSet(corpus.patterns, "corpusRecord.patterns");
    const adaptablePatternIds = idSet(
      reference.adaptablePatterns,
      "referenceAnalysis.adaptablePatterns",
    );
    expectIdsToResolve(
      "adaptable patterns",
      [...adaptablePatternIds],
      corpusPatternIds,
    );
    for (const transformation of asJsonObjects(
      reference.transformations,
      "referenceAnalysis.transformations",
    )) {
      expect(
        adaptablePatternIds.has(String(transformation.sourcePatternId)),
        `reference transformation must resolve ${String(transformation.sourcePatternId)}`,
      ).toBe(true);
    }

    const radarEntries = asJsonObjects(radar.entries, "radarSnapshot.entries");
    const radarSignals = radarEntries.flatMap((entry, entryIndex) => {
      expect(entry.publicUrl, `radar entry ${entryIndex} URL must match the corpus`).toBe(
        corpusSource.url,
      );
      return asJsonObjects(entry.signals, `radarSnapshot.entries/${entryIndex}/signals`);
    });
    for (const [index, signal] of radarSignals.entries()) {
      expect(
        observationIds.has(String(signal.evidenceId)),
        `radar signal ${index} must resolve its evidence`,
      ).toBe(true);
      expect(signal.sourceUrl, `radar signal ${index} URL must match the corpus`).toBe(
        corpusSource.url,
      );
    }

    expect(
      monetization.radarSnapshotId,
      "monetization signal must reference the radar snapshot",
    ).toBe(radar.id);
    for (const publicSignal of asJsonObjects(
      monetization.publicSignals,
      "monetizationOpportunitySignal.publicSignals",
    )) {
      const radarSignal = radarSignals.find((signal) => signal.id === publicSignal.id);
      expect(radarSignal, `public signal ${String(publicSignal.id)} must exist in radar`).toEqual(
        publicSignal,
      );
    }

    expect(proposal.baseModelId, "proposal must reference its base GOM").toBe(gom.id);
    expect(proposal.baseModelRevision, "proposal revision must match the GOM").toBe(
      gom.revision,
    );
    expect(proposal.baseModelHash, "proposal hash must match the GOM").toBe(gom.hash);
    expect(proposal.provenanceId, "proposal provenance must resolve").toBe(provenance.id);
    const provenanceEvidenceIds = new Set(
      asStrings(provenance.evidenceIds, "provenance.evidenceIds"),
    );
    const proposalEvidenceIds = new Set(
      asStrings(proposal.evidenceIds, "directorProposal.evidenceIds"),
    );
    expectIdsToResolve(
      "proposal evidence",
      [...proposalEvidenceIds],
      provenanceEvidenceIds,
    );

    const acceptanceTestIds = idSet(gom.acceptanceTests, "gameOperatingModel.acceptanceTests");
    const sceneIds = idSet(gom.sceneNodes, "gameOperatingModel.sceneNodes");
    const objectiveIds = idSet(gom.objectives, "gameOperatingModel.objectives");
    const systemIds = idSet(gom.systems, "gameOperatingModel.systems");
    const runtimeRuleIds = idSet(gom.runtimeRules, "gameOperatingModel.runtimeRules");
    const feedbackIds = idSet(gom.feedback, "gameOperatingModel.feedback");
    const materialQuestionIds = idSet(brief.materialQuestions, "gameBrief.materialQuestions");
    const operations = asJsonObjects(proposal.operations, "directorProposal.operations");
    const operationByType = (type: string): JsonObject => {
      const operation = operations.find((candidate) => candidate.type === type);
      if (!operation) {
        throw new Error(`Missing proposal operation ${type}`);
      }
      return operation;
    };

    for (const [index, operation] of operations.entries()) {
      const precondition = asJsonObject(
        operation.precondition,
        `directorProposal.operations/${index}/precondition`,
      );
      expect(precondition.baseRevision, `operation ${index} revision must match GOM`).toBe(
        gom.revision,
      );
      expect(precondition.expectedModelHash, `operation ${index} hash must match GOM`).toBe(
        gom.hash,
      );
      expectIdsToResolve(
        `operation ${index} acceptance tests`,
        asStrings(
          operation.affectedAcceptanceTestIds,
          `directorProposal.operations/${index}/affectedAcceptanceTestIds`,
        ),
        acceptanceTestIds,
      );
    }

    expect(operationByType("brief.set_field").targetBriefId).toBe(brief.id);
    expect(
      materialQuestionIds.has(String(operationByType("question.answer").targetQuestionId)),
      "question operation target must exist in the Brief",
    ).toBe(true);
    expect(
      sceneIds.has(String(operationByType("scene.update").targetSceneId)),
      "scene.update target must exist in the GOM",
    ).toBe(true);
    expect(operationByType("scene.remove").targetSceneId).toBe(
      asJsonObject(
        operationByType("scene.add").addedScene,
        "scene.add.addedScene",
      ).id,
    );
    expect(
      objectiveIds.has(String(operationByType("objective.update").targetObjectiveId)),
      "objective.update target must exist in the GOM",
    ).toBe(true);
    expect(operationByType("objective.remove").targetObjectiveId).toBe(
      asJsonObject(
        operationByType("objective.add").addedObjective,
        "objective.add.addedObjective",
      ).id,
    );
    expect(operationByType("progression.update").targetProgressionId).toBe(
      asJsonObject(gom.progression, "gameOperatingModel.progression").id,
    );
    expect(operationByType("economy.update").targetEconomyId).toBe(
      asJsonObject(gom.economy, "gameOperatingModel.economy").id,
    );
    expect(
      runtimeRuleIds.has(
        String(operationByType("runtime_rule.update").targetRuntimeRuleId),
      ),
      "runtime rule operation target must exist in the GOM",
    ).toBe(true);
    expect(
      feedbackIds.has(String(operationByType("feedback.update").targetFeedbackId)),
      "feedback operation target must exist in the GOM",
    ).toBe(true);
    expect(
      acceptanceTestIds.has(
        String(operationByType("acceptance_test.update").targetAcceptanceTestId),
      ),
      "acceptance operation target must exist in the GOM",
    ).toBe(true);

    for (const [index, scene] of asJsonObjects(gom.sceneNodes, "gameOperatingModel.sceneNodes").entries()) {
      expectIdsToResolve(
        `scene ${index} systems`,
        asStrings(scene.systemIds, `gameOperatingModel.sceneNodes/${index}/systemIds`),
        systemIds,
      );
    }
    for (const [index, system] of asJsonObjects(gom.systems, "gameOperatingModel.systems").entries()) {
      expectIdsToResolve(
        `system ${index} dependencies`,
        asStrings(system.dependencyIds, `gameOperatingModel.systems/${index}/dependencyIds`),
        systemIds,
      );
      expectIdsToResolve(
        `system ${index} scenes`,
        asStrings(system.sceneIds, `gameOperatingModel.systems/${index}/sceneIds`),
        sceneIds,
      );
    }
    for (const [index, objective] of asJsonObjects(gom.objectives, "gameOperatingModel.objectives").entries()) {
      expectIdsToResolve(
        `objective ${index} dependencies`,
        asStrings(
          objective.dependencyIds,
          `gameOperatingModel.objectives/${index}/dependencyIds`,
        ),
        objectiveIds,
      );
    }

    expect(recommendation.gomId, "recommendation must reference its GOM").toBe(gom.id);
    expect(recommendation.gomRevision, "recommendation revision must match GOM").toBe(
      gom.revision,
    );
    expect(recommendation.proposalId, "recommendation must reference its proposal").toBe(
      proposal.id,
    );
    expectIdsToResolve(
      "recommendation evidence",
      asStrings(recommendation.evidenceIds, "recommendation.evidenceIds"),
      proposalEvidenceIds,
    );
    expectIdsToResolve(
      "recommendation scene targets",
      asStrings(recommendation.targetElementIds, "recommendation.targetElementIds"),
      sceneIds,
    );
    expectIdsToResolve(
      "recommendation acceptance targets",
      asJsonObjects(recommendation.acceptanceTests, "recommendation.acceptanceTests").map(
        (test) => String(test.id),
      ),
      acceptanceTestIds,
    );

    const gomTraceIds = new Set(
      asStrings(gomProvenance.traceIds, "gameOperatingModel.provenance.traceIds"),
    );
    expectIdsToResolve(
      "trace references",
      collectNamedStringReferences(fixture, new Set(), new Set(["traceIds"])),
      gomTraceIds,
    );

    const analyticsIds = idSet(
      gom.analyticsEventContracts,
      "gameOperatingModel.analyticsEventContracts",
    );
    expectIdsToResolve(
      "analytics references",
      collectNamedStringReferences(
        [gom, proposal, recommendation],
        new Set(["successSignal", "observableSignal", "analyticsEventId"]),
        new Set(["observableSignals"]),
      ),
      analyticsIds,
    );
  }

  it("compiles all ten Draft 2020-12 schemas with stable ids and refs", () => {
    expect(schemas.size).toBe(10);

    for (const filename of schemaFiles) {
      const schema = schemas.get(filename) as JsonObject;
      expect(schema.$schema, filename).toBe(
        "https://json-schema.org/draft/2020-12/schema",
      );
      expect(schema.$id, filename).toBe(`${SCHEMA_BASE_ID}${filename}`);

      const properties = schema.properties as JsonObject;
      const schemaVersion = properties.schemaVersion as JsonObject;
      expect(schemaVersion.const, filename).toBe(SCHEMA_VERSION);
      expect(validators.get(filename), filename).toBeTypeOf("function");
    }
  });

  it("closes every object and bounds every declared array and string", () => {
    for (const [filename, schema] of schemas) {
      walkSchema(schema, filename, (node, path) => {
        if (node.type === "object") {
          expect(node.additionalProperties, `${path} must be closed`).toBe(false);
        }
        if (node.type === "array") {
          expect(node.maxItems, `${path} must bound its array`).toBeTypeOf("number");
        }
        if (node.type === "string") {
          expect(node.maxLength, `${path} must bound its text`).toBeTypeOf("number");
        }
      });
    }
  });

  it("validates the coherent Obby document set against every contract", () => {
    const documents: Record<SchemaFile, unknown> = {
      "common.schema.json": validFixture.common,
      "game-brief.v1.schema.json": validFixture.gameBrief,
      "game-operating-model.v1.schema.json": validFixture.gameOperatingModel,
      "director-proposal.v1.schema.json": validFixture.directorProposal,
      "provenance.v1.schema.json": validFixture.provenance,
      "corpus-record.v1.schema.json": validFixture.corpusRecord,
      "reference-analysis.v1.schema.json": validFixture.referenceAnalysis,
      "radar-snapshot.v1.schema.json": validFixture.radarSnapshot,
      "monetization-opportunity-signal.v1.schema.json":
        validFixture.monetizationOpportunitySignal,
      "recommendation.v1.schema.json": validFixture.recommendation,
    };

    for (const filename of schemaFiles) {
      const validator = validate(filename, documents[filename]);
      expect(validator.errors, `${filename}: ${formatErrors(validator.errors)}`).toBeNull();
    }
  });

  it("loads every committed schema through the TypeScript contract registry", () => {
    expect(INTELLIGENCE_CONTRACT_KINDS).toHaveLength(10);
    expect(Object.keys(INTELLIGENCE_CONTRACTS).sort()).toEqual(
      [...INTELLIGENCE_CONTRACT_KINDS].sort(),
    );

    for (const kind of INTELLIGENCE_CONTRACT_KINDS) {
      const contract = INTELLIGENCE_CONTRACTS[kind];
      expect(contract.kind).toBe(kind);
      expect(contract.schema.$schema).toBe(
        "https://json-schema.org/draft/2020-12/schema",
      );
      expect(contract.schema.$id).toBe(contract.schemaId);
    }
  });

  it("keeps the fixed node budget above every committed schema maximum", () => {
    const schemasById = new Map<string, JsonObject>();
    const roots = new Map<SchemaFile, JsonObject>();
    for (const file of schemaFiles) {
      const schema = asJsonObject(schemas.get(file), `schema ${file}`);
      if (typeof schema.$id !== "string") {
        throw new Error(`${file} must declare an id`);
      }
      schemasById.set(schema.$id, schema);
      roots.set(file, schema);
    }

    const maxima = Object.fromEntries(
      schemaFiles.map((file) => {
        const schema = roots.get(file);
        if (schema === undefined || typeof schema.$id !== "string") {
          throw new Error(`${file} cardinality root is unavailable`);
        }
        return [
          file,
          maximumSchemaJsonNodes(schema, schema.$id, schemasById),
        ];
      }),
    );

    expect(maxima).toEqual({
      "common.schema.json": 134,
      "game-brief.v1.schema.json": 1_087,
      "game-operating-model.v1.schema.json": 65_815,
      "director-proposal.v1.schema.json": 1_104_853,
      "provenance.v1.schema.json": 2_413,
      "corpus-record.v1.schema.json": 4_793,
      "reference-analysis.v1.schema.json": 6_068,
      "radar-snapshot.v1.schema.json": 32_620,
      "monetization-opportunity-signal.v1.schema.json": 1_447,
      "recommendation.v1.schema.json": 1_077,
    });
    expect(Math.max(...Object.values(maxima))).toBeLessThan(
      MAX_INTELLIGENCE_DOCUMENT_NODES,
    );
  });

  it("validates all ten fixture documents through the TypeScript adapters", () => {
    const documents: Record<IntelligenceContractKind, unknown> = {
      common: validFixture.common,
      gameBrief: validFixture.gameBrief,
      gameOperatingModel: validFixture.gameOperatingModel,
      directorProposal: validFixture.directorProposal,
      provenance: validFixture.provenance,
      corpusRecord: validFixture.corpusRecord,
      referenceAnalysis: validFixture.referenceAnalysis,
      radarSnapshot: validFixture.radarSnapshot,
      monetizationOpportunitySignal:
        validFixture.monetizationOpportunitySignal,
      recommendation: validFixture.recommendation,
    };

    for (const kind of INTELLIGENCE_CONTRACT_KINDS) {
      const result = validateIntelligenceContract(kind, documents[kind]);
      expect(result, kind).toMatchObject({ ok: true, kind, validated: true });
    }
  });

  it("rejects the committed invalid radar fixture through the TypeScript adapter", () => {
    const result = validateIntelligenceContract(
      "radarSnapshot",
      invalidCompetitorRevenue,
    );

    expect(result).toMatchObject({
      ok: false,
      kind: "radarSnapshot",
      validated: false,
      code: "schema_validation_failed",
    });
  });

  it.each(["2.0.0", "1.1.0"])(
    "fails closed for unsupported schema version %s through the TypeScript adapter",
    (schemaVersion) => {
      const document = clone(validFixture.gameOperatingModel);
      document.schemaVersion = schemaVersion;

      const result = validateIntelligenceContract("gameOperatingModel", document);

      expect(result).toMatchObject({
        ok: false,
        kind: "gameOperatingModel",
        validated: false,
        code: "unsupported_schema_version",
      });
    },
  );

  it("keeps exported migrations explicitly unvalidated and idempotent", () => {
    const document = clone(validFixture.gameOperatingModel);
    const first = migrateIntelligenceContract("gameOperatingModel", document);
    expect(first).toMatchObject({
      ok: true,
      kind: "gameOperatingModel",
      validated: false,
    });
    if (!first.ok) {
      throw new Error(`migration failed: ${first.code}`);
    }

    const second = migrateIntelligenceContract(
      "gameOperatingModel",
      first.value,
    );
    expect(second).toMatchObject({
      ok: true,
      kind: "gameOperatingModel",
      validated: false,
      value: first.value,
    });
    expect(first.value).toEqual(document);
  });

  it("registers current migrations per kind and preserves their declared target", () => {
    for (const kind of INTELLIGENCE_CONTRACT_KINDS) {
      expect(intelligenceMigrationTarget(kind, SCHEMA_VERSION), kind).toBe(
        SCHEMA_VERSION,
      );
      expect(
        intelligenceMigrationTarget(kind, "1.1.0"),
        kind,
      ).toBeUndefined();
    }

    const cases: readonly [IntelligenceContractKind, JsonObject][] = [
      ["common", clone(validFixture.common)],
      ["gameOperatingModel", clone(validFixture.gameOperatingModel)],
    ];
    for (const [kind, document] of cases) {
      const targetVersion = intelligenceMigrationTarget(kind, SCHEMA_VERSION);
      const first = migrateIntelligenceContract(kind, document);
      expect(first, kind).toMatchObject({ ok: true, validated: false });
      if (!first.ok) {
        throw new Error(`${kind} migration failed: ${first.code}`);
      }
      expect(first.value.schemaVersion).toBe(targetVersion);

      const second = migrateIntelligenceContract(kind, first.value);
      expect(second, kind).toMatchObject({ ok: true, validated: false });
      if (!second.ok) {
        throw new Error(`${kind} repeated migration failed: ${second.code}`);
      }
      expect(second.value).toEqual(first.value);
      expect(second.value.schemaVersion).toBe(targetVersion);
    }
  });

  it("returns an owned deeply immutable validated document", () => {
    const document = clone(validFixture.gameOperatingModel);
    const originalPromise = asJsonObject(
      document.firstSessionPromise,
      "original firstSessionPromise",
    );
    const originalTraceIds = asStrings(
      originalPromise.traceIds,
      "original firstSessionPromise.traceIds",
    );
    const expectedStatement = originalPromise.statement;
    const expectedFirstTraceId = originalTraceIds[0];

    const result = validateIntelligenceContract("gameOperatingModel", document);
    expect(result).toMatchObject({ ok: true, validated: true });
    if (!result.ok) {
      throw new Error(`validation failed: ${result.code}`);
    }

    const validated = result.value as unknown as JsonObject;
    const validatedPromise = asJsonObject(
      validated.firstSessionPromise,
      "validated firstSessionPromise",
    );
    const validatedTraceIds = asStrings(
      validatedPromise.traceIds,
      "validated firstSessionPromise.traceIds",
    );

    originalPromise.statement = "caller mutation after validation";
    originalTraceIds[0] = "trace:caller-mutation";

    expect(validatedPromise.statement).toBe(expectedStatement);
    expect(validatedTraceIds[0]).toBe(expectedFirstTraceId);
    expect(Object.isFrozen(validated)).toBe(true);
    expect(Object.isFrozen(validatedPromise)).toBe(true);
    expect(Object.isFrozen(validatedTraceIds)).toBe(true);
    expect(() => {
      validatedPromise.statement = "validated mutation attempt";
    }).toThrow(TypeError);
    expect(() => {
      validatedTraceIds.push("trace:validated-mutation");
    }).toThrow(TypeError);
  });

  it("rejects cyclic input without throwing or echoing content", () => {
    const sentinel = "sk-live-cyclic-secret-sentinel";
    const document: JsonObject = {
      schemaVersion: SCHEMA_VERSION,
      sentinel,
    };
    document.self = document;

    let result: unknown;
    expect(() => {
      result = validateIntelligenceContract("gameOperatingModel", document);
    }).not.toThrow();
    expect(result).toMatchObject({
      ok: false,
      kind: "gameOperatingModel",
      validated: false,
      code: "invalid_json_document",
      issues: [
        {
          code: "schema_mismatch",
          path: "/",
          message: "Document must contain only bounded JSON data.",
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain(sentinel);
  });

  it("rejects non-JSON input without throwing or echoing content", () => {
    const sentinel = "sk-live-non-json-secret-sentinel";
    const document = clone(validFixture.gameOperatingModel);
    document.unexpectedCredential = {
      sentinel,
      value: BigInt(1),
    };

    let result: unknown;
    expect(() => {
      result = validateIntelligenceContract("gameOperatingModel", document);
    }).not.toThrow();
    expect(result).toMatchObject({
      ok: false,
      kind: "gameOperatingModel",
      validated: false,
      code: "invalid_json_document",
      issues: [
        {
          code: "schema_mismatch",
          path: "/",
          message: "Document must contain only bounded JSON data.",
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain(sentinel);
  });

  it("rejects adversarial node counts with one bounded generic issue", () => {
    const document = clone(validFixture.gameOperatingModel);
    const provenance = asJsonObject(document.provenance, "provenance");
    provenance.traceIds = new Array(MAX_INTELLIGENCE_DOCUMENT_NODES + 1);

    const result = validateIntelligenceContract("gameOperatingModel", document);

    expect(result).toEqual({
      ok: false,
      kind: "gameOperatingModel",
      validated: false,
      code: "input_budget_exceeded",
      issues: [
        {
          code: "schema_mismatch",
          path: "/",
          message: "Document exceeds the fixed validation budget.",
        },
      ],
    });
  });

  it("accepts high-cardinality radar documents allowed by the committed schema", () => {
    const document = clone(validFixture.radarSnapshot) as JsonObject;
    const entries = asJsonObjects(document.entries, "radar entries");
    const entryTemplate = clone(entries[0]);
    const signalTemplate = clone(
      asJsonObjects(entryTemplate.signals, "radar entry signals")[0],
    );
    const scoreTemplate = clone(
      asJsonObjects(entryTemplate.ordinalScores, "radar ordinal scores")[0],
    );
    const sourceUrl = signalTemplate.sourceUrl;
    const observedAt = signalTemplate.observedAt;

    document.corpusRecordIds = Array.from(
      { length: 64 },
      (_, index) => `corpus:max-${index}`,
    );
    const provenance = asJsonObject(document.provenance, "radar provenance");
    provenance.evidenceIds = Array.from(
      { length: 640 },
      (_, index) => `evidence:radar-max-${index}`,
    );
    provenance.traceIds = Array.from(
      { length: 64 },
      (_, index) => `trace:radar-max-${index}`,
    );

    document.entries = Array.from({ length: 32 }, (_, entryIndex) => {
      const entry = clone(entryTemplate);
      entry.id = `radarentry:max-${entryIndex}`;
      entry.universeId = entryIndex + 1;
      entry.rootPlaceId = entryIndex + 101;
      entry.signals = Array.from({ length: 24 }, (_, signalIndex) => ({
        ...clone(signalTemplate),
        id: `publicsignal:max-${entryIndex}-${signalIndex}`,
        evidenceId: `evidence:signal-${entryIndex}-${signalIndex}`,
      }));
      entry.ordinalScores = Array.from({ length: 8 }, (_, scoreIndex) => ({
        ...clone(scoreTemplate),
        dimension: ["visibility", "momentum", "recency"][scoreIndex % 3],
        evidenceIds: Array.from(
          { length: 64 },
          (_, evidenceIndex) =>
            `evidence:score-${entryIndex}-${scoreIndex}-${evidenceIndex}`,
        ),
      }));
      entry.patternTags = Array.from(
        { length: 32 },
        (_, tagIndex) => `radar-tag-${entryIndex}-${tagIndex}`,
      );
      entry.publicOffers = Array.from({ length: 18 }, (_, offerIndex) => ({
        evidenceId: `evidence:offer-${entryIndex}-${offerIndex}`,
        offerType: "game_pass",
        offerId: offerIndex + 1,
        sourceUrl,
        observedAt,
        locale: "en-US",
        priceContext: "anonymous_public_page",
        priceRobux: offerIndex,
      }));
      entry.discontinuities = Array.from(
        { length: 2 },
        (_, discontinuityIndex) => ({
          metric: discontinuityIndex === 0 ? "visits" : "favorites",
          previousValue: discontinuityIndex,
          currentValue: discontinuityIndex + 1,
          previousEvidenceId: `evidence:previous-${entryIndex}-${discontinuityIndex}`,
          evidenceId: `evidence:current-${entryIndex}-${discontinuityIndex}`,
          observedAt,
        }),
      );
      return entry;
    });

    const schemaValidator = validate(
      "radar-snapshot.v1.schema.json",
      document,
    );
    expect(
      schemaValidator.errors,
      formatErrors(schemaValidator.errors),
    ).toBeNull();
    expect(countJsonNodes(document)).toBeGreaterThan(30_000);
    expect(countJsonNodes(document)).toBeLessThan(
      MAX_INTELLIGENCE_DOCUMENT_NODES,
    );

    const result = validateIntelligenceContract("radarSnapshot", document);
    expect(result).toMatchObject({
      ok: true,
      kind: "radarSnapshot",
      validated: true,
    });
  });

  it("rejects adversarial nesting with one bounded generic issue", () => {
    const document: JsonObject = { schemaVersion: SCHEMA_VERSION };
    let cursor = document;
    for (let depth = 0; depth < 100; depth += 1) {
      const child: JsonObject = {};
      cursor.child = child;
      cursor = child;
    }

    const result = validateIntelligenceContract("common", document);

    expect(result).toEqual({
      ok: false,
      kind: "common",
      validated: false,
      code: "input_budget_exceeded",
      issues: [
        {
          code: "schema_mismatch",
          path: "/",
          message: "Document exceeds the fixed validation budget.",
        },
      ],
    });
  });

  it("bounds TypeScript adapter issues without echoing document content", () => {
    const sentinel = "sk-live-typescript-adapter-secret-sentinel";
    const document = clone(validFixture.gameOperatingModel);
    document.unexpectedCredential = sentinel;

    const result = validateIntelligenceContract("gameOperatingModel", document);
    expect(result).toMatchObject({
      ok: false,
      validated: false,
      code: "schema_validation_failed",
    });
    if (result.ok) {
      throw new Error("invalid document unexpectedly validated");
    }

    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.length).toBeLessThanOrEqual(
      MAX_INTELLIGENCE_VALIDATION_ISSUES,
    );
    expect(JSON.stringify(result)).not.toContain(sentinel);
    expect(
      result.issues.every(
        (issue) => issue.path.length <= 256 && issue.message.length <= 160,
      ),
    ).toBe(true);
  });

  it("rejects unknown properties at the top level and in nested objects", () => {
    const topLevel = clone(validFixture.gameBrief) as JsonObject;
    topLevel.unreviewedPayload = "not allowed";
    const topValidator = validate("game-brief.v1.schema.json", topLevel);
    expect(topValidator.errors).not.toBeNull();
    expect(hasAdditionalPropertyError(topValidator.errors, "unreviewedPayload")).toBe(true);

    const nested = clone(validFixture.gameBrief) as JsonObject;
    (nested.audience as JsonObject).privateMetric = 42;
    const nestedValidator = validate("game-brief.v1.schema.json", nested);
    expect(nestedValidator.errors).not.toBeNull();
    expect(hasAdditionalPropertyError(nestedValidator.errors, "privateMetric")).toBe(true);
  });

  it("validates exactly the thirteen typed Director operation variants", () => {
    const expectedTypes = [
      "brief.set_field",
      "question.answer",
      "scene.add",
      "scene.update",
      "scene.remove",
      "objective.add",
      "objective.update",
      "objective.remove",
      "progression.update",
      "economy.update",
      "runtime_rule.update",
      "feedback.update",
      "acceptance_test.update",
    ];
    const proposal = validFixture.directorProposal as JsonObject;
    const operations = proposal.operations as JsonObject[];

    expect(operations.map((operation) => operation.type)).toEqual(expectedTypes);

    for (const operation of operations) {
      const singleOperationProposal = clone(proposal);
      singleOperationProposal.operations = [clone(operation)];
      const validator = validate(
        "director-proposal.v1.schema.json",
        singleOperationProposal,
      );
      expect(
        validator.errors,
        `${String(operation.type)}: ${formatErrors(validator.errors)}`,
      ).toBeNull();

      for (const requiredField of ["before", "inverse", "traceIds"]) {
        const missingFieldProposal = clone(singleOperationProposal);
        const missingFieldOperation = (
          missingFieldProposal.operations as JsonObject[]
        )[0];
        delete missingFieldOperation[requiredField];
        const missingValidator = validate(
          "director-proposal.v1.schema.json",
          missingFieldProposal,
        );
        expect(
          missingValidator.errors,
          `${String(operation.type)} must require ${requiredField}`,
        ).not.toBeNull();
      }
    }
  });

  it.each([
    ["scene.remove", 1],
    ["objective.remove", 1],
  ])("requires a bounded restoreIndex for %s", (type, restoreIndex) => {
    const proposal = clone(validFixture.directorProposal) as JsonObject;
    const operation = asJsonObjects(
      proposal.operations,
      "directorProposal.operations",
    ).find((candidate) => candidate.type === type);
    if (!operation) {
      throw new Error(`Missing ${type} fixture operation`);
    }
    const inverse = asJsonObject(operation.inverse, `${type}.inverse`);
    inverse.restoreIndex = restoreIndex;

    const valid = validate("director-proposal.v1.schema.json", proposal);
    expect(valid.errors, formatErrors(valid.errors)).toBeNull();

    delete inverse.restoreIndex;
    expect(validate("director-proposal.v1.schema.json", proposal).errors).not.toBeNull();

    inverse.restoreIndex = -1;
    expect(validate("director-proposal.v1.schema.json", proposal).errors).not.toBeNull();

    inverse.restoreIndex = 64;
    expect(validate("director-proposal.v1.schema.json", proposal).errors).not.toBeNull();
  });

  it("documents the mandatory post-Ajv Director semantic invariant layer", () => {
    const proposalSchema = asJsonObject(
      schemas.get("director-proposal.v1.schema.json"),
      "director proposal schema",
    );
    const comment = String(proposalSchema.$comment);

    expect(comment).toContain("semanticValidation");
    expect(comment.toLowerCase()).toContain("mandatory");
  });

  it.each([
    {
      status: "unanswered",
      briefStatus: "needs_answers",
      answer: { status: "unanswered" },
    },
    {
      status: "answered",
      briefStatus: "approved",
      answer: {
        status: "answered",
        response: "No. The route remains equally completable.",
        decidedBy: "human:steve",
        decidedAt: "2026-07-14T00:00:00Z",
      },
    },
    {
      status: "deferred",
      briefStatus: "needs_answers",
      answer: {
        status: "deferred",
        reason: "Awaiting a human accessibility review.",
        decidedBy: "human:steve",
        decidedAt: "2026-07-14T00:00:00Z",
      },
    },
    {
      status: "answered-valid",
      briefStatus: "valid",
      answer: {
        status: "answered",
        response: "The material question is resolved before approval.",
        decidedBy: "human:steve",
        decidedAt: "2026-07-14T00:00:00Z",
      },
    },
  ])("accepts an honest Game Brief $status question state", ({ briefStatus, answer }) => {
    const brief = clone(asJsonObject(validFixture.gameBrief, "gameBrief"));
    brief.status = briefStatus;
    asJsonObjects(brief.materialQuestions, "gameBrief.materialQuestions")[0].answer =
      answer;

    const validator = validate("game-brief.v1.schema.json", brief);
    expect(validator.errors, formatErrors(validator.errors)).toBeNull();
  });

  it.each([
    {
      status: "candidate",
      approvalMetadata: { approvalRequired: true, state: "pending" },
    },
    {
      status: "invalid",
      approvalMetadata: { approvalRequired: true, state: "pending" },
    },
    {
      status: "pending_approval",
      approvalMetadata: { approvalRequired: true, state: "pending" },
    },
    {
      status: "approved",
      approvalMetadata: {
        approvalRequired: true,
        state: "approved",
        decidedBy: "human:steve",
        decidedAt: "2026-07-14T00:00:00Z",
        decisionEvidenceIds: ["evidence:tower-of-hell-public-visits"],
      },
    },
    {
      status: "superseded",
      approvalMetadata: {
        approvalRequired: true,
        state: "approved",
        decidedBy: "human:steve",
        decidedAt: "2026-07-14T00:00:00Z",
        decisionEvidenceIds: ["evidence:tower-of-hell-public-visits"],
      },
    },
  ])(
    "accepts honest GOM lifecycle $status with approval state $approvalMetadata.state",
    ({ status, approvalMetadata }) => {
      const gom = clone(asJsonObject(validFixture.gameOperatingModel, "gom"));
      gom.status = status;
      gom.approvalMetadata = approvalMetadata;

      const validator = validate("game-operating-model.v1.schema.json", gom);
      expect(validator.errors, formatErrors(validator.errors)).toBeNull();
    },
  );

  it.each([
    {
      lifecycleStatus: "draft",
      approval: { required: true, state: "pending" },
    },
    {
      lifecycleStatus: "pending-approval",
      approval: { required: true, state: "pending" },
    },
    {
      lifecycleStatus: "approved",
      approval: {
        required: true,
        state: "approved",
        decidedBy: "human:steve",
        decidedAt: "2026-07-14T00:00:00Z",
      },
    },
    {
      lifecycleStatus: "rejected",
      approval: {
        required: true,
        state: "rejected",
        reason: "The proposal does not meet the safety boundary.",
        decidedBy: "human:steve",
        decidedAt: "2026-07-14T00:00:00Z",
      },
    },
    {
      lifecycleStatus: "applied",
      approval: {
        required: true,
        state: "approved",
        decidedBy: "human:steve",
        decidedAt: "2026-07-14T00:00:00Z",
      },
    },
  ])(
    "accepts honest Director lifecycle $lifecycleStatus with decision $approval.state",
    ({ lifecycleStatus, approval }) => {
      const proposal = clone(asJsonObject(validFixture.directorProposal, "proposal"));
      proposal.lifecycleStatus = lifecycleStatus;
      proposal.approval = approval;

      const validator = validate("director-proposal.v1.schema.json", proposal);
      expect(validator.errors, formatErrors(validator.errors)).toBeNull();
    },
  );

  it("rejects pending and unanswered states that fabricate decision metadata", () => {
    const brief = clone(asJsonObject(validFixture.gameBrief, "gameBrief"));
    brief.status = "needs_answers";
    asJsonObjects(brief.materialQuestions, "materialQuestions")[0].answer = {
      status: "unanswered",
      response: "fabricated",
      decidedBy: "human:steve",
      decidedAt: "2026-07-14T00:00:00Z",
    };
    expect(validate("game-brief.v1.schema.json", brief).errors).not.toBeNull();

    const gom = clone(asJsonObject(validFixture.gameOperatingModel, "gom"));
    gom.status = "pending_approval";
    gom.approvalMetadata = {
      approvalRequired: true,
      state: "pending",
      decidedBy: "human:steve",
      decidedAt: "2026-07-14T00:00:00Z",
    };
    expect(validate("game-operating-model.v1.schema.json", gom).errors).not.toBeNull();

    const proposal = clone(asJsonObject(validFixture.directorProposal, "proposal"));
    proposal.lifecycleStatus = "pending-approval";
    proposal.approval = {
      required: true,
      state: "pending",
      decidedBy: "human:steve",
      decidedAt: "2026-07-14T00:00:00Z",
    };
    expect(validate("director-proposal.v1.schema.json", proposal).errors).not.toBeNull();
  });

  it("rejects decided states missing their required response, reason, or actor", () => {
    const brief = clone(asJsonObject(validFixture.gameBrief, "gameBrief"));
    asJsonObjects(brief.materialQuestions, "materialQuestions")[0].answer = {
      status: "answered",
      decidedBy: "human:steve",
      decidedAt: "2026-07-14T00:00:00Z",
    };
    expect(validate("game-brief.v1.schema.json", brief).errors).not.toBeNull();

    const gom = clone(asJsonObject(validFixture.gameOperatingModel, "gom"));
    gom.status = "approved";
    gom.approvalMetadata = {
      approvalRequired: true,
      state: "approved",
      decidedAt: "2026-07-14T00:00:00Z",
      decisionEvidenceIds: ["evidence:tower-of-hell-public-visits"],
    };
    expect(validate("game-operating-model.v1.schema.json", gom).errors).not.toBeNull();

    const proposal = clone(asJsonObject(validFixture.directorProposal, "proposal"));
    proposal.lifecycleStatus = "rejected";
    proposal.approval = {
      required: true,
      state: "rejected",
      decidedBy: "human:steve",
      decidedAt: "2026-07-14T00:00:00Z",
    };
    expect(validate("director-proposal.v1.schema.json", proposal).errors).not.toBeNull();
  });

  it("rejects parent lifecycle and child decision-state mismatches", () => {
    const gom = clone(asJsonObject(validFixture.gameOperatingModel, "gom"));
    gom.status = "approved";
    gom.approvalMetadata = { approvalRequired: true, state: "pending" };
    expect(validate("game-operating-model.v1.schema.json", gom).errors).not.toBeNull();

    const proposal = clone(asJsonObject(validFixture.directorProposal, "proposal"));
    proposal.lifecycleStatus = "approved";
    proposal.approval = { required: true, state: "pending" };
    expect(validate("director-proposal.v1.schema.json", proposal).errors).not.toBeNull();

    const brief = clone(asJsonObject(validFixture.gameBrief, "gameBrief"));
    brief.status = "approved";
    asJsonObjects(brief.materialQuestions, "materialQuestions")[0].answer = {
      status: "unanswered",
    };
    expect(validate("game-brief.v1.schema.json", brief).errors).not.toBeNull();
  });

  it("does not retain unused common schemaVersion or generic uri definitions", () => {
    const commonSchema = asJsonObject(schemas.get("common.schema.json"), "common");
    const definitions = asJsonObject(commonSchema.$defs, "common.$defs");

    expect(definitions).not.toHaveProperty("schemaVersion");
    expect(definitions).not.toHaveProperty("uri");
  });

  it("uses the exact committed Brief and GOM lifecycle literals", () => {
    const briefSchema = asJsonObject(
      schemas.get("game-brief.v1.schema.json"),
      "game brief schema",
    );
    const briefProperties = asJsonObject(briefSchema.properties, "brief properties");
    expect(asJsonObject(briefProperties.status, "brief status").enum).toEqual([
      "draft",
      "needs_answers",
      "valid",
      "approved",
    ]);

    const gomSchema = asJsonObject(
      schemas.get("game-operating-model.v1.schema.json"),
      "GOM schema",
    );
    const gomProperties = asJsonObject(gomSchema.properties, "GOM properties");
    expect(asJsonObject(gomProperties.status, "GOM status").enum).toEqual([
      "candidate",
      "invalid",
      "pending_approval",
      "approved",
      "superseded",
    ]);
    const gomDefinitions = asJsonObject(gomSchema.$defs, "GOM definitions");
    expect(gomDefinitions).not.toHaveProperty("rejectedApprovalMetadata");
  });

  it.each([
    "rawIdea",
    "playerFantasy",
    "intendedAchievement",
    "genre",
    "audience",
  ])("validates the exact Game Brief shape for brief.set_field %s", (field) => {
    const brief = asJsonObject(validFixture.gameBrief, "gameBrief");
    const proposal = proposalWithBriefField(field, brief[field]);
    const validator = validate("director-proposal.v1.schema.json", proposal);
    expect(validator.errors, formatErrors(validator.errors)).toBeNull();
  });

  it.each(["intendedAchievement", "genre", "audience"])(
    "rejects a string-valued object field for brief.set_field %s",
    (field) => {
      const proposal = proposalWithBriefField(field, "not the declared object shape");
      const validator = validate("director-proposal.v1.schema.json", proposal);
      expect(validator.errors, formatErrors(validator.errors)).not.toBeNull();
    },
  );

  it.each(["rawIdea", "playerFantasy"])(
    "rejects an object-valued string field for brief.set_field %s",
    (field) => {
      const proposal = proposalWithBriefField(field, { unexpected: "object" });
      const validator = validate("director-proposal.v1.schema.json", proposal);
      expect(validator.errors, formatErrors(validator.errors)).not.toBeNull();
    },
  );

  it.each([
    "rawIdea",
    "playerFantasy",
    "intendedAchievement",
    "genre",
    "audience",
  ])("requires brief.set_field %s inverse to use the same field shape", (field) => {
    const brief = asJsonObject(validFixture.gameBrief, "gameBrief");
    const wrongInverse =
      field === "rawIdea" || field === "playerFantasy"
        ? { unexpected: "object" }
        : "not the declared object shape";
    const proposal = proposalWithBriefField(field, brief[field], wrongInverse);
    const validator = validate("director-proposal.v1.schema.json", proposal);
    expect(validator.errors, formatErrors(validator.errors)).not.toBeNull();
    expect(
      (validator.errors ?? []).some(
        (error) =>
          error.instancePath === "/operations/0/inverse/restoreValue" &&
          error.keyword === "type",
      ),
      `${field} must reject the inverse value at its exact field path`,
    ).toBe(true);
  });

  it.each([
    "https://evidence.example.test/public/game",
    "https://subdomain.example.com:8443/public/game?view=summary",
    "https://xn--bcher-kva.example/public/game",
  ])("accepts public HTTPS domain URL %s for every evidence consumer", (url) => {
    for (const { label, filename, document } of publicUrlCases(url)) {
      const validator = validate(filename, document);
      expect(validator.errors, `${label}: ${formatErrors(validator.errors)}`).toBeNull();
    }
  });

  it.each([
    ["localhost", "https://localhost/private"],
    ["localhost subdomain", "https://metadata.localhost/private"],
    ["IPv4 loopback", "https://127.42.0.1/private"],
    ["unspecified IPv4", "https://0.0.0.0/private"],
    ["RFC1918 10/8", "https://10.1.2.3/private"],
    ["RFC1918 172.16/12", "https://172.31.255.254/private"],
    ["RFC1918 192.168/16", "https://192.168.1.1/private"],
    ["CGNAT", "https://100.64.0.1/private"],
    ["IPv4 link-local", "https://169.254.169.254/latest/meta-data"],
    ["IPv6 loopback", "https://[::1]/private"],
    ["IPv6 link-local", "https://[fe80::1]/private"],
    ["IPv6 ULA", "https://[fd12:3456:789a::1]/private"],
    ["userinfo", "https://user:password@evidence.example.com/private"],
    ["percent-encoded loopback", "https://%31%32%37.0.0.1/private"],
    ["Windows file", "file:///C:/Users/Steve/private-evidence.json"],
    ["Unix file", "file:///etc/passwd"],
    ["UNC file", "file://server/share/private-evidence.json"],
    ["data", "data:text/plain,private-evidence"],
    ["javascript", "javascript:alert(1)"],
    ["HTTP", "http://evidence.example.test/public/game"],
    ["FTP", "ftp://evidence.example.test/public/game"],
  ])("rejects %s URLs for every public evidence URL consumer", (_scheme, url) => {
    for (const { label, filename, document } of publicUrlCases(url)) {
      const validator = validate(filename, document);
      expect(validator.errors, `${label} accepted ${url}`).not.toBeNull();
    }
  });

  it("uses the documented public URL lexical boundary at all six consumers", () => {
    const publicUrlRefs: string[] = [];
    for (const [filename, schema] of schemas) {
      walkSchema(schema, filename, (node, path) => {
        if (
          typeof node.$ref === "string" &&
          node.$ref.includes("common.schema.json#/$defs/") &&
          node.$ref.toLowerCase().includes("uri")
        ) {
          publicUrlRefs.push(`${path}:${node.$ref}`);
        }
      });
    }

    expect(publicUrlRefs).toHaveLength(6);
    expect(
      publicUrlRefs.every((entry) =>
        entry.endsWith("common.schema.json#/$defs/publicHttpsUri"),
      ),
      publicUrlRefs.join("\n"),
    ).toBe(true);

    const commonSchema = asJsonObject(
      schemas.get("common.schema.json"),
      "common schema",
    );
    const definitions = asJsonObject(commonSchema.$defs, "common schema definitions");
    const publicHttpsUri = asJsonObject(
      definitions.publicHttpsUri,
      "publicHttpsUri definition",
    );
    expect(String(publicHttpsUri.$comment).toLowerCase()).toContain("runtime");
    expect(String(publicHttpsUri.$comment).toLowerCase()).toContain("not fetch");
  });

  it("keeps all intelligence document links coherent", () => {
    expectCoherentIntelligenceLinks(validFixture);
  });

  it("detects a mismatched Brief reference-analysis link", () => {
    const wrongReference = clone(validFixture);
    const wrongBrief = asJsonObject(wrongReference.gameBrief, "gameBrief");
    asJsonObjects(wrongBrief.referenceInputs, "gameBrief.referenceInputs")[0]
      .referenceAnalysisId = "referenceanalysis:mismatched";
    expect(() => expectCoherentIntelligenceLinks(wrongReference)).toThrow();
  });

  it("detects representative cross-document link mutations", () => {
    const wrongBrief = clone(validFixture);
    asJsonObject(wrongBrief.gameOperatingModel, "gameOperatingModel").briefId =
      "brief:mismatched";
    expect(() => expectCoherentIntelligenceLinks(wrongBrief)).toThrow();

    const wrongEvidence = clone(validFixture);
    const wrongRadar = asJsonObject(wrongEvidence.radarSnapshot, "radarSnapshot");
    const wrongEntry = asJsonObjects(wrongRadar.entries, "radarSnapshot.entries")[0];
    asJsonObjects(wrongEntry.signals, "radarSnapshot.entries/0/signals")[0].evidenceId =
      "evidence:mismatched";
    expect(() => expectCoherentIntelligenceLinks(wrongEvidence)).toThrow();

    const wrongAnalytics = clone(validFixture);
    const wrongGom = asJsonObject(wrongAnalytics.gameOperatingModel, "gameOperatingModel");
    asJsonObject(wrongGom.firstSessionPromise, "gameOperatingModel.firstSessionPromise")
      .successSignal = "analytics:mismatched";
    expect(() => expectCoherentIntelligenceLinks(wrongAnalytics)).toThrow();
  });

  it.each(["write_file", "delete_file", "shell", "source.replace"])(
    "rejects unlisted Director operation %s",
    (operationType) => {
      const proposal = clone(validFixture.directorProposal) as JsonObject;
      const operation = clone((proposal.operations as JsonObject[])[0]);
      operation.type = operationType;
      proposal.operations = [operation];

      const validator = validate("director-proposal.v1.schema.json", proposal);
      expect(validator.errors, formatErrors(validator.errors)).not.toBeNull();
    },
  );

  it.each([
    "hostPath",
    "command",
    "credential",
    "token",
    "apiKey",
    "fileOperation",
    "luauSource",
    "source",
  ])("rejects unsafe operation field %s", (field) => {
    const proposal = clone(validFixture.directorProposal) as JsonObject;
    const operation = (proposal.operations as JsonObject[])[0];
    operation[field] = "prohibited payload";

    const validator = validate("director-proposal.v1.schema.json", proposal);
    expect(validator.errors, formatErrors(validator.errors)).not.toBeNull();
    expect(hasAdditionalPropertyError(validator.errors, field)).toBe(true);
  });

  it("rejects a competitor estimatedRevenue claim as an additional property", () => {
    const validator = validate(
      "radar-snapshot.v1.schema.json",
      invalidCompetitorRevenue,
    );

    expect(validator.errors, formatErrors(validator.errors)).not.toBeNull();
    expect(hasAdditionalPropertyError(validator.errors, "estimatedRevenue")).toBe(true);
    expect(
      (validator.errors ?? []).some((error) =>
        error.instancePath.includes("/entries/0"),
      ),
    ).toBe(true);
  });

  it.each([
    "estimatedRevenue",
    "revenue",
    "payerConversion",
    "arpdau",
    "arppu",
  ])("rejects private financial radar metric %s", (metric) => {
    const radar = clone(validFixture.radarSnapshot) as JsonObject;
    ((radar.entries as JsonObject[])[0] as JsonObject)[metric] = 99;
    const radarValidator = validate("radar-snapshot.v1.schema.json", radar);
    expect(radarValidator.errors, formatErrors(radarValidator.errors)).not.toBeNull();
    expect(hasAdditionalPropertyError(radarValidator.errors, metric)).toBe(true);

    const signal = clone(validFixture.monetizationOpportunitySignal) as JsonObject;
    ((signal.publicSignals as JsonObject[])[0] as JsonObject)[metric] = 99;
    const signalValidator = validate(
      "monetization-opportunity-signal.v1.schema.json",
      signal,
    );
    expect(signalValidator.errors, formatErrors(signalValidator.errors)).not.toBeNull();
    expect(hasAdditionalPropertyError(signalValidator.errors, metric)).toBe(true);
  });

  it("rejects text and arrays that exceed practical contract limits", () => {
    const longText = clone(validFixture.gameBrief) as JsonObject;
    longText.rawIdea = "x".repeat(10_001);
    const textValidator = validate("game-brief.v1.schema.json", longText);
    expect(textValidator.errors, formatErrors(textValidator.errors)).not.toBeNull();
    expect((textValidator.errors ?? []).some((error) => error.keyword === "maxLength")).toBe(
      true,
    );

    const longArray = clone(validFixture.gameBrief) as JsonObject;
    const assumption = clone((longArray.assumptions as JsonObject[])[0]);
    longArray.assumptions = Array.from({ length: 65 }, (_, index) => ({
      ...clone(assumption),
      id: `assumption:overflow-${index}`,
    }));
    const arrayValidator = validate("game-brief.v1.schema.json", longArray);
    expect(arrayValidator.errors, formatErrors(arrayValidator.errors)).not.toBeNull();
    expect((arrayValidator.errors ?? []).some((error) => error.keyword === "maxItems")).toBe(
      true,
    );
  });

  it.each(["autoApprove", "autoPublish"])(
    "does not permit recommendation control field %s",
    (field) => {
      const recommendation = clone(validFixture.recommendation) as JsonObject;
      recommendation[field] = true;
      const validator = validate("recommendation.v1.schema.json", recommendation);
      expect(validator.errors, formatErrors(validator.errors)).not.toBeNull();
      expect(hasAdditionalPropertyError(validator.errors, field)).toBe(true);
    },
  );
});
