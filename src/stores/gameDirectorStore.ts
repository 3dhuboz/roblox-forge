import { create } from "zustand";
import {
  evaluateReferenceInput,
  type ReferenceInput,
  type ReferencePolicyResult,
} from "../intelligence/referenceInputPolicy";
import {
  directorDraftContentBinding,
  freezeDirectorDraft,
  isDirectorDraftApprovable,
  refingerprintDirectorDraft,
  type GameDirectorDraft,
} from "../intelligence/gameDirectorDraft";
import {
  requestGameDirectorDraft,
  type GameDirectorAuthority,
} from "../services/gameDirectorClient";

export type DirectorApprovalState =
  | "not_generated"
  | "review"
  | "approved_locally";

export type EditableDirectorField =
  | "genre"
  | "intendedAchievement"
  | "playerFantasy"
  | "loops.momentToMoment"
  | "loops.thirtySecond"
  | "loops.session"
  | "loops.longTerm"
  | "progression"
  | "outcomes.win"
  | "outcomes.failure"
  | "outcomes.recovery"
  | "economy.sources"
  | "economy.sinks"
  | "monetizationSafety"
  | "aesthetic";

export type EditableDirectorList =
  | "assumptions"
  | "materialQuestions"
  | "originalitySafeguards";

export interface DirectorGenerationInput {
  idea: string;
  reference: ReferenceInput;
}

interface GameDirectorStore {
  draft: GameDirectorDraft | null;
  draftContentBinding: string | null;
  referencePolicy: ReferencePolicyResult | null;
  generationStatus: "idle" | "generating" | "ready" | "error";
  generationLabel: string | null;
  error: string | null;
  approvalState: DirectorApprovalState;
  approvedFingerprint: string | null;
  approvedContentBinding: string | null;
  generateDraft: (
    input: DirectorGenerationInput,
    authority?: GameDirectorAuthority,
  ) => Promise<GameDirectorDraft | null>;
  updateDraftField: (field: EditableDirectorField, value: string) => void;
  updateDraftList: (field: EditableDirectorList, values: string[]) => void;
  approveDraft: () => boolean;
  reset: () => void;
}

let generationAttempt = 0;

const initialState = {
  draft: null,
  draftContentBinding: null,
  referencePolicy: null,
  generationStatus: "idle" as const,
  generationLabel: null,
  error: null,
  approvalState: "not_generated" as const,
  approvedFingerprint: null,
  approvedContentBinding: null,
};

function secureDraft(draft: GameDirectorDraft): GameDirectorDraft {
  return freezeDirectorDraft(refingerprintDirectorDraft(draft));
}

function updateField(
  draft: GameDirectorDraft,
  field: EditableDirectorField,
  value: string,
): GameDirectorDraft {
  switch (field) {
    case "genre": {
      const genre = value as GameDirectorDraft["genre"];
      if (genre === "Obby") return { ...draft, genre };
      const reason =
        "Only Obby briefs are approval-ready in this private-alpha slice.";
      const question =
        "This private-alpha builder currently supports an Obby path. Reframe and regenerate this concept before approval.";
      return {
        ...draft,
        genre,
        approvalBlocked: true,
        approvalBlockReasons: draft.approvalBlockReasons.includes(reason)
          ? draft.approvalBlockReasons
          : [...draft.approvalBlockReasons, reason],
        materialQuestions: draft.materialQuestions.includes(question)
          ? draft.materialQuestions
          : [...draft.materialQuestions, question],
      };
    }
    case "intendedAchievement":
    case "playerFantasy":
    case "progression":
    case "monetizationSafety":
    case "aesthetic":
      return { ...draft, [field]: value };
    case "loops.momentToMoment":
      return { ...draft, loops: { ...draft.loops, momentToMoment: value } };
    case "loops.thirtySecond":
      return { ...draft, loops: { ...draft.loops, thirtySecond: value } };
    case "loops.session":
      return { ...draft, loops: { ...draft.loops, session: value } };
    case "loops.longTerm":
      return { ...draft, loops: { ...draft.loops, longTerm: value } };
    case "outcomes.win":
      return { ...draft, outcomes: { ...draft.outcomes, win: value } };
    case "outcomes.failure":
      return { ...draft, outcomes: { ...draft.outcomes, failure: value } };
    case "outcomes.recovery":
      return { ...draft, outcomes: { ...draft.outcomes, recovery: value } };
    case "economy.sources":
      return { ...draft, economy: { ...draft.economy, sources: value } };
    case "economy.sinks":
      return { ...draft, economy: { ...draft.economy, sinks: value } };
  }
}

export const useGameDirectorStore = create<GameDirectorStore>((set, get) => ({
  ...initialState,

  generateDraft: async (input, authority) => {
    const attempt = ++generationAttempt;
    const referencePolicy = evaluateReferenceInput(input.reference);
    set({
      draft: null,
      draftContentBinding: null,
      referencePolicy,
      generationStatus: "generating",
      generationLabel: null,
      error: null,
      approvalState: "not_generated",
      approvedFingerprint: null,
      approvedContentBinding: null,
    });
    try {
      const result = await requestGameDirectorDraft(
        { idea: input.idea, referencePolicy },
        authority,
      );
      if (generationAttempt !== attempt) return null;
      const draft = secureDraft(result.draft);
      set({
        draft,
        draftContentBinding: directorDraftContentBinding(draft),
        generationStatus: "ready",
        generationLabel: result.label,
        approvalState: "review",
      });
      return draft;
    } catch (error) {
      if (generationAttempt !== attempt) return null;
      set({
        generationStatus: "error",
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  },

  updateDraftField: (field, value) => {
    const draft = get().draft;
    if (!draft) return;
    const nextDraft = secureDraft(updateField(draft, field, value));
    set({
      draft: nextDraft,
      draftContentBinding: directorDraftContentBinding(nextDraft),
      approvalState: "review",
      approvedFingerprint: null,
      approvedContentBinding: null,
    });
  },

  updateDraftList: (field, values) => {
    const draft = get().draft;
    if (!draft) return;
    const nextDraft = secureDraft({ ...draft, [field]: values });
    set({
      draft: nextDraft,
      draftContentBinding: directorDraftContentBinding(nextDraft),
      approvalState: "review",
      approvedFingerprint: null,
      approvedContentBinding: null,
    });
  },

  approveDraft: () => {
    const { draft, draftContentBinding } = get();
    if (!draft) return false;
    const currentBinding = directorDraftContentBinding(draft);
    const currentFingerprint = refingerprintDirectorDraft(draft).fingerprint;
    if (
      draftContentBinding !== currentBinding ||
      draft.fingerprint !== currentFingerprint ||
      !isDirectorDraftApprovable(draft)
    ) {
      set({
        approvalState: "review",
        approvedFingerprint: null,
        approvedContentBinding: null,
      });
      return false;
    }
    const securedDraft = freezeDirectorDraft(draft);
    set({
      draft: securedDraft,
      approvalState: "approved_locally",
      approvedFingerprint: securedDraft.fingerprint,
      approvedContentBinding: currentBinding,
    });
    return true;
  },

  reset: () => {
    generationAttempt += 1;
    set(initialState);
  },
}));
