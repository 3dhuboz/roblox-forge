import {
  ABSTRACT_TRAIT_CATALOG,
  canEnterAiContext,
  type AbstractReferenceTrait,
  type ReferencePolicyResult,
} from "./referenceInputPolicy";

export const LOCAL_DIRECTOR_LABEL =
  "Deterministic local draft — AI authority unavailable";

export const DIRECTOR_GENRES = [
  "Obby",
  "Simulator",
  "Tycoon",
  "RPG",
  "Survival",
  "Roleplay",
  "Arena",
  "Other",
] as const;

export type DirectorGenre = (typeof DIRECTOR_GENRES)[number];

export interface GameDirectorDraft {
  schemaVersion: "game-director-draft.v1";
  generatorVersion: "deterministic-local.v1" | "authority.v1";
  mode: "deterministic_local" | "authority";
  modeLabel: string;
  draftId: string;
  fingerprint: string;
  genre: DirectorGenre;
  intendedAchievement: string;
  playerFantasy: string;
  loops: {
    momentToMoment: string;
    thirtySecond: string;
    session: string;
    longTerm: string;
  };
  progression: string;
  outcomes: {
    win: string;
    failure: string;
    recovery: string;
  };
  economy: {
    sources: string;
    sinks: string;
  };
  monetizationSafety: string;
  aesthetic: string;
  assumptions: string[];
  materialQuestions: string[];
  originalitySafeguards: string[];
  referenceTraits: AbstractReferenceTrait[];
  approvalBlocked: boolean;
  approvalBlockReasons: string[];
}

export interface DirectorDraftInput {
  idea: string;
  referencePolicy: ReferencePolicyResult;
}

function inferGenre(idea: string): DirectorGenre {
  const normalized = idea.toLowerCase();
  if (/\b(obby|obstacle|parkour|checkpoint)\b/.test(normalized)) return "Obby";
  if (/\b(simulator|simulate|incremental)\b/.test(normalized)) return "Simulator";
  if (/\b(tycoon|factory|business)\b/.test(normalized)) return "Tycoon";
  if (/\b(rpg|quest|dungeon|role-playing)\b/.test(normalized)) return "RPG";
  if (/\b(survival|survive|horror|escape monster)\b/.test(normalized)) return "Survival";
  if (/\b(roleplay|role-play|life game|city jobs)\b/.test(normalized)) return "Roleplay";
  if (/\b(arena|duel|battleground|pvp)\b/.test(normalized)) return "Arena";
  return "Other";
}

function inferAesthetic(idea: string): string {
  const normalized = idea.toLowerCase();
  const themes: ReadonlyArray<[RegExp, string]> = [
    [/\b(neon|cyber)\b/, "An original neon world with high-contrast traversal cues and restrained effects."],
    [/\b(space|station|planet)\b/, "An original space setting with readable silhouettes, depth layers, and clear safe-path lighting."],
    [/\b(jungle|forest)\b/, "An original overgrown setting with strong landmark colors and uncluttered traversal silhouettes."],
    [/\b(candy|sweet)\b/, "An original playful confection theme with bold shapes and accessible color contrast."],
    [/\b(volcano|lava)\b/, "An original volcanic setting with clear hazard contrast and layered environmental motion."],
    [/\b(underwater|ocean)\b/, "An original underwater setting with readable depth, current effects, and luminous checkpoints."],
  ];
  return (
    themes.find(([pattern]) => pattern.test(normalized))?.[1] ??
    "A bright, original environment with readable landmarks, high-contrast hazards, and mobile-friendly visual clarity."
  );
}

