import { create } from "zustand";
import {
  generateApprovedDirectorSceneProposal,
  type GuidedSceneProposal,
} from "../intelligence/approvedDirectorScene";
import type { ProjectInfo } from "../types/project";
import { useGameDirectorStore } from "./gameDirectorStore";

export interface StagedGuidedScene {
  proposalId: string;
  revision: string;
  creationAttemptId: string;
  projectPath: string | null;
}

interface PrivateStagedGuidedScene extends StagedGuidedScene {
  proposal: GuidedSceneProposal;
}

interface GuidedSceneStore {
  staged: StagedGuidedScene | null;
  stage: (
    proposal: GuidedSceneProposal,
    creationAttemptId: string,
  ) => boolean;
  bindCreatedProject: (
    creationAttemptId: string,
    project: ProjectInfo,
  ) => boolean;
  abandonCreation: (creationAttemptId: string) => void;
  claimForProject: (projectPath: string) => GuidedSceneProposal | null;
  reset: () => void;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

function sameProposal(
  left: GuidedSceneProposal,
  right: GuidedSceneProposal,
): boolean {
  try {
    return (
      JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right))
    );
  } catch {
    return false;
  }
}

function currentApprovedProposal(): GuidedSceneProposal | null {
  const director = useGameDirectorStore.getState();
  try {
    return generateApprovedDirectorSceneProposal({
      draft: director.draft,
      draftContentBinding: director.draftContentBinding,
      approvalState: director.approvalState,
      approvedFingerprint: director.approvedFingerprint,
      approvedContentBinding: director.approvedContentBinding,
    });
  } catch {
    return null;
  }
}

function currentProposalMatches(proposal: GuidedSceneProposal): boolean {
  const current = currentApprovedProposal();
  return current !== null && sameProposal(proposal, current);
}

function isExactIdentifier(value: string): boolean {
  return value.length > 0 && value.trim() === value;
}

function publicStage(
  staged: PrivateStagedGuidedScene | null,
): StagedGuidedScene | null {
  if (staged === null) return null;
  return {
    proposalId: staged.proposalId,
    revision: staged.revision,
    creationAttemptId: staged.creationAttemptId,
    projectPath: staged.projectPath,
  };
}

export const useGuidedSceneStore = create<GuidedSceneStore>((set) => {
  let privateStage: PrivateStagedGuidedScene | null = null;

  const publishStage = () => set({ staged: publicStage(privateStage) });

  return {
    staged: null,

    stage: (proposal, creationAttemptId) => {
      const current = currentApprovedProposal();
      if (
        !isExactIdentifier(creationAttemptId) ||
        current === null ||
        !sameProposal(proposal, current)
      ) {
        privateStage = null;
        publishStage();
        return false;
      }

      privateStage = {
        proposal: current,
        proposalId: current.proposalId,
        revision: current.revision,
        creationAttemptId,
        projectPath: null,
      };
      publishStage();
      return true;
    },

    bindCreatedProject: (creationAttemptId, project) => {
      if (
        privateStage === null ||
        privateStage.projectPath !== null ||
        privateStage.creationAttemptId !== creationAttemptId ||
        !isExactIdentifier(project.path) ||
        project.template !== privateStage.proposal.template ||
        !currentProposalMatches(privateStage.proposal)
      ) {
        return false;
      }

      privateStage = { ...privateStage, projectPath: project.path };
      publishStage();
      return true;
    },

    abandonCreation: (creationAttemptId) => {
      if (privateStage?.creationAttemptId === creationAttemptId) {
        privateStage = null;
        publishStage();
      }
    },

    claimForProject: (projectPath) => {
      if (
        privateStage === null ||
        privateStage.projectPath === null ||
        privateStage.projectPath !== projectPath ||
        !currentProposalMatches(privateStage.proposal)
      ) {
        return null;
      }

      const proposal = privateStage.proposal;
      privateStage = null;
      publishStage();
      return proposal;
    },

    reset: () => {
      privateStage = null;
      publishStage();
    },
  };
});
