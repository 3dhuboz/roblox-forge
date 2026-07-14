export const ABSTRACT_TRAIT_CATALOG = [
  "checkpoint_progression",
  "collection",
  "cooperative_play",
  "customization",
  "escalating_challenge",
  "exploration",
  "live_events",
  "rapid_recovery",
  "short_sessions",
  "skill_mastery",
  "social_co_play",
  "visible_progression",
] as const;

export type AbstractReferenceTrait =
  (typeof ABSTRACT_TRAIT_CATALOG)[number];

export type ReferenceSourceKind =
  | "owner_authored"
  | "licensed_template"
  | "copy_enabled_template"
  | "public_metadata"
  | "user_authored_abstract";

export type ReferenceRightsBasis =
  | "owned"
  | "expressly_licensed"
  | "copy_enabled"
  | "public_metadata_only"
  | "user_authored";

export type ReferencePolicyDecision = "allowed" | "needs_review" | "blocked";

export type ReferenceAiUseAuthorization =
  | "owner_authorized"
  | "expressly_ai_licensed"
  | "user_authored"
  | "public_metadata_only"
  | "not_authorized";

const REFERENCE_POLICY_BRAND: unique symbol = Symbol(
  "roblox-forge.reference-policy.v1",
);

export interface ReferenceInput {
  sourceKind: ReferenceSourceKind;
  rightsBasis: ReferenceRightsBasis;
  rightsEvidenceRef: string;
  aiUseAuthorization: ReferenceAiUseAuthorization;
  aiUseEvidenceRef: string | null;
  /** Input-only inert identifier. It is never returned or sent to authority. */
  referenceLocator: string;
  selectedTraits: readonly string[];
}

export interface ReferenceProvenance {
  sourceKind: ReferenceSourceKind;
  rightsBasis: ReferenceRightsBasis;
  rightsEvidenceRef: string;
  policyDecision: ReferencePolicyDecision;
  aiUseAuthorization: ReferenceAiUseAuthorization;
  aiUseEvidenceRef: string | null;
}

export interface ReferencePolicyResult {
  readonly [REFERENCE_POLICY_BRAND]: true;
  readonly provenance: Readonly<ReferenceProvenance>;
  readonly safeContext: {
    readonly traits: readonly AbstractReferenceTrait[];
  };
  readonly policyReasons: readonly string[];
}

function sanitizeEvidenceRef(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!trimmed || /(?:https?:\/\/|www\.)/i.test(trimmed)) return "";
  return trimmed.replace(/[^a-z0-9._:-]/gi, "-").slice(0, 120);
}

function sanitizeTraits(values: readonly string[]): AbstractReferenceTrait[] {
  const requested = new Set(values);
  return ABSTRACT_TRAIT_CATALOG.filter((trait) => requested.has(trait));
}

function hasEvidence(value: string | null): value is string {
  return typeof value === "string" && value.length > 0;
}

function hasAllowedTuple(input: {
  sourceKind: ReferenceSourceKind;
  rightsBasis: ReferenceRightsBasis;
  aiUseAuthorization: ReferenceAiUseAuthorization;
}): boolean {
  return (
    (input.sourceKind === "owner_authored" &&
      input.rightsBasis === "owned" &&
      input.aiUseAuthorization === "owner_authorized") ||
    (input.sourceKind === "licensed_template" &&
      input.rightsBasis === "expressly_licensed" &&
      input.aiUseAuthorization === "expressly_ai_licensed") ||
    (input.sourceKind === "copy_enabled_template" &&
      input.rightsBasis === "expressly_licensed" &&
      input.aiUseAuthorization === "expressly_ai_licensed") ||
    (input.sourceKind === "public_metadata" &&
      input.rightsBasis === "public_metadata_only" &&
      input.aiUseAuthorization === "public_metadata_only") ||
    (input.sourceKind === "user_authored_abstract" &&
      input.rightsBasis === "user_authored" &&
      input.aiUseAuthorization === "user_authored")
  );
}

