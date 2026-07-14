import {
  directorDraftContentBinding,
  isDirectorDraftApprovable,
  isDirectorDraftStructurallyValid,
  refingerprintDirectorDraft,
  type GameDirectorDraft,
} from "./gameDirectorDraft";
import { getDefaultLogic, type GameLogicProperties } from "../lib/gameLogic";
import type {
  CanvasElement,
  ElementCategory,
} from "../stores/canvasStore";

export const APPROVED_DIRECTOR_SCENE_SCHEMA_VERSION = "1.0.0" as const;
export const GUIDED_OBBY_GENERATOR_VERSION = "guided-obby-v1" as const;

export const GUIDED_OBBY_THEMES = [
  "bright",
  "neon",
  "space",
  "jungle",
  "candy",
  "volcanic",
  "underwater",
] as const;

export const GUIDED_OBBY_MECHANIC_TRACKS = [
  "balanced",
  "momentum",
  "precision",
  "rhythm",
] as const;

export type GuidedObbyTheme = (typeof GUIDED_OBBY_THEMES)[number];
export type GuidedObbyMechanicTrack =
  (typeof GUIDED_OBBY_MECHANIC_TRACKS)[number];
export type GuidedObbyStageCount = 3 | 4 | 5;

export interface ApprovedDirectorSceneApproval {
  readonly draft: GameDirectorDraft | null;
  readonly draftContentBinding: string | null;
  readonly approvalState: "not_generated" | "review" | "approved_locally";
  readonly approvedFingerprint: string | null;
  readonly approvedContentBinding: string | null;
}

export interface GuidedSceneProposal {
  readonly schemaVersion: typeof APPROVED_DIRECTOR_SCENE_SCHEMA_VERSION;
  readonly generatorVersion: typeof GUIDED_OBBY_GENERATOR_VERSION;
  readonly proposalId: string;
  readonly revision: string;
  readonly source: {
    readonly draftId: string;
    readonly fingerprint: string;
    readonly contentBindingHash: string;
  };
  readonly genre: "Obby";
  readonly template: "obby";
  readonly theme: GuidedObbyTheme;
  readonly mechanicTrack: GuidedObbyMechanicTrack;
  readonly stageCount: GuidedObbyStageCount;
  readonly elements: CanvasElement[];
}

export type ApprovedDirectorSceneProposal = GuidedSceneProposal;

export type ApprovedDirectorSceneRejectionCode =
  | "invalid_approval"
  | "missing_draft"
  | "invalid_draft"
  | "forged_draft"
  | "stale_draft_binding"
  | "unsupported_genre"
  | "blocked_draft"
  | "approval_required"
  | "missing_approval_evidence"
  | "stale_approval";

export type ApprovedDirectorSceneValidationResult =
  | {
      readonly ok: true;
      readonly draft: GameDirectorDraft;
      readonly draftId: string;
      readonly fingerprint: string;
      readonly contentBinding: string;
    }
  | {
      readonly ok: false;
      readonly code: ApprovedDirectorSceneRejectionCode;
      readonly message: string;
    };

const REJECTION_MESSAGES: Record<ApprovedDirectorSceneRejectionCode, string> = {
  invalid_approval: "The Director approval record is invalid.",
  missing_draft: "Generate a Director brief before creating a scene.",
  invalid_draft: "The Director brief does not satisfy the expected structure.",
  forged_draft: "The Director brief content does not match its identity.",
  stale_draft_binding: "The Director brief changed after its content binding was recorded.",
  unsupported_genre: "Guided scene generation currently supports approved Obby briefs only.",
  blocked_draft: "Resolve all Director questions and approval blocks before creating a scene.",
  approval_required: "Approve the current Director brief before creating a scene.",
  missing_approval_evidence: "The current approval is missing its fingerprint or content binding.",
  stale_approval: "The approval belongs to a different Director brief revision.",
};

export class ApprovedDirectorSceneError extends Error {
  readonly code: ApprovedDirectorSceneRejectionCode;

