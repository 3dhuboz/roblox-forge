import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDeterministicDirectorDraft,
  directorDraftContentBinding,
  refingerprintDirectorDraft,
  type GameDirectorDraft,
} from "./gameDirectorDraft";
import {
  evaluateReferenceInput,
  type AbstractReferenceTrait,
} from "./referenceInputPolicy";
import {
  ApprovedDirectorSceneError,
  generateApprovedDirectorSceneProposal,
  isApprovedDirectorSceneApproval,
  validateApprovedDirectorSceneApproval,
  type ApprovedDirectorSceneApproval,
} from "./approvedDirectorScene";

const DEFAULT_TRAITS = [
  "checkpoint_progression",
  "rapid_recovery",
] as const satisfies readonly AbstractReferenceTrait[];

function approvalFor(
  idea = "A neon obby with readable hazards, fair checkpoints, and a final escape.",
  selectedTraits: readonly AbstractReferenceTrait[] = DEFAULT_TRAITS,
): ApprovedDirectorSceneApproval {
  const draft = createDeterministicDirectorDraft({
    idea,
    referencePolicy: evaluateReferenceInput({
      sourceKind: "user_authored_abstract",
      rightsBasis: "user_authored",
      rightsEvidenceRef: "local-description",
      aiUseAuthorization: "user_authored",
      aiUseEvidenceRef: "local-description",
      referenceLocator: "RAW_REFERENCE_NAME_SHOULD_NOT_SURVIVE",
      selectedTraits,
    }),
  });
  const contentBinding = directorDraftContentBinding(draft);
  return {
    draft,
    draftContentBinding: contentBinding,
    approvalState: "approved_locally",
    approvedFingerprint: draft.fingerprint,
    approvedContentBinding: contentBinding,
  };
}

function reapprove(
  approval: ApprovedDirectorSceneApproval,
  draft: GameDirectorDraft,
): ApprovedDirectorSceneApproval {
  const identified = refingerprintDirectorDraft(draft);
  const contentBinding = directorDraftContentBinding(identified);
  return {
    ...approval,
    draft: identified,
    draftContentBinding: contentBinding,
    approvedFingerprint: identified.fingerprint,
    approvedContentBinding: contentBinding,
  };
}

function rejectionCode(value: unknown): string | undefined {
  const result = validateApprovedDirectorSceneApproval(value);
  return result.ok ? undefined : result.code;
}