function isTrustedPolicyResult(value: unknown): value is ReferencePolicyResult {
  if (!value || typeof value !== "object") return false;
  const policy = value as Partial<ReferencePolicyResult> & {
    [REFERENCE_POLICY_BRAND]?: boolean;
  };
  const provenance = policy.provenance;
  if (
    policy[REFERENCE_POLICY_BRAND] !== true ||
    !provenance ||
    !policy.safeContext ||
    !Array.isArray(policy.safeContext.traits)
  ) {
    return false;
  }
  return (
    provenance.policyDecision === "allowed" &&
    hasAllowedTuple(provenance) &&
    sanitizeEvidenceRef(provenance.rightsEvidenceRef) ===
      provenance.rightsEvidenceRef &&
    sanitizeEvidenceRef(provenance.aiUseEvidenceRef) ===
      provenance.aiUseEvidenceRef &&
    hasEvidence(provenance.rightsEvidenceRef) &&
    hasEvidence(provenance.aiUseEvidenceRef) &&
    policy.safeContext.traits.every((trait) =>
      (ABSTRACT_TRAIT_CATALOG as readonly string[]).includes(trait),
    )
  );
}

export function canEnterAiContext(policy: unknown): policy is ReferencePolicyResult {
  return (
    isTrustedPolicyResult(policy) &&
    policy.provenance.aiUseAuthorization !== "not_authorized"
  );
}

function closePolicyResult(
  provenance: ReferenceProvenance,
  traits: AbstractReferenceTrait[],
  policyReasons: string[],
): ReferencePolicyResult {
  const result = {
    provenance: Object.freeze({ ...provenance }),
    safeContext: Object.freeze({ traits: Object.freeze([...traits]) }),
    policyReasons: Object.freeze([...policyReasons]),
  } as Omit<ReferencePolicyResult, typeof REFERENCE_POLICY_BRAND> &
    Partial<Pick<ReferencePolicyResult, typeof REFERENCE_POLICY_BRAND>>;
  Object.defineProperty(result, REFERENCE_POLICY_BRAND, {
    value: true,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(result) as ReferencePolicyResult;
}

export function evaluateReferenceInput(
  input: ReferenceInput,
): ReferencePolicyResult {
  const rightsEvidenceRef = sanitizeEvidenceRef(input.rightsEvidenceRef) ?? "";
  const aiUseEvidenceRef =
    input.aiUseAuthorization === "not_authorized"
      ? null
      : (sanitizeEvidenceRef(input.aiUseEvidenceRef) ?? "");
  const copyEnabledManualLane =
    input.sourceKind === "copy_enabled_template" &&
    input.rightsBasis === "copy_enabled" &&
    input.aiUseAuthorization === "not_authorized";
  const completeAllowedTuple =
    hasAllowedTuple(input) &&
    hasEvidence(rightsEvidenceRef) &&
    hasEvidence(aiUseEvidenceRef);

  let policyDecision: ReferencePolicyDecision;
  if (completeAllowedTuple) {
    policyDecision = "allowed";
  } else if (copyEnabledManualLane && hasEvidence(rightsEvidenceRef)) {
    policyDecision = "needs_review";
  } else {
    policyDecision = "blocked";
  }

  const policyReasons: string[] = [];
  if (policyDecision === "blocked") {
    policyReasons.push(
      "The source, rights, AI-use authorization, and immutable evidence do not form an allowed provenance record.",
    );
  } else if (policyDecision === "needs_review") {
    policyReasons.push(
      "Copy-enabled access is not AI-use permission. This record stays in the asset-checked manual-template lane and outside all AI context.",
    );
  }

  return closePolicyResult(
    {
      sourceKind: input.sourceKind,
      rightsBasis: input.rightsBasis,
      rightsEvidenceRef,
      policyDecision,
      aiUseAuthorization: input.aiUseAuthorization,
      aiUseEvidenceRef,
    },
    policyDecision === "allowed" ? sanitizeTraits(input.selectedTraits) : [],
    policyReasons,
  );
}
