export const PUBLIC_RADAR_SORTS = [
  "top_playing_now",
  "top_trending",
] as const;
export type PublicRadarSort = (typeof PUBLIC_RADAR_SORTS)[number];

export const RADAR_CAPTURE_MODES = [
  "browser_rendered",
  "manual_verified",
] as const;
export type RadarCaptureMode = (typeof RADAR_CAPTURE_MODES)[number];

export const PUBLIC_SIGNAL_METRICS = [
  "visits",
  "favorites",
  "ccu",
  "update-cadence",
  "discovery-position",
  "public-rating",
  "public-offer",
] as const;
export type PublicSignalMetric = (typeof PUBLIC_SIGNAL_METRICS)[number];

export type OrdinalBand =
  | "very-low"
  | "low"
  | "medium"
  | "high"
  | "very-high";

export type RadarOrdinalDimension =
  | "visibility"
  | "momentum"
  | "recency";

export const PUBLIC_OFFER_TYPES = [
  "game_pass",
  "developer_product",
  "paid_access",
  "private_server",
  "subscription",
] as const;
export type PublicOfferType = (typeof PUBLIC_OFFER_TYPES)[number];

export const PUBLIC_OFFER_PRICE_CONTEXTS = [
  "anonymous_public_page",
  "authenticated_public_page",
  "unavailable",
] as const;
export type PublicOfferPriceContext =
  (typeof PUBLIC_OFFER_PRICE_CONTEXTS)[number];

export type CompetitorEvidenceLabel =
  | "confirmed_historical_platform_mention"
  | "public_offer_signal"
  | "inferred_monetization_fit";

export interface PublicOfferEvidence {
  evidenceId: string;
  offerType: PublicOfferType;
  offerId: number | null;
  sourceUrl: string;
  observedAt: string;
  locale: string;
  priceContext: PublicOfferPriceContext;
  priceRobux: number | null;
}

export interface PublicRadarCaptureEntry {
  corpusRecordId: string;
  universeId: number;
  rootPlaceId: number;
  gameLabel: string;
  publicUrl: string;
  discoveryPosition: number | null;
  liveCcu: number | null;
  visits: number | null;
  favorites: number | null;
  publicRating: number | null;
  updatedAt: string | null;
  evidenceId: string;
  patternTags: readonly string[];
  publicOffers: readonly PublicOfferEvidence[];
}

export interface PublicRadarCaptureInput {
  source: "roblox_public_chart";
  sort: PublicRadarSort;
  sourceUrl: string;
  capturedAt: string;
  expiresAt: string;
  captureMode: RadarCaptureMode;
  locale: string;
  entries: PublicRadarCaptureEntry[];
}

export type NormalizedPublicRadarCapture = Readonly<
  Omit<PublicRadarCaptureInput, "entries"> & {
    entries: readonly Readonly<PublicRadarCaptureEntry>[];
  }
>;

export interface PublicRadarSignal {
  id: string;
  metric: PublicSignalMetric;
  ordinalBand: OrdinalBand;
  evidenceId: string;
  sourceUrl: string;
  observedAt: string;
  expiresAt: string;
  confidence: number;
}

export interface RadarOrdinalScore {
  dimension: RadarOrdinalDimension;
  score: 1 | 2 | 3 | 4 | 5;
  evidenceIds: string[];
  confidence: number;
  asOf: string;
}

export interface PublicCounterDiscontinuity {
  metric: "visits" | "favorites";
  previousValue: number;
  currentValue: number;
  previousEvidenceId: string;
  evidenceId: string;
  observedAt: string;
}

export interface PublicRadarEntry {
  id: string;
  universeId: number;
  rootPlaceId: number;
  gameLabel: string;
  publicUrl: string;
  signals: PublicRadarSignal[];
  ordinalScores: RadarOrdinalScore[];
  patternTags: string[];
  publicOffers: PublicOfferEvidence[];
  discontinuities: PublicCounterDiscontinuity[];
}

export interface PublicRadarSnapshot {
  schemaVersion: "1.0.0";
  id: string;
  asOf: string;
  expiresAt: string;
  corpusRecordIds: string[];
  entries: PublicRadarEntry[];
  provenance: {
    provenanceId: string;
    evidenceIds: string[];
    traceIds: string[];
  };
  createdAt: string;
}

export interface RadarSourceHealth {
  source: "roblox_public_chart";
  status: "ok" | "error";
  checkedAt: string;
  errorCode: "source_refresh_failed" | null;
}

export interface RadarScoreInput {
  publicMomentum: number | null;
  rankEvidence: number | null;
  publicOfferEvidence: readonly PublicOfferEvidence[] | null;
  liveOpsActivity: number | null;
  buildOriginalityFit: number | null;
  confidenceEvidence: {
    sourceCoverage: number;
    sampleDuration: number;
    rankEvidence: number;
    productObservability: number;
  };
}

export interface RadarSourceProvider {
  capture(): Promise<unknown>;
}

export type RadarRefreshResult =
  | {
      status: "published";
      snapshot: PublicRadarSnapshot;
      normalizedCapture: NormalizedPublicRadarCapture;
      health: RadarSourceHealth;
    }
  | {
      status: "failed";
      health: RadarSourceHealth;
    };
