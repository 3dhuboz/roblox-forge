import { describe, expect, it } from "vitest";
import {
  ABSTRACT_TRAIT_CATALOG,
  canEnterAiContext,
  evaluateReferenceInput,
  type ReferenceInput,
} from "./referenceInputPolicy";

const RAW_REFERENCE_SENTINEL =
  "https://www.roblox.com/games/123456/Copy-This-World";

function referenceInput(overrides: Partial<ReferenceInput> = {}): ReferenceInput {
  return {
    sourceKind: "public_metadata",
    rightsBasis: "public_metadata_only",
    rightsEvidenceRef: "",
    aiUseAuthorization: "not_authorized",
    aiUseEvidenceRef: null,
    referenceLocator: RAW_REFERENCE_SENTINEL,
    selectedTraits: ["checkpoint_progression", "not_a_catalog_trait"],
    ...overrides,
  };
}

describe("reference input policy", () => {
  it("blocks an arbitrary external reference and emits no raw reference data", () => {
    const result = evaluateReferenceInput(referenceInput());

    expect(result.provenance.policyDecision).toBe("blocked");
    expect(result.safeContext.traits).toEqual([]);
    expect(JSON.stringify(result)).not.toContain(RAW_REFERENCE_SENTINEL);
    expect(Object.keys(result.provenance).sort()).toEqual(
      [
        "aiUseAuthorization",
        "aiUseEvidenceRef",
        "policyDecision",
        "rightsBasis",
        "rightsEvidenceRef",
        "sourceKind",
      ].sort(),
    );
  });

  it("treats copy-enabled permission as manual-only, never AI-use permission", () => {
    const result = evaluateReferenceInput(
      referenceInput({
        sourceKind: "copy_enabled_template",
        rightsBasis: "copy_enabled",
        rightsEvidenceRef: "public-copy-setting",
        aiUseAuthorization: "not_authorized",
        aiUseEvidenceRef: null,
        selectedTraits: ["rapid_recovery", "checkpoint_progression"],
      }),
    );

    expect(result.provenance.policyDecision).toBe("needs_review");
    expect(result.safeContext.traits).toEqual([]);
    expect(canEnterAiContext(result)).toBe(false);
  });

  it("allows only fixed catalog traits after a complete owner declaration", () => {
    const result = evaluateReferenceInput(
      referenceInput({
        sourceKind: "owner_authored",
        rightsBasis: "owned",
        rightsEvidenceRef: "owner-record-17",
        aiUseAuthorization: "owner_authorized",
        aiUseEvidenceRef: "owner-ai-use-17",
        selectedTraits: [
          "social_co_play",
          "signature_character_POWER_9000",
          "checkpoint_progression",
          "social_co_play",
        ],
      }),
    );

    expect(result.provenance.policyDecision).toBe("allowed");
    expect(result.safeContext.traits).toEqual([
      "checkpoint_progression",
      "social_co_play",
    ]);
    expect(result.safeContext.traits.every((trait) =>
      ABSTRACT_TRAIT_CATALOG.includes(trait),
    )).toBe(true);
    expect(JSON.stringify(result)).not.toContain("POWER_9000");
  });

  it.each([
    ["owner_authored", "owned", "owner_authorized"],
    ["licensed_template", "expressly_licensed", "expressly_ai_licensed"],
    [
      "copy_enabled_template",
      "expressly_licensed",
      "expressly_ai_licensed",
    ],
    ["public_metadata", "public_metadata_only", "public_metadata_only"],
    ["user_authored_abstract", "user_authored", "user_authored"],
  ] as const)(
    "allows the canonical %s provenance tuple only with both evidence records",
    (sourceKind, rightsBasis, aiUseAuthorization) => {
      const result = evaluateReferenceInput(
        referenceInput({
          sourceKind,
          rightsBasis,
          rightsEvidenceRef: "immutable-rights-record",
          aiUseAuthorization,
          aiUseEvidenceRef: "immutable-ai-use-record",
        }),
      );

      expect(result.provenance.policyDecision).toBe("allowed");
      expect(canEnterAiContext(result)).toBe(true);
    },
  );

  it("rejects a structurally forged policy at the trusted AI boundary", () => {
    const trusted = evaluateReferenceInput(
      referenceInput({
        sourceKind: "user_authored_abstract",
        rightsBasis: "user_authored",
        rightsEvidenceRef: "local-description",
        aiUseAuthorization: "user_authored",
        aiUseEvidenceRef: "local-description",
      }),
    );
    const forged = {
      ...trusted,
      provenance: { ...trusted.provenance, policyDecision: "allowed" as const },
    };

    expect(canEnterAiContext(forged)).toBe(false);
  });
});
