export const MARKET_RADAR_ARCHETYPES = [
  "one_input_incremental",
  "life_roleplay_toybox",
  "pet_collection_economy",
  "scarcity_social_risk_tycoon",
  "cooperative_survival_expedition",
  "asymmetric_round_survival",
  "arena_combat",
  "action_rpg",
  "fishing_collection",
  "fashion_avatar_expression",
  "social_performance_sandbox",
  "roster_strategy",
  "hide_and_seek",
] as const;

export const MARKET_RADAR_MOMENTUM = [
  "very_high",
  "high",
  "medium",
  "low",
  "unknown",
] as const;

export const MARKET_RADAR_LIVE_OPS_CADENCE = [
  "continuous",
  "weekly",
  "seasonal",
  "event_driven",
  "low_frequency",
  "unknown",
] as const;

export const MARKET_RADAR_SOCIAL_ORIENTATION = [
  "solo_first",
  "cooperative",
  "competitive",
  "social_sandbox",
  "mixed",
] as const;

export const MARKET_RADAR_MONETIZATION_DESIGN_CATEGORIES = [
  "cosmetic_expression",
  "optional_convenience",
  "private_server",
  "seasonal_collection",
] as const;

export const MARKET_RADAR_COMPATIBILITY_STRENGTH = [
  "strong",
  "moderate",
  "limited",
  "unknown",
] as const;

export const MARKET_RADAR_EVIDENCE_STRENGTH = [
  "high",
  "medium",
  "low",
] as const;

export const MARKET_RADAR_RATIONALE_TOKENS = [
  "short_loop_optional_convenience",
  "identity_cosmetic_expression",
  "bounded_seasonal_collection",
  "fair_optional_convenience",
  "group_private_space",
  "role_cosmetic_expression",
  "fair_combat_cosmetics",
  "long_term_themed_collection",
  "rotating_collection_goals",
  "hosted_social_private_space",
  "fair_strategy_collection",
] as const;

export type MarketRadarArchetype =
  (typeof MARKET_RADAR_ARCHETYPES)[number];
export type MarketRadarMomentum = (typeof MARKET_RADAR_MOMENTUM)[number];
export type MarketRadarLiveOpsCadence =
  (typeof MARKET_RADAR_LIVE_OPS_CADENCE)[number];
export type MarketRadarSocialOrientation =
  (typeof MARKET_RADAR_SOCIAL_ORIENTATION)[number];
export type MarketRadarMonetizationDesignCategory =
  (typeof MARKET_RADAR_MONETIZATION_DESIGN_CATEGORIES)[number];
export type MarketRadarCompatibilityStrength =
  (typeof MARKET_RADAR_COMPATIBILITY_STRENGTH)[number];
export type MarketRadarEvidenceStrength =
  (typeof MARKET_RADAR_EVIDENCE_STRENGTH)[number];
export type MarketRadarRationaleToken =
  (typeof MARKET_RADAR_RATIONALE_TOKENS)[number];

export const MARKET_RADAR_RATIONALE_COPY: Readonly<
  Record<MarketRadarRationaleToken, string>
> = Object.freeze({
  short_loop_optional_convenience:
    "Short repeatable loops can support optional time-saving choices.",
  identity_cosmetic_expression:
    "Identity play naturally supports optional visual expression.",
  bounded_seasonal_collection:
    "Collection goals can align with clearly bounded seasonal sets.",
  fair_optional_convenience:
    "Optional convenience can fit when competitive outcomes stay fair.",
  group_private_space:
    "Friend groups may value a controlled cooperative session space.",
  role_cosmetic_expression:
    "Distinct roles can support optional non-gameplay visual identities.",
  fair_combat_cosmetics:
    "Readable cosmetic expression can fit without changing combat power.",
  long_term_themed_collection:
    "Optional themed collections can complement long-term progression.",
  rotating_collection_goals:
    "Rotating collections can provide optional, legible goals.",
  hosted_social_private_space:
    "Private group spaces can support rehearsed or hosted social play.",
  fair_strategy_collection:
    "Collection themes fit only when strategy remains transparent and fair.",
});

export interface MarketRadarMonetizationDesignCompatibility {
  readonly category: MarketRadarMonetizationDesignCategory;
  readonly strength: MarketRadarCompatibilityStrength;
  readonly rationaleToken: MarketRadarRationaleToken;
}

