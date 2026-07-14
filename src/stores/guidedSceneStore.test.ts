import { beforeEach, describe, expect, it } from "vitest";
import { useGuidedSceneStore } from "./guidedSceneStore";
import { createApprovedDirectorSceneProposal } from "../intelligence/approvedDirectorScene";
import type { ProjectInfo } from "../types/project";
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

const project: ProjectInfo = {
  name: "Guided Neon Obby",
  path: "D:\\RobloxForge\\Guided Neon Obby",
  template: "obby",
  createdAt: "2026-07-15T00:00:00.000Z",
};

async function createApprovedProposal(idea = "A neon obby with ten checkpoint stages.") {
  await useGameDirectorStore.getState().generateDraft({
    idea,
    reference: userAuthoredReference,
  });
  expect(useGameDirectorStore.getState().approveDraft()).toBe(true);
  const director = useGameDirectorStore.getState();
  return createApprovedDirectorSceneProposal({
    draft: director.draft,
    draftContentBinding: director.draftContentBinding,
    approvalState: director.approvalState,
    approvedFingerprint: director.approvedFingerprint,
    approvedContentBinding: director.approvedContentBinding,
  });
}

describe("guided scene staging store", () => {
  beforeEach(() => {
    useGameDirectorStore.getState().reset();
    useGuidedSceneStore.getState().reset();
  });

  it("stages, binds, and atomically consumes a proposal exactly once", async () => {
    const proposal = await createApprovedProposal();

    expect(useGuidedSceneStore.getState().stage(proposal, "create-1")).toBe(true);
    expect(
      useGuidedSceneStore.getState().bindCreatedProject("create-1", project),
    ).toBe(true);

    expect(useGuidedSceneStore.getState().claimForProject(project.path)).toEqual(
      proposal,
    );
    expect(useGuidedSceneStore.getState().claimForProject(project.path)).toBeNull();
  });

  it("does not let the wrong creation attempt bind the staged proposal", async () => {
    const proposal = await createApprovedProposal();
    expect(useGuidedSceneStore.getState().stage(proposal, "create-current")).toBe(
      true,
    );

    expect(
      useGuidedSceneStore
        .getState()
        .bindCreatedProject("create-stale", project),
    ).toBe(false);
    expect(
      useGuidedSceneStore
        .getState()
        .bindCreatedProject("create-current", project),
    ).toBe(true);
  });

  it("does not expose a bound proposal to the wrong project path", async () => {
    const proposal = await createApprovedProposal();
    useGuidedSceneStore.getState().stage(proposal, "create-2");
    useGuidedSceneStore.getState().bindCreatedProject("create-2", project);

    expect(
      useGuidedSceneStore
        .getState()
        .claimForProject("D:\\RobloxForge\\Another Project"),
    ).toBeNull();
    expect(useGuidedSceneStore.getState().claimForProject(project.path)).toEqual(
      proposal,
    );
  });

  it("keeps the proposal private until a valid project path claims it", async () => {
    const proposal = await createApprovedProposal();
    useGuidedSceneStore.getState().stage(proposal, "create-private");

    expect(useGuidedSceneStore.getState().staged).toEqual({
      proposalId: proposal.proposalId,
      revision: proposal.revision,
      creationAttemptId: "create-private",
      projectPath: null,
    });
    expect(useGuidedSceneStore.getState().staged).not.toHaveProperty("proposal");
  });

  it("invalidates a proposal when the exact Director approval changes", async () => {
    const proposal = await createApprovedProposal();
    useGuidedSceneStore.getState().stage(proposal, "create-3");
    useGuidedSceneStore.getState().bindCreatedProject("create-3", project);

    useGameDirectorStore
      .getState()
      .updateDraftField("intendedAchievement", "Reach a newly edited final goal.");

    expect(useGuidedSceneStore.getState().claimForProject(project.path)).toBeNull();
  });

  it("rejects a proposal produced for an older approved Director brief", async () => {
    const oldProposal = await createApprovedProposal();
    await createApprovedProposal(
      "A jungle obby with original vine swings and twelve checkpoints.",
    );

    expect(useGuidedSceneStore.getState().stage(oldProposal, "create-old")).toBe(
      false,
    );
  });

  it("abandons a failed or cancelled matching creation attempt", async () => {
    const proposal = await createApprovedProposal();
    useGuidedSceneStore.getState().stage(proposal, "create-cancelled");

    useGuidedSceneStore.getState().abandonCreation("create-cancelled");

    expect(
      useGuidedSceneStore
        .getState()
        .bindCreatedProject("create-cancelled", project),
    ).toBe(false);
    expect(useGuidedSceneStore.getState().claimForProject(project.path)).toBeNull();
  });

  it("reset removes every staged and bound proposal", async () => {
    const proposal = await createApprovedProposal();
    useGuidedSceneStore.getState().stage(proposal, "create-reset");
    useGuidedSceneStore
      .getState()
      .bindCreatedProject("create-reset", project);

    useGuidedSceneStore.getState().reset();

    expect(useGuidedSceneStore.getState().staged).toBeNull();
    expect(useGuidedSceneStore.getState().claimForProject(project.path)).toBeNull();
  });
});