const TRAIT_ASSUMPTIONS: Record<AbstractReferenceTrait, string> = {
  checkpoint_progression: "Progress is broken into clearly saved checkpoints.",
  collection: "Optional collectibles reward exploration without blocking the main path.",
  cooperative_play: "Players can help one another without requiring a full party.",
  customization: "Rewards include original cosmetic expression rather than power.",
  escalating_challenge: "Challenge rises in readable steps before adding new mechanics.",
  exploration: "Alternate routes reward curiosity while preserving a clear main route.",
  live_events: "Future events vary rules and rewards without manufacturing urgency.",
  rapid_recovery: "Failure returns the player to meaningful action within seconds.",
  short_sessions: "A useful progress beat fits inside a short mobile session.",
  skill_mastery: "Improvement comes from learning movement and timing, not paid power.",
  social_co_play: "Friends can join, spectate, and celebrate progress together.",
  visible_progression: "The next milestone and long-term progress remain visible.",
};

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

function canonicalPayload(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function stableRevisionHash(value: unknown): string {
  const serialized = canonicalPayload(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const bytes = new TextEncoder().encode(serialized);
  for (const byte of bytes) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

export function directorDraftContentBinding(draft: GameDirectorDraft): string {
  return `director-content-v1:${canonicalPayload(fingerprintPayload(draft))}`;
}

function fingerprintPayload(
  draft: Omit<GameDirectorDraft, "draftId" | "fingerprint"> | GameDirectorDraft,
): Omit<GameDirectorDraft, "draftId" | "fingerprint"> {
  const { draftId: _draftId, fingerprint: _fingerprint, ...payload } =
    draft as GameDirectorDraft;
  return payload;
}

export function refingerprintDirectorDraft(
  draft: GameDirectorDraft,
): GameDirectorDraft {
  const payload = fingerprintPayload(draft);
  const hash = stableRevisionHash(payload);
  return {
    ...draft,
    draftId: `${draft.mode === "authority" ? "authority" : "local"}-${hash}`,
    fingerprint: `director-revision64-${hash}`,
  };
}

export function closeDirectorDraft(
  draft: GameDirectorDraft,
): GameDirectorDraft {
  return {
    schemaVersion: draft.schemaVersion,
    generatorVersion: draft.generatorVersion,
    mode: draft.mode,
    modeLabel: draft.modeLabel,
    draftId: draft.draftId,
    fingerprint: draft.fingerprint,
    genre: draft.genre,
    intendedAchievement: draft.intendedAchievement,
    playerFantasy: draft.playerFantasy,
    loops: {
      momentToMoment: draft.loops.momentToMoment,
      thirtySecond: draft.loops.thirtySecond,
      session: draft.loops.session,
      longTerm: draft.loops.longTerm,
    },
    progression: draft.progression,
    outcomes: {
      win: draft.outcomes.win,
      failure: draft.outcomes.failure,
      recovery: draft.outcomes.recovery,
    },
    economy: {
      sources: draft.economy.sources,
      sinks: draft.economy.sinks,
    },
    monetizationSafety: draft.monetizationSafety,
    aesthetic: draft.aesthetic,
    assumptions: [...draft.assumptions],
    materialQuestions: [...draft.materialQuestions],
    originalitySafeguards: [...draft.originalitySafeguards],
    referenceTraits: [...draft.referenceTraits],
    approvalBlocked: draft.approvalBlocked,
    approvalBlockReasons: [...draft.approvalBlockReasons],
  };
}

export function freezeDirectorDraft(draft: GameDirectorDraft): GameDirectorDraft {
  const closed = closeDirectorDraft(draft);
  Object.freeze(closed.loops);
  Object.freeze(closed.outcomes);
  Object.freeze(closed.economy);
  Object.freeze(closed.assumptions);
  Object.freeze(closed.materialQuestions);
  Object.freeze(closed.originalitySafeguards);
  Object.freeze(closed.referenceTraits);
  Object.freeze(closed.approvalBlockReasons);
  return Object.freeze(closed);
}

export function createDeterministicDirectorDraft(
  input: DirectorDraftInput,
): GameDirectorDraft {
  const normalizedIdea = input.idea.trim().replace(/\s+/g, " ").slice(0, 600);
  const genre = inferGenre(normalizedIdea);
  const referenceBlocked =
    input.referencePolicy.provenance.policyDecision === "blocked";
  const referenceNeedsReview =
    input.referencePolicy.provenance.policyDecision === "needs_review";
  const supported = genre === "Obby";
  const referenceTraits = canEnterAiContext(input.referencePolicy)
    ? [...input.referencePolicy.safeContext.traits]
    : [];
  const materialQuestions: string[] = [];
  const approvalBlockReasons: string[] = [];

  if (normalizedIdea.length < 12) {
    materialQuestions.push(
      "Describe the player goal, setting, and one meaningful challenge.",
    );
    approvalBlockReasons.push("The game idea is not specific enough to approve.");
  }
  if (!supported) {
    materialQuestions.push(
      "This private-alpha builder currently supports an Obby path. Should this concept be reframed as an Obby, or held for a later genre module?",
    );
    approvalBlockReasons.push(`${genre} generation is review-only in this slice.`);
  }
  if (referenceBlocked) {
    materialQuestions.push(
      "Remove the blocked reference or replace it with manually selected abstract mechanics.",
    );
    approvalBlockReasons.push(
      "A blocked reference cannot be used for generation or approval.",
    );
  }
  if (referenceNeedsReview) {
    materialQuestions.push(
      "Complete the manual template's per-asset rights review or remove the reference before approving this brief.",
    );
    approvalBlockReasons.push(
      "A copy-enabled manual template stays outside AI context and requires asset-rights review before approval.",
    );
  }

  const assumptions = [
    "Primary controls are readable on keyboard, controller, and touch.",
    "The first checkpoint is reachable during the opening minute.",
    ...referenceTraits.map((trait) => TRAIT_ASSUMPTIONS[trait]),
  ];

  const draftWithoutIdentity: Omit<
    GameDirectorDraft,
    "draftId" | "fingerprint"
  > = {
    schemaVersion: "game-director-draft.v1",
    generatorVersion: "deterministic-local.v1",
    mode: "deterministic_local",
    modeLabel: LOCAL_DIRECTOR_LABEL,
    genre,
    intendedAchievement:
      genre === "Obby"
        ? "Reach the final checkpoint by learning and completing a sequence of original traversal challenges."
        : "Clarify a supported, testable player achievement before build generation begins.",
    playerFantasy:
      genre === "Obby"
        ? "Feel increasingly capable as difficult-looking movement becomes readable and conquerable."
        : "Define the emotional role the player should inhabit before this genre is built.",
    loops: {
      momentToMoment:
        "Read the next hazard, choose a route, move with intent, and receive immediate feedback.",
      thirtySecond:
        "Attempt a short challenge, learn from failure, recover quickly, and secure the next checkpoint.",
      session:
        "Complete several stages, collect optional mastery rewards, and leave with visible progress.",
      longTerm:
        "Master harder route variants, complete original cosmetic goals, and return for fresh rule variations.",
    },
    progression:
      "Introduce one mechanic at a time, combine mastered mechanics later, and save progress at fair checkpoints.",
    outcomes: {
      win: "Reach the final checkpoint and receive a clear completion summary plus a cosmetic mastery reward.",
      failure:
        "Missing a traversal challenge costs position only; it never removes paid value or long-term progress.",
      recovery:
        "Respawn at the latest earned checkpoint within seconds with the failed hazard still visible.",
    },
    economy: {
      sources:
        "Earn a clearly labelled cosmetic currency from checkpoints, optional mastery routes, and completion goals.",
      sinks:
        "Spend only on original cosmetics, trails, emotes, and non-power personalization with previewed prices.",
    },
    monetizationSafety:
      "No pay-to-win power, paid checkpoint skipping, coercive urgency, deceptive pricing, or paid random advantage.",
    aesthetic: inferAesthetic(normalizedIdea),
    assumptions,
    materialQuestions,
    originalitySafeguards: [
      "Use original names, visual language, characters, layouts, assets, audio, and interface patterns.",
      "Add a distinct route-choice rule and stage rhythm instead of reproducing another game's map or signature bundle.",
      "Use a progression and recovery curve derived from this brief and playtests, not from a referenced game's implementation.",
    ],
    referenceTraits,
    approvalBlocked: approvalBlockReasons.length > 0,
    approvalBlockReasons,
  };

  const hash = stableRevisionHash(draftWithoutIdentity);
  return {
    ...draftWithoutIdentity,
    draftId: `local-${hash}`,
    fingerprint: `director-revision64-${hash}`,
  };
}

function meaningful(value: string): boolean {
  return value.trim().length >= 8;
}

export function isDirectorDraftStructurallyValid(
  value: unknown,
): value is GameDirectorDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<GameDirectorDraft>;
  const loops = draft.loops as GameDirectorDraft["loops"] | undefined;
  const outcomes = draft.outcomes as GameDirectorDraft["outcomes"] | undefined;
  const economy = draft.economy as GameDirectorDraft["economy"] | undefined;
  const referenceTraits = draft.referenceTraits;
  return (
    draft.schemaVersion === "game-director-draft.v1" &&
    (draft.generatorVersion === "deterministic-local.v1" ||
      draft.generatorVersion === "authority.v1") &&
    (draft.mode === "deterministic_local" || draft.mode === "authority") &&
    typeof draft.modeLabel === "string" &&
    typeof draft.draftId === "string" &&
    typeof draft.fingerprint === "string" &&
    typeof draft.genre === "string" &&
    (DIRECTOR_GENRES as readonly string[]).includes(draft.genre) &&
    typeof draft.intendedAchievement === "string" &&
    typeof draft.playerFantasy === "string" &&
    loops !== undefined &&
    typeof loops.momentToMoment === "string" &&
    typeof loops.thirtySecond === "string" &&
    typeof loops.session === "string" &&
    typeof loops.longTerm === "string" &&
    typeof draft.progression === "string" &&
    outcomes !== undefined &&
    typeof outcomes.win === "string" &&
    typeof outcomes.failure === "string" &&
    typeof outcomes.recovery === "string" &&
    economy !== undefined &&
    typeof economy.sources === "string" &&
    typeof economy.sinks === "string" &&
    typeof draft.monetizationSafety === "string" &&
    typeof draft.aesthetic === "string" &&
    Array.isArray(draft.assumptions) &&
    draft.assumptions.every((item) => typeof item === "string") &&
    Array.isArray(draft.originalitySafeguards) &&
    draft.originalitySafeguards.every((item) => typeof item === "string") &&
    Array.isArray(draft.materialQuestions) &&
    draft.materialQuestions.every((item) => typeof item === "string") &&
    Array.isArray(referenceTraits) &&
    referenceTraits.every(
      (trait) =>
        typeof trait === "string" &&
        (ABSTRACT_TRAIT_CATALOG as readonly string[]).includes(trait),
    ) &&
    typeof draft.approvalBlocked === "boolean" &&
    Array.isArray(draft.approvalBlockReasons) &&
    draft.approvalBlockReasons.every((item) => typeof item === "string")
  );
}

export function isDirectorDraftApprovable(draft: GameDirectorDraft): boolean {
  const required = [
    draft.intendedAchievement,
    draft.playerFantasy,
    draft.loops.momentToMoment,
    draft.loops.thirtySecond,
    draft.loops.session,
    draft.loops.longTerm,
    draft.progression,
    draft.outcomes.win,
    draft.outcomes.failure,
    draft.outcomes.recovery,
    draft.economy.sources,
    draft.economy.sinks,
    draft.monetizationSafety,
    draft.aesthetic,
  ];
  const originality = new Set(
    draft.originalitySafeguards
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length >= 12),
  );
  const assumptions = new Set(
    draft.assumptions
      .map((value) => value.trim().toLowerCase())
      .filter((value) => meaningful(value)),
  );
  return (
    !draft.approvalBlocked &&
    draft.approvalBlockReasons.length === 0 &&
    draft.materialQuestions.length === 0 &&
    draft.genre === "Obby" &&
    required.every(meaningful) &&
    assumptions.size >= 1 &&
    originality.size >= 3
  );
}
