import {
  closeDirectorDraft,
  createDeterministicDirectorDraft,
  isDirectorDraftStructurallyValid,
  LOCAL_DIRECTOR_LABEL,
  refingerprintDirectorDraft,
  type DirectorDraftInput,
  type GameDirectorDraft,
} from "../intelligence/gameDirectorDraft";
import { canEnterAiContext } from "../intelligence/referenceInputPolicy";
import type { AbstractReferenceTrait } from "../intelligence/referenceInputPolicy";

export interface GameDirectorAuthorityInput {
  readonly idea: string;
  readonly referenceTraits: readonly AbstractReferenceTrait[];
}

export interface GameDirectorAuthority {
  generateDraft(input: GameDirectorAuthorityInput): Promise<unknown>;
}

export interface GameDirectorResult {
  source: "authority" | "deterministic_local";
  label: string;
  reason:
    | "authority"
    | "missing_authority"
    | "reference_blocked"
    | "reference_manual_only"
    | "authority_error"
    | "malformed_authority";
  draft: GameDirectorDraft;
}

function localResult(
  input: DirectorDraftInput,
  reason: Exclude<GameDirectorResult["reason"], "authority">,
): GameDirectorResult {
  return {
    source: "deterministic_local",
    label: LOCAL_DIRECTOR_LABEL,
    reason,
    draft: createDeterministicDirectorDraft(input),
  };
}

export async function requestGameDirectorDraft(
  input: DirectorDraftInput,
  authority?: GameDirectorAuthority,
): Promise<GameDirectorResult> {
  if (input.referencePolicy.provenance.policyDecision === "blocked") {
    return localResult(input, "reference_blocked");
  }
  if (!canEnterAiContext(input.referencePolicy)) {
    return localResult(input, "reference_manual_only");
  }
  if (!authority) return localResult(input, "missing_authority");

  try {
    const authorityInput = Object.freeze({
      idea: input.idea.trim().replace(/\s+/g, " ").slice(0, 600),
      referenceTraits: Object.freeze([
        ...input.referencePolicy.safeContext.traits,
      ]),
    });
    const candidate = await authority.generateDraft(authorityInput);
    if (
      !isDirectorDraftStructurallyValid(candidate) ||
      candidate.mode !== "authority" ||
      candidate.generatorVersion !== "authority.v1"
    ) {
      return localResult(input, "malformed_authority");
    }
    const draft = refingerprintDirectorDraft(closeDirectorDraft(candidate));
    return {
      source: "authority",
      label: draft.modeLabel,
      reason: "authority",
      draft,
    };
  } catch {
    return localResult(input, "authority_error");
  }
}
