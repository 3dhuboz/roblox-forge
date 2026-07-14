import { readFileSync } from "node:fs";
import { join } from "node:path";

import Ajv2020, {
  type AnySchema,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { beforeAll, describe, expect, it } from "vitest";

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
