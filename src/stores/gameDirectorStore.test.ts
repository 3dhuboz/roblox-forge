import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDeterministicDirectorDraft } from "../intelligence/gameDirectorDraft";
import { evaluateReferenceInput } from "../intelligence/referenceInputPolicy";
import { useGameDirectorStore } from "./gameDirectorStore";

const userAuthoredReference = {
  sourceKind: "user_authored_abstract" as const,
  rightsBasis: "user_authored" as const,
  rightsEvidenceRef: "local-description",
  aiUseAuthorization: "user_authored" as const,
  aiUseEvidenceRef: "local-description",
  referenceLocator: "",
  selectedTraits: ["checkpoint_progression"] as const,
};

describe("Game Director store", () => {
  beforeEach(() => {
    useGameDirectorStore.getState().reset();
  });

  it("approves only the exact complete local draft fingerprint", async () => {
    await useGameDirectorStore.getState().generateDraft({
      idea: "A neon obby where players escape through ten checkpoint stages.",
      reference: userAuthoredReference,
    });

    const generated = useGameDirectorStore.getState();
    expect(generated.draft).not.toBeNull();
    expect(generated.approvalState).toBe("review");
    expect(generated.approveDraft()).toBe(true);
    const approved = useGameDirectorStore.getState();
    expect(approved.approvalState).toBe("approved_locally");
    expect(approved.approvedFingerprint).toBe(approved.draft?.fingerprint);

    approved.updateDraftField("intendedAchievement", "A changed goal");
    const edited = useGameDirectorStore.getState();
    expect(edited.approvalState).toBe("review");
    expect(edited.approvedFingerprint).toBeNull();
    expect(edited.draft?.fingerprint).not.toBe(approved.approvedFingerprint);
  });

  it("freezes generated drafts and rejects stale content bindings", async () => {
    const generated = await useGameDirectorStore.getState().generateDraft({
      idea: "A neon obby where players escape through ten checkpoint stages.",
      reference: userAuthoredReference,
    });
    expect(generated).not.toBeNull();
    expect(Object.isFrozen(generated)).toBe(true);
    expect(Object.isFrozen(generated?.loops)).toBe(true);
    expect(Object.isFrozen(generated?.assumptions)).toBe(true);
    expect(() => {
      if (generated) generated.intendedAchievement = "Mutated outside the store";
    }).toThrow();

    const state = useGameDirectorStore.getState();
    const staleFingerprintDraft = {
      ...state.draft!,
      intendedAchievement: "Changed without refingerprinting",
    };
    useGameDirectorStore.setState({ draft: staleFingerprintDraft });

    expect(useGameDirectorStore.getState().approveDraft()).toBe(false);
    expect(useGameDirectorStore.getState().approvalState).toBe("review");
    expect(useGameDirectorStore.getState().approvedFingerprint).toBeNull();
  });

  it("does not approve a brief after its assumptions are cleared", async () => {
    await useGameDirectorStore.getState().generateDraft({
      idea: "A neon obby where players escape through ten checkpoint stages.",
      reference: userAuthoredReference,
    });
    useGameDirectorStore.getState().updateDraftList("assumptions", []);

    expect(useGameDirectorStore.getState().approveDraft()).toBe(false);
  });

  it("cannot bypass the unsupported-genre gate by editing an Obby", async () => {
    await useGameDirectorStore.getState().generateDraft({
      idea: "A neon obby with ten checkpoint stages.",
      reference: userAuthoredReference,
    });
    useGameDirectorStore.getState().updateDraftField("genre", "Roleplay");

    const state = useGameDirectorStore.getState();
    expect(state.draft?.approvalBlocked).toBe(true);
    expect(state.approveDraft()).toBe(false);
  });

  it("cannot approve blocked references or unsupported genres", async () => {
    await useGameDirectorStore.getState().generateDraft({
      idea: "A deep roleplay city.",
      reference: {
        sourceKind: "public_metadata",
        rightsBasis: "public_metadata_only",
        rightsEvidenceRef: "",
        aiUseAuthorization: "not_authorized",
        aiUseEvidenceRef: null,
        referenceLocator: "https://www.roblox.com/games/123/RAW_WORLD",
        selectedTraits: ["social_co_play"],
      },
    });

    const state = useGameDirectorStore.getState();
    expect(state.approveDraft()).toBe(false);
    expect(state.approvalState).toBe("review");
    expect(JSON.stringify(state.draft)).not.toContain("RAW_WORLD");
  });

  it("does not let a stale authority completion replace a newer local draft", async () => {
    let resolveAuthority!: (value: unknown) => void;
    const authorityPromise = new Promise<unknown>((resolve) => {
      resolveAuthority = resolve;
    });
    const authority = { generateDraft: vi.fn(() => authorityPromise) };
    const firstIdea = "A jungle obby with ten checkpoint stages.";
    const firstGeneration = useGameDirectorStore.getState().generateDraft(
      { idea: firstIdea, reference: userAuthoredReference },
      authority,
    );

    const second = await useGameDirectorStore.getState().generateDraft({
      idea: "A space obby with checkpoints and quick recovery.",
      reference: userAuthoredReference,
    });
    const localCandidate = createDeterministicDirectorDraft({
      idea: firstIdea,
      referencePolicy: evaluateReferenceInput(userAuthoredReference),
    });
    resolveAuthority({
      ...localCandidate,
      mode: "authority",
      generatorVersion: "authority.v1",
      modeLabel: "Authority draft",
    });
    await firstGeneration;

    expect(second).not.toBeNull();
    expect(useGameDirectorStore.getState().draft?.fingerprint).toBe(
      second?.fingerprint,
    );
  });
});