  constructor(code: ApprovedDirectorSceneRejectionCode, message: string) {
    super(message);
    this.name = "ApprovedDirectorSceneError";
    this.code = code;
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function reject(
  code: ApprovedDirectorSceneRejectionCode,
): ApprovedDirectorSceneValidationResult {
  return { ok: false, code, message: REJECTION_MESSAGES[code] };
}

export function validateApprovedDirectorSceneApproval(
  value: unknown,
): ApprovedDirectorSceneValidationResult {
  if (!isRecord(value)) return reject("invalid_approval");
  if (value.draft === null || value.draft === undefined) {
    return reject("missing_draft");
  }
  if (!isDirectorDraftStructurallyValid(value.draft)) {
    return reject("invalid_draft");
  }

  const draft = value.draft;
  const identifiedDraft = refingerprintDirectorDraft(draft);
  if (
    draft.draftId !== identifiedDraft.draftId ||
    draft.fingerprint !== identifiedDraft.fingerprint
  ) {
    return reject("forged_draft");
  }

  const contentBinding = directorDraftContentBinding(draft);
  if (value.draftContentBinding !== contentBinding) {
    return reject("stale_draft_binding");
  }
  if (draft.genre !== "Obby") return reject("unsupported_genre");
  if (!isDirectorDraftApprovable(draft)) return reject("blocked_draft");
  if (value.approvalState !== "approved_locally") {
    return reject("approval_required");
  }
  if (
    typeof value.approvedFingerprint !== "string" ||
    value.approvedFingerprint.length === 0 ||
    typeof value.approvedContentBinding !== "string" ||
    value.approvedContentBinding.length === 0
  ) {
    return reject("missing_approval_evidence");
  }
  if (
    value.approvedFingerprint !== identifiedDraft.fingerprint ||
    value.approvedContentBinding !== contentBinding
  ) {
    return reject("stale_approval");
  }

  return {
    ok: true,
    draft,
    draftId: identifiedDraft.draftId,
    fingerprint: identifiedDraft.fingerprint,
    contentBinding,
  };
}

export function isApprovedDirectorSceneApproval(
  value: unknown,
): value is ApprovedDirectorSceneApproval {
  return validateApprovedDirectorSceneApproval(value).ok;
}

function stableHash(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(value)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

interface ThemePalette {
  readonly lobby: string;
  readonly platform: string;
  readonly accent: string;
  readonly hazard: string;
  readonly checkpoint: string;
  readonly victory: string;
}

const THEME_PALETTES: Record<GuidedObbyTheme, ThemePalette> = {
  bright: {
    lobby: "#475569",
    platform: "#4f46e5",
    accent: "#06b6d4",
    hazard: "#ef4444",
    checkpoint: "#22c55e",
    victory: "#facc15",
  },
  neon: {
    lobby: "#111827",
    platform: "#22d3ee",
    accent: "#a855f7",
    hazard: "#fb7185",
    checkpoint: "#34d399",
    victory: "#fde047",
  },
  space: {
    lobby: "#172554",
    platform: "#818cf8",
    accent: "#38bdf8",
    hazard: "#f43f5e",
    checkpoint: "#2dd4bf",
    victory: "#fbbf24",
  },
  jungle: {
    lobby: "#365314",
    platform: "#65a30d",
    accent: "#a3e635",
    hazard: "#dc2626",
    checkpoint: "#14b8a6",
    victory: "#eab308",
  },
  candy: {
    lobby: "#9d174d",
    platform: "#f472b6",
    accent: "#c084fc",
    hazard: "#ef4444",
    checkpoint: "#2dd4bf",
    victory: "#fde047",
  },
  volcanic: {
    lobby: "#292524",
    platform: "#b45309",
    accent: "#f97316",
    hazard: "#ef4444",
    checkpoint: "#84cc16",
    victory: "#facc15",
  },
  underwater: {
    lobby: "#164e63",
    platform: "#0891b2",
    accent: "#22d3ee",
    hazard: "#e11d48",
    checkpoint: "#34d399",
    victory: "#fbbf24",
  },
};

function selectTheme(aesthetic: string): GuidedObbyTheme {
  const normalized = aesthetic.toLowerCase();
  if (/\b(neon|cyber)\b/.test(normalized)) return "neon";
  if (/\b(space|station|planet)\b/.test(normalized)) return "space";
  if (/\b(jungle|forest|overgrown)\b/.test(normalized)) return "jungle";
  if (/\b(candy|sweet|confection)\b/.test(normalized)) return "candy";
  if (/\b(volcano|volcanic|lava)\b/.test(normalized)) return "volcanic";
  if (/\b(underwater|ocean)\b/.test(normalized)) return "underwater";
  return "bright";
}

function selectMechanicTrack(
  draft: GameDirectorDraft,
): GuidedObbyMechanicTrack {
  const traits = new Set(draft.referenceTraits);
  if (traits.has("skill_mastery") || traits.has("escalating_challenge")) {
    return "precision";
  }
  if (traits.has("rapid_recovery") || traits.has("short_sessions")) {
    return "momentum";
  }
  if (
    traits.has("checkpoint_progression") ||
    traits.has("visible_progression")
  ) {
    return "rhythm";
  }
  return "balanced";
}

function selectStageCount(draft: GameDirectorDraft): GuidedObbyStageCount {
  const traits = new Set(draft.referenceTraits);
  const skillMastery = traits.has("skill_mastery");
  const escalatingChallenge = traits.has("escalating_challenge");
  if (skillMastery && escalatingChallenge) return 5;
  if (skillMastery || escalatingChallenge) return 4;
  return 3;
}

type GuidedElementType =
  | "spawn"
  | "ground"
  | "platform"
  | "moving-platform"
  | "disappearing"
  | "bouncy"
  | "conveyor"
  | "killbrick"
  | "spinner"
  | "laser"
  | "spikes"
  | "checkpoint";

interface ElementCatalogEntry {
  readonly category: ElementCategory;
  readonly icon: string;
  readonly width: number;
  readonly height: number;
}

const ELEMENT_CATALOG: Record<GuidedElementType, ElementCatalogEntry> = {
  spawn: { category: "mechanic", icon: "user-plus", width: 40, height: 40 },
  ground: { category: "terrain", icon: "square", width: 200, height: 40 },
  platform: { category: "platform", icon: "minus", width: 100, height: 16 },
  "moving-platform": {
    category: "platform",
    icon: "move-horizontal",
    width: 100,
    height: 16,
  },
  disappearing: {
    category: "platform",
    icon: "eye-off",
    width: 80,
    height: 16,
  },
  bouncy: { category: "platform", icon: "arrow-up", width: 80, height: 16 },
  conveyor: {
    category: "platform",
    icon: "arrow-right",
    width: 120,
    height: 16,
  },
  killbrick: { category: "obstacle", icon: "skull", width: 60, height: 16 },
  spinner: {
    category: "obstacle",
    icon: "rotate-cw",
    width: 80,
    height: 12,
  },
  laser: { category: "obstacle", icon: "zap", width: 8, height: 80 },
  spikes: { category: "obstacle", icon: "triangle", width: 60, height: 20 },
  checkpoint: { category: "mechanic", icon: "flag", width: 40, height: 40 },
};

const CHALLENGE_SEQUENCE: Record<
  GuidedObbyMechanicTrack,
  readonly GuidedElementType[]
> = {
  balanced: ["platform", "moving-platform", "disappearing", "bouncy", "conveyor"],
  momentum: ["moving-platform", "bouncy", "conveyor", "disappearing", "moving-platform"],
  precision: ["platform", "disappearing", "moving-platform", "platform", "disappearing"],
  rhythm: ["disappearing", "moving-platform", "bouncy", "disappearing", "conveyor"],
};

const HAZARD_SEQUENCE: Record<
  GuidedObbyMechanicTrack,
  readonly GuidedElementType[]
> = {
  balanced: ["killbrick", "spinner", "spikes", "laser", "spinner"],
  momentum: ["killbrick", "spinner", "laser", "spikes", "spinner"],
  precision: ["spikes", "killbrick", "laser", "spinner", "spikes"],
  rhythm: ["killbrick", "spinner", "laser", "spikes", "laser"],
};

function progressiveLogic(
  type: GuidedElementType,
  stageNumber: number,
): GameLogicProperties {
  const defaults = getDefaultLogic(type, "obby");
  switch (type) {
    case "checkpoint":
      return { ...defaults, stageNumber, autoSave: true };
    case "moving-platform":
      return {
        ...defaults,
        moveDistance: 8 + stageNumber * 2,
        moveSpeed: 3 + stageNumber,
      };
    case "disappearing":
      return {
        ...defaults,
        disappearDelay: Math.max(0.8, 1.8 - stageNumber * 0.15),
      };
    case "spinner":
      return { ...defaults, spinSpeed: 2 + stageNumber * 0.5 };
    case "bouncy":
      return { ...defaults, bounceForce: 70 + stageNumber * 5 };
    case "conveyor":
      return { ...defaults, conveyorSpeed: 8 + stageNumber * 2 };
    default:
      return defaults;
  }
}

interface ElementInput {
  readonly key: string;
  readonly type: GuidedElementType;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly color: string;
  readonly stageNumber?: number;
  readonly width?: number;
}

function makeElement(seed: string, input: ElementInput): CanvasElement {
  const catalog = ELEMENT_CATALOG[input.type];
  return {
    id: `guided-element-${stableHash(`${seed}\u0000element\u0000${input.key}`)}`,
    type: input.type,
    category: catalog.category,
    label: input.label,
    icon: catalog.icon,
    x: input.x,
    y: input.y,
    width: input.width ?? catalog.width,
    height: catalog.height,
    color: input.color,
    rotation: 0,
    locked: false,
    visible: true,
    properties: {},
    logic: progressiveLogic(input.type, input.stageNumber ?? 0),
  };
}

function buildElements(
  seed: string,
  theme: GuidedObbyTheme,
  mechanicTrack: GuidedObbyMechanicTrack,
  stageCount: GuidedObbyStageCount,
): CanvasElement[] {
  const palette = THEME_PALETTES[theme];
  const elements: CanvasElement[] = [
    makeElement(seed, {
      key: "lobby-spawn",
      type: "spawn",
      label: "Lobby Spawn",
      x: 70,
      y: 580,
      color: palette.checkpoint,
    }),
    makeElement(seed, {
      key: "lobby-floor",
      type: "ground",
      label: "Lobby Floor",
      x: 50,
      y: 630,
      color: palette.lobby,
    }),
  ];

  for (let index = 0; index < stageCount; index += 1) {
    const stageNumber = index + 1;
    const baseX = 300 + index * 260;
    const baseY = 560 - index * 65;
    const challenge = CHALLENGE_SEQUENCE[mechanicTrack][index];
    const hazard = HAZARD_SEQUENCE[mechanicTrack][index];
    elements.push(
      makeElement(seed, {
        key: `stage-${stageNumber}-approach`,
        type: "platform",
        label: `Stage ${stageNumber} Approach`,
        x: baseX,
        y: baseY,
        color: palette.platform,
        stageNumber,
      }),
      makeElement(seed, {
        key: `stage-${stageNumber}-challenge`,
        type: challenge,
        label: `Stage ${stageNumber} Challenge`,
        x: baseX + 105,
        y: baseY - 20,
        color: palette.accent,
        stageNumber,
      }),
      makeElement(seed, {
        key: `stage-${stageNumber}-hazard`,
        type: hazard,
        label: `Stage ${stageNumber} Hazard`,
        x: baseX + 190,
        y: baseY + 42,
        color: palette.hazard,
        stageNumber,
      }),
      makeElement(seed, {
        key: `stage-${stageNumber}-checkpoint`,
        type: "checkpoint",
        label: `Stage ${stageNumber} Checkpoint`,
        x: baseX + 225,
        y: baseY - 42,
        color: palette.checkpoint,
        stageNumber,
      }),
    );
  }

  elements.push(
    makeElement(seed, {
      key: "victory-platform",
      type: "platform",
      label: "Victory Platform",
      x: 300 + stageCount * 260,
      y: 500 - stageCount * 65,
      width: 140,
      color: palette.victory,
      stageNumber: stageCount,
    }),
  );
  return elements;
}

export function generateApprovedDirectorSceneProposal(
  value: unknown,
): GuidedSceneProposal {
  const validation = validateApprovedDirectorSceneApproval(value);
  if (!validation.ok) {
    throw new ApprovedDirectorSceneError(validation.code, validation.message);
  }

  const seed = `${GUIDED_OBBY_GENERATOR_VERSION}\u0000${validation.fingerprint}\u0000${validation.contentBinding}`;
  const theme = selectTheme(validation.draft.aesthetic);
  const mechanicTrack = selectMechanicTrack(validation.draft);
  const stageCount = selectStageCount(validation.draft);
  return {
    schemaVersion: APPROVED_DIRECTOR_SCENE_SCHEMA_VERSION,
    generatorVersion: GUIDED_OBBY_GENERATOR_VERSION,
    proposalId: `guided-obby-${stableHash(`${seed}\u0000proposal`)}`,
    revision: `guided-obby-revision64-${stableHash(`${seed}\u0000revision`)}`,
    source: {
      draftId: validation.draftId,
      fingerprint: validation.fingerprint,
      contentBindingHash: `director-content64-${stableHash(validation.contentBinding)}`,
    },
    genre: "Obby",
    template: "obby",
    theme,
    mechanicTrack,
    stageCount,
    elements: buildElements(seed, theme, mechanicTrack, stageCount),
  };
}

export const createApprovedDirectorSceneProposal =
  generateApprovedDirectorSceneProposal;