export interface MarketRadarEntry {
  readonly archetype: MarketRadarArchetype;
  readonly momentum: MarketRadarMomentum;
  readonly liveOpsCadence: MarketRadarLiveOpsCadence;
  readonly socialOrientation: MarketRadarSocialOrientation;
  readonly monetizationDesignCompatibility: MarketRadarMonetizationDesignCompatibility;
  readonly evidenceStrength: MarketRadarEvidenceStrength;
}

export interface MarketRadarResearchBasis {
  readonly experienceCount: number;
  readonly archetypeCount: number;
  readonly scope: "public_metadata_aggregate";
}

export interface MarketRadarSnapshot {
  readonly schemaVersion: "1.0.0";
  readonly snapshotKind: "public_aggregate";
  readonly observedAt: string;
  readonly expiresAt: string;
  readonly researchBasis: MarketRadarResearchBasis;
  readonly entries: readonly MarketRadarEntry[];
}

const FORBIDDEN_FIELD_FRAGMENTS = [
  "revenue",
  "payer",
  "arpdau",
  "arppu",
  "ownedanalytics",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expectedKeys.length &&
    keys.every((key) => expectedKeys.includes(key))
  );
}

function hasForbiddenField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasForbiddenField);
  if (!isRecord(value)) return false;

  return Object.entries(value).some(([key, nestedValue]) => {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    return (
      FORBIDDEN_FIELD_FRAGMENTS.some((fragment) =>
        normalizedKey.includes(fragment),
      ) || hasForbiddenField(nestedValue)
    );
  });
}

function isOneOf<T extends string>(
  value: unknown,
  options: readonly T[],
): value is T {
  return typeof value === "string" && options.includes(value as T);
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isResearchBasis(value: unknown): value is MarketRadarResearchBasis {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["experienceCount", "archetypeCount", "scope"])
  ) {
    return false;
  }

  return (
    Number.isInteger(value.experienceCount) &&
    Number(value.experienceCount) > 0 &&
    Number.isInteger(value.archetypeCount) &&
    Number(value.archetypeCount) > 0 &&
    value.scope === "public_metadata_aggregate"
  );
}

function isDesignCompatibility(
  value: unknown,
): value is MarketRadarMonetizationDesignCompatibility {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["category", "strength", "rationaleToken"])
  ) {
    return false;
  }

  return (
    isOneOf(value.category, MARKET_RADAR_MONETIZATION_DESIGN_CATEGORIES) &&
    isOneOf(value.strength, MARKET_RADAR_COMPATIBILITY_STRENGTH) &&
    isOneOf(value.rationaleToken, MARKET_RADAR_RATIONALE_TOKENS)
  );
}

function isMarketRadarEntry(value: unknown): value is MarketRadarEntry {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "archetype",
      "momentum",
      "liveOpsCadence",
      "socialOrientation",
      "monetizationDesignCompatibility",
      "evidenceStrength",
    ])
  ) {
    return false;
  }

  return (
    isOneOf(value.archetype, MARKET_RADAR_ARCHETYPES) &&
    isOneOf(value.momentum, MARKET_RADAR_MOMENTUM) &&
    isOneOf(value.liveOpsCadence, MARKET_RADAR_LIVE_OPS_CADENCE) &&
    isOneOf(value.socialOrientation, MARKET_RADAR_SOCIAL_ORIENTATION) &&
    isDesignCompatibility(value.monetizationDesignCompatibility) &&
    isOneOf(value.evidenceStrength, MARKET_RADAR_EVIDENCE_STRENGTH)
  );
}

export function validateMarketRadarSnapshot(
  value: unknown,
): value is MarketRadarSnapshot {
  if (hasForbiddenField(value) || !isRecord(value)) return false;
  if (
    !hasExactKeys(value, [
      "schemaVersion",
      "snapshotKind",
      "observedAt",
      "expiresAt",
      "researchBasis",
      "entries",
    ]) ||
    value.schemaVersion !== "1.0.0" ||
    value.snapshotKind !== "public_aggregate" ||
    !isIsoDateTime(value.observedAt) ||
    !isIsoDateTime(value.expiresAt) ||
    Date.parse(value.expiresAt) <= Date.parse(value.observedAt) ||
    !isResearchBasis(value.researchBasis) ||
    !Array.isArray(value.entries) ||
    value.entries.length === 0 ||
    value.entries.length > MARKET_RADAR_ARCHETYPES.length ||
    !value.entries.every(isMarketRadarEntry)
  ) {
    return false;
  }

  const archetypes = value.entries.map((entry) => entry.archetype);
  return (
    new Set(archetypes).size === archetypes.length &&
    value.researchBasis.archetypeCount === value.entries.length
  );
}