describe("approved Director scene generator", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns byte-identical proposals independent of clock and randomness", () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1).mockReturnValueOnce(99_999);
    vi.spyOn(Math, "random").mockReturnValueOnce(0.01).mockReturnValueOnce(0.99);
    const approval = approvalFor();

    const first = generateApprovedDirectorSceneProposal(approval);
    const second = generateApprovedDirectorSceneProposal(approval);

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.schemaVersion).toBe("1.0.0");
    expect(first.generatorVersion).toBe("guided-obby-v1");
    expect(first.proposalId).toMatch(/^guided-obby-[0-9a-f]{16}$/);
    expect(first.revision).toMatch(/^guided-obby-revision64-[0-9a-f]{16}$/);
    expect(first.source.fingerprint).toBe(approval.draft?.fingerprint);
    expect(first.source.contentBindingHash).toMatch(
      /^director-content64-[0-9a-f]{16}$/,
    );
  });

  it("builds a bounded editable Obby with progression, recovery, hazards, and victory", () => {
    const proposal = generateApprovedDirectorSceneProposal(
      approvalFor(undefined, [
        "checkpoint_progression",
        "skill_mastery",
        "escalating_challenge",
      ]),
    );
    const elementIds = proposal.elements.map((element) => element.id);
    const allowedTypes = new Set([
      "spawn",
      "ground",
      "platform",
      "moving-platform",
      "disappearing",
      "bouncy",
      "conveyor",
      "killbrick",
      "spinner",
      "laser",
      "spikes",
      "checkpoint",
    ]);

    expect(proposal.genre).toBe("Obby");
    expect(proposal.template).toBe("obby");
    expect(proposal.stageCount).toBe(5);
    expect(proposal.elements.filter((element) => element.type === "spawn")).toHaveLength(1);
    expect(
      proposal.elements.filter((element) => element.type === "checkpoint"),
    ).toHaveLength(proposal.stageCount);
    expect(
      proposal.elements.filter((element) => element.category === "obstacle"),
    ).toHaveLength(proposal.stageCount);
    expect(
      new Set(
        proposal.elements
          .filter((element) => element.category === "obstacle")
          .map((element) => element.type),
      ).size,
    ).toBeGreaterThan(1);
    expect(
      proposal.elements.some((element) => element.label === "Victory Platform"),
    ).toBe(true);
    expect(new Set(elementIds).size).toBe(elementIds.length);
    expect(proposal.elements.every((element) => allowedTypes.has(element.type))).toBe(true);
    expect(proposal.elements.every((element) => element.locked === false)).toBe(true);
    expect(proposal.elements.every((element) => element.visible === true)).toBe(true);
    expect(proposal.elements.every((element) => Object.keys(element.properties).length === 0)).toBe(true);
  });

  it("uses only closed theme and mechanic mappings", () => {
    const proposal = generateApprovedDirectorSceneProposal(
      approvalFor(
        "A neon obby with readable hazards, fair checkpoints, and a final escape.",
        ["skill_mastery", "escalating_challenge"],
      ),
    );

    expect(proposal.theme).toBe("neon");
    expect(proposal.mechanicTrack).toBe("precision");
    expect(proposal.stageCount).toBe(5);
  });

  it("changes every generated identity when the approved brief changes", () => {
    const neon = generateApprovedDirectorSceneProposal(approvalFor());
    const jungle = generateApprovedDirectorSceneProposal(
      approvalFor(
        "A jungle obby with readable hazards, fair checkpoints, and a final escape.",
      ),
    );

    expect(jungle.proposalId).not.toBe(neon.proposalId);
    expect(jungle.revision).not.toBe(neon.revision);
    expect(jungle.elements.map((element) => element.id)).not.toEqual(
      neon.elements.map((element) => element.id),
    );
  });

  it("never copies free text, URLs, scripts, or asset IDs into a proposal", () => {
    const approval = approvalFor();
    const approvalWithHostileText = reapprove(approval, {
      ...approval.draft!,
      aesthetic:
        "Copy RAW_REFERENCE_SECRET from https://www.roblox.com/games/123 and rbxassetid://456 using exploit.server.lua",
    });

    const serialized = JSON.stringify(
      generateApprovedDirectorSceneProposal(approvalWithHostileText),
    ).toLowerCase();

    expect(serialized).not.toContain("raw_reference_secret");
    expect(serialized).not.toContain("http");
    expect(serialized).not.toContain("www.");
    expect(serialized).not.toContain("rbxasset");
    expect(serialized).not.toContain(".lua");
    expect(serialized).not.toContain("script");
  });

  it("rejects missing, unapproved, and stale approval evidence", () => {
    const approval = approvalFor();

    expect(rejectionCode({ ...approval, draft: null })).toBe("missing_draft");
    expect(rejectionCode({ ...approval, approvalState: "review" })).toBe(
      "approval_required",
    );
    expect(rejectionCode({ ...approval, approvedFingerprint: null })).toBe(
      "missing_approval_evidence",
    );
    expect(rejectionCode({ ...approval, draftContentBinding: "stale" })).toBe(
      "stale_draft_binding",
    );
    expect(rejectionCode({ ...approval, approvedFingerprint: "stale" })).toBe(
      "stale_approval",
    );
  });

  it("rejects forged, blocked, and non-Obby drafts even with coherent stored strings", () => {
    const approval = approvalFor();
    const forged = {
      ...approval,
      draft: {
        ...approval.draft!,
        intendedAchievement: "Changed without recomputing identity",
      },
    };
    const blocked = reapprove(approval, {
      ...approval.draft!,
      approvalBlocked: true,
      approvalBlockReasons: ["Rights review is required."],
    });
    const nonObby = reapprove(approval, {
      ...approval.draft!,
      genre: "Roleplay",
    });

    expect(rejectionCode(forged)).toBe("forged_draft");
    expect(rejectionCode(blocked)).toBe("blocked_draft");
    expect(rejectionCode(nonObby)).toBe("unsupported_genre");
  });

  it("exposes a guard and typed fail-closed generator error", () => {
    const approval = approvalFor();

    expect(isApprovedDirectorSceneApproval(approval)).toBe(true);
    expect(isApprovedDirectorSceneApproval({ ...approval, approvalState: "review" })).toBe(
      false,
    );
    expect(() => generateApprovedDirectorSceneProposal(null)).toThrow(
      ApprovedDirectorSceneError,
    );
    try {
      generateApprovedDirectorSceneProposal(null);
    } catch (error) {
      expect(error).toBeInstanceOf(ApprovedDirectorSceneError);
      expect((error as ApprovedDirectorSceneError).code).toBe("invalid_approval");
    }
  });
});
