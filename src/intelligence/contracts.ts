import commonSchemaSource from "../../schemas/intelligence/common.schema.json?raw";
import corpusRecordSchemaSource from "../../schemas/intelligence/corpus-record.v1.schema.json?raw";
import directorProposalSchemaSource from "../../schemas/intelligence/director-proposal.v1.schema.json?raw";
import gameBriefSchemaSource from "../../schemas/intelligence/game-brief.v1.schema.json?raw";
import gameOperatingModelSchemaSource from "../../schemas/intelligence/game-operating-model.v1.schema.json?raw";
import monetizationOpportunitySignalSchemaSource from "../../schemas/intelligence/monetization-opportunity-signal.v1.schema.json?raw";
import provenanceSchemaSource from "../../schemas/intelligence/provenance.v1.schema.json?raw";
import radarSnapshotSchemaSource from "../../schemas/intelligence/radar-snapshot.v1.schema.json?raw";
import recommendationSchemaSource from "../../schemas/intelligence/recommendation.v1.schema.json?raw";
import referenceAnalysisSchemaSource from "../../schemas/intelligence/reference-analysis.v1.schema.json?raw";

export const INTELLIGENCE_SCHEMA_DIALECT =
  "https://json-schema.org/draft/2020-12/schema" as const;
export const CURRENT_INTELLIGENCE_SCHEMA_VERSION = "1.0.0" as const;
export const SUPPORTED_INTELLIGENCE_SCHEMA_VERSIONS = [
  CURRENT_INTELLIGENCE_SCHEMA_VERSION,
] as const;

export const INTELLIGENCE_CONTRACT_KINDS = [
  "common",
  "gameBrief",
  "gameOperatingModel",
  "directorProposal",
  "provenance",
  "corpusRecord",
  "referenceAnalysis",
  "radarSnapshot",
  "monetizationOpportunitySignal",
  "recommendation",
] as const;

export type IntelligenceContractKind =
  (typeof INTELLIGENCE_CONTRACT_KINDS)[number];

export type IntelligenceJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly IntelligenceJsonValue[]
  | IntelligenceJsonObject;

export interface IntelligenceJsonObject {
  readonly [key: string]: IntelligenceJsonValue;
}

export interface VersionedIntelligenceDocument extends IntelligenceJsonObject {
  readonly schemaVersion: string;
}

export type MigratedIntelligenceDocument = VersionedIntelligenceDocument & {
  readonly schemaVersion: typeof CURRENT_INTELLIGENCE_SCHEMA_VERSION;
};

declare const validatedContractKind: unique symbol;

export type ValidatedIntelligenceDocument<
  Kind extends IntelligenceContractKind,
> = MigratedIntelligenceDocument & {
  readonly [validatedContractKind]: Kind;
};

export type IntelligenceContractDocuments = {
  readonly [Kind in IntelligenceContractKind]: ValidatedIntelligenceDocument<Kind>;
};

export interface IntelligenceContractSchema {
  readonly $schema: typeof INTELLIGENCE_SCHEMA_DIALECT;
  readonly $id: string;
  readonly [key: string]: unknown;
}

export interface IntelligenceContractDefinition<
  Kind extends IntelligenceContractKind = IntelligenceContractKind,
> {
  readonly kind: Kind;
  readonly schemaId: string;
  readonly schema: IntelligenceContractSchema;
}

const SCHEMA_IDS: Readonly<Record<IntelligenceContractKind, string>> = {
  common: "https://schemas.robloxforge.dev/intelligence/common.schema.json",
  gameBrief:
    "https://schemas.robloxforge.dev/intelligence/game-brief.v1.schema.json",
  gameOperatingModel:
    "https://schemas.robloxforge.dev/intelligence/game-operating-model.v1.schema.json",
  directorProposal:
    "https://schemas.robloxforge.dev/intelligence/director-proposal.v1.schema.json",
  provenance:
    "https://schemas.robloxforge.dev/intelligence/provenance.v1.schema.json",
  corpusRecord:
    "https://schemas.robloxforge.dev/intelligence/corpus-record.v1.schema.json",
  referenceAnalysis:
    "https://schemas.robloxforge.dev/intelligence/reference-analysis.v1.schema.json",
  radarSnapshot:
    "https://schemas.robloxforge.dev/intelligence/radar-snapshot.v1.schema.json",
  monetizationOpportunitySignal:
    "https://schemas.robloxforge.dev/intelligence/monetization-opportunity-signal.v1.schema.json",
  recommendation:
    "https://schemas.robloxforge.dev/intelligence/recommendation.v1.schema.json",
};

const SCHEMA_SOURCES: Readonly<Record<IntelligenceContractKind, string>> = {
  common: commonSchemaSource,
  gameBrief: gameBriefSchemaSource,
  gameOperatingModel: gameOperatingModelSchemaSource,
  directorProposal: directorProposalSchemaSource,
  provenance: provenanceSchemaSource,
  corpusRecord: corpusRecordSchemaSource,
  referenceAnalysis: referenceAnalysisSchemaSource,
  radarSnapshot: radarSnapshotSchemaSource,
  monetizationOpportunitySignal: monetizationOpportunitySignalSchemaSource,
  recommendation: recommendationSchemaSource,
};

function parseCommittedSchema(
  source: string,
  expectedId: string,
): IntelligenceContractSchema {
  const parsed: unknown = JSON.parse(source);
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    !("$schema" in parsed) ||
    parsed.$schema !== INTELLIGENCE_SCHEMA_DIALECT ||
    !("$id" in parsed) ||
    parsed.$id !== expectedId
  ) {
    throw new Error("invalid_committed_intelligence_schema");
  }
  return Object.freeze(parsed) as IntelligenceContractSchema;
}

export const INTELLIGENCE_CONTRACTS = Object.freeze(
  Object.fromEntries(
    INTELLIGENCE_CONTRACT_KINDS.map((kind) => {
      const schemaId = SCHEMA_IDS[kind];
      return [
        kind,
        Object.freeze({
          kind,
          schemaId,
          schema: parseCommittedSchema(SCHEMA_SOURCES[kind], schemaId),
        }),
      ];
    }),
  ) as {
    readonly [Kind in IntelligenceContractKind]: IntelligenceContractDefinition<Kind>;
  },
);

export function intelligenceContract<Kind extends IntelligenceContractKind>(
  kind: Kind,
): IntelligenceContractDefinition<Kind> {
  return INTELLIGENCE_CONTRACTS[kind];
}
