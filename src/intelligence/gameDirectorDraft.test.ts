import { describe, expect, it, vi } from "vitest";
import { evaluateReferenceInput } from "./referenceInputPolicy";
import {
  createDeterministicDirectorDraft,
  isDirectorDraftApprovable,
  refingerprintDirectorDraft,
} from "./gameDirectorDraft";

function safePolicy() {
  return evaluateReferenceInput({
    sourceKind: "user_authored_abstract",
    rightsBasis: "user_authored",
    rightsEvidenceRef: "local-description",
    aiUseAuthorization: "user_authored",
    aiUseEvidenceRef: "local-description",
    referenceLocator: "RAW_REFERENCE_NAME_SHOULD_NOT_SURVIVE",
    selectedTraits: ["checkpoint_progression", "rapid_recovery"],
  });
}

describe("deterministic Game Director draft", () => {
  it("returns byte-equivalent semantic output regardless of clock or random", () => {
    const dateSpy = vi.spyOn(Date, "now");
    const randomSpy = vi.spyOn(Math, "random");
    dateSpy.mockReturnValueOnce(1).mockReturnValueOnce(9_999_999);
    randomSpy.mockReturnValueOnce(0.01).mockReturnValueOnce(0.99);

    const input = {
      idea: "A neon obstacle course with checkpoints and a final escape.",
      referencePolicy: safePolicy(),
    };
    const first = createDeterministicDirectorDraft(input);
    const second = createDeterministicDirectorDraft(input);

    expect(second).toEqual(first);
    expect(first.modeLabel).toBe(
      "Deterministic local draft — AI authority unavailable",
    );
    expect(JSON.stringify(first)).not.toContain("RAW_REFERENCE_NAME");
    expect(isDirectorDraftApprovable(first)).toBe(true);
  });

  it("keeps unsupported genres review-only with a material question", () => {
    const draft = createDeterministicDirectorDraft({
      idea: "A deep open-world roleplay city with hundreds of jobs.",
      referencePolicy: evaluateReferenceInput({
        sourceKind: "user_authored_abstract",
        rightsBasis: "user_authored",
        rightsEvidenceRef: "local-description",
        aiUseAuthorization: "user_authored",
        aiUseEvidenceRef: "local-description",
        referenceLocator: "",
        selectedTraits: [],
      }),
    });

    expect(draft.genre).toBe("Roleplay");
    expect(draft.approvalBlocked).toBe(true);
    expect(draft.materialQuestions.length).toBeGreaterThan(0);
    expect(isDirectorDraftApprovable(draft)).toBe(false);
  });

  it("requires material fields, assumptions, and three originality safeguards", () => {
    const draft = createDeterministicDirectorDraft({
      idea: "A space obby with checkpoints and a final escape.",
      referencePolicy: safePolicy(),
    });

    expect(isDirectorDraftApprovable(draft)).toBe(true);
    expect(
      isDirectorDraftApprovable(
        refingerprintDirectorDraft({ ...draft, intendedAchievement: "" }),
      ),
    ).toBe(false);
    expect(
      isDirectorDraftApprovable(
        refingerprintDirectorDraft({
          ...draft,
          originalitySafeguards: ["Only one difference"],
        }),
      ),
    ).toBe(false);
    expect(
      isDirectorDraftApprovable(
        refingerprintDirectorDraft({ ...draft, assumptions: [] }),
      ),
    ).toBe(false);
    expect(
      isDirectorDraftApprovable(
        refingerprintDirectorDraft({ ...draft, assumptions: ["   "] }),
      ),
    ).toBe(false);
    expect(
      isDirectorDraftApprovable(
        refingerprintDirectorDraft({
          ...draft,
          genre: "Roleplay",
          approvalBlocked: false,
          approvalBlockReasons: [],
          materialQuestions: [],
        }),
      ),
    ).toBe(false);
  });
});
