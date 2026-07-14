import { describe, expect, it, vi } from "vitest";
import { createDeterministicDirectorDraft } from "../intelligence/gameDirectorDraft";
import { evaluateReferenceInput } from "../intelligence/referenceInputPolicy";
import { requestGameDirectorDraft } from "./gameDirectorClient";

function policy(decision: "allowed" | "blocked" | "manual") {
  if (decision === "allowed") {
    return evaluateReferenceInput({
      sourceKind: "user_authored_abstract",
      rightsBasis: "user_authored",
      rightsEvidenceRef: "local-description",
      aiUseAuthorization: "user_authored",
      aiUseEvidenceRef: "local-description",
      referenceLocator: "",
      selectedTraits: ["visible_progression"],
    });
  }
  return evaluateReferenceInput({
    sourceKind:
      decision === "blocked" ? "public_metadata" : "copy_enabled_template",
    rightsBasis:
      decision === "blocked" ? "public_metadata_only" : "copy_enabled",
    rightsEvidenceRef: decision === "blocked" ? "" : "copy-setting",
    aiUseAuthorization: "not_authorized",
    aiUseEvidenceRef: null,
    referenceLocator: "https://www.roblox.com/games/999/RAW_SENTINEL",
    selectedTraits: ["visible_progression"],
  });
}

describe("Game Director client", () => {
  it("uses an explicit local fallback when authority is missing", async () => {
    const result = await requestGameDirectorDraft({
      idea: "An obby where players climb a collapsing space station.",
      referencePolicy: policy("allowed"),
    });

    expect(result.source).toBe("deterministic_local");
    expect(result.label).toBe(
      "Deterministic local draft — AI authority unavailable",
    );
  });

  it("falls back when authority throws or returns malformed output", async () => {
    const throwing = { generateDraft: vi.fn().mockRejectedValue(new Error("offline")) };
    const malformed = { generateDraft: vi.fn().mockResolvedValue({ success: true }) };

    await expect(
      requestGameDirectorDraft(
        {
          idea: "A jungle obby with checkpoints.",
          referencePolicy: policy("allowed"),
        },
        throwing,
      ),
    ).resolves.toMatchObject({ source: "deterministic_local" });
    await expect(
      requestGameDirectorDraft(
        {
          idea: "A jungle obby with checkpoints.",
          referencePolicy: policy("allowed"),
        },
        malformed,
      ),
    ).resolves.toMatchObject({ source: "deterministic_local" });
  });

  it("does not call future authority for a blocked arbitrary URL", async () => {
    const authority = { generateDraft: vi.fn() };
    const result = await requestGameDirectorDraft(
      {
        idea: "An obby inspired by the reference.",
        referencePolicy: policy("blocked"),
      },
      authority,
    );

    expect(authority.generateDraft).not.toHaveBeenCalled();
    expect(result.draft.approvalBlocked).toBe(true);
    expect(JSON.stringify(result)).not.toContain("RAW_SENTINEL");
  });

  it("keeps copy-enabled manual templates outside future authority", async () => {
    const authority = { generateDraft: vi.fn() };
    const result = await requestGameDirectorDraft(
      {
        idea: "An original obby with checkpoints.",
        referencePolicy: policy("manual"),
      },
      authority,
    );

    expect(authority.generateDraft).not.toHaveBeenCalled();
    expect(result.reason).toBe("reference_manual_only");
    expect(result.draft.approvalBlocked).toBe(true);
  });

  it("projects accepted authority output onto the closed draft contract", async () => {
    const referencePolicy = policy("allowed");
    const local = createDeterministicDirectorDraft({
      idea: "An original space obby with checkpoints.",
      referencePolicy,
    });
    const authority = {
      generateDraft: vi.fn().mockResolvedValue({
        ...local,
        mode: "authority",
        generatorVersion: "authority.v1",
        modeLabel: "Authority draft",
        leakedReference: "RAW_UNKNOWN_REFERENCE",
        loops: {
          ...local.loops,
          leakedMap: "RAW_UNKNOWN_MAP",
        },
      }),
    };

    const result = await requestGameDirectorDraft(
      {
        idea: "An original space obby with checkpoints.",
        referencePolicy,
      },
      authority,
    );

    expect(result.source).toBe("authority");
    expect(JSON.stringify(result.draft)).not.toContain("RAW_UNKNOWN");
    expect(authority.generateDraft).toHaveBeenCalledWith({
      idea: "An original space obby with checkpoints.",
      referenceTraits: ["visible_progression"],
    });
    expect(JSON.stringify(authority.generateDraft.mock.calls)).not.toContain(
      "immutable",
    );
  });

  it("rejects a forged allowed policy and sends no evidence to authority", async () => {
    const authority = { generateDraft: vi.fn() };
    const trusted = policy("allowed");
    const forged = {
      ...trusted,
      provenance: {
        ...trusted.provenance,
        rightsEvidenceRef: "forged-rights-evidence",
        aiUseEvidenceRef: "forged-ai-evidence",
      },
    };

    const result = await requestGameDirectorDraft(
      {
        idea: "An original obby with checkpoints.",
        referencePolicy: forged,
      },
      authority,
    );

    expect(authority.generateDraft).not.toHaveBeenCalled();
    expect(result.reason).toBe("reference_manual_only");
  });
});
