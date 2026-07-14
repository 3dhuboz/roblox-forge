import type {
  OrdinalBand,
  PublicRadarCaptureEntry,
  RadarOrdinalScore,
} from "./types";

export interface EntryFeatures {
  sampleDurationDays: number;
  ccuChangeRatio: number | null;
  visitsVelocity: number | null;
  favoritesVelocity: number | null;
  discontinuities: Array<{
    metric: "visits" | "favorites";
    previousValue: number;
    currentValue: number;
  }>;
}

function ratio(
  previous: number | null,
  current: number | null,
  sampleDurationDays: number,
): number | null {
  if (previous === null || current === null || previous <= 0) return null;
  return (current - previous) / previous / sampleDurationDays;
}

function monotonicRatio(
  name: "visits" | "favorites",
  previous: number | null,
  current: number | null,
  discontinuities: EntryFeatures["discontinuities"],
  sampleDurationDays: number,
): number | null {
  if (previous === null || current === null || previous <= 0) return null;
  if (current < previous) {
    discontinuities.push({ metric: name, previousValue: previous, currentValue: current });
    return null;
  }
  return (current - previous) / previous / sampleDurationDays;
}

export function deriveEntryFeatures(
  previous: PublicRadarCaptureEntry,
  current: PublicRadarCaptureEntry,
  interval: { previousCapturedAt: string; currentCapturedAt: string },
): EntryFeatures {
  const sampleDurationDays =
    (Date.parse(interval.currentCapturedAt) -
      Date.parse(interval.previousCapturedAt)) /
    86_400_000;
  if (!Number.isFinite(sampleDurationDays) || sampleDurationDays <= 0) {
    throw new Error("invalid_radar_sample_interval");
  }
  const discontinuities: EntryFeatures["discontinuities"] = [];
  return {
    sampleDurationDays,
    ccuChangeRatio: ratio(
      previous.liveCcu,
      current.liveCcu,
      sampleDurationDays,
    ),
    visitsVelocity: monotonicRatio(
      "visits",
      previous.visits,
      current.visits,
      discontinuities,
      sampleDurationDays,
    ),
    favoritesVelocity: monotonicRatio(
      "favorites",
      previous.favorites,
      current.favorites,
      discontinuities,
      sampleDurationDays,
    ),
    discontinuities,
  };
}

export function ordinalBandForRank(rank: number): OrdinalBand {
  if (rank <= 3) return "very-high";
  if (rank <= 10) return "high";
  if (rank <= 20) return "medium";
  if (rank <= 32) return "low";
  return "very-low";
}

export function ordinalBandForMetric(value: number): OrdinalBand {
  if (value >= 100_000) return "very-high";
  if (value >= 10_000) return "high";
  if (value >= 1_000) return "medium";
  if (value > 0) return "low";
  return "very-low";
}

function momentumScore(features: EntryFeatures): 1 | 2 | 3 | 4 | 5 | null {
  const values = [
    features.ccuChangeRatio,
    features.visitsVelocity,
    features.favoritesVelocity,
  ].filter((value): value is number => value !== null);
  if (values.length === 0) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average >= 0.2) return 5;
  if (average >= 0.05) return 4;
  if (average > -0.05) return 3;
  if (average > -0.2) return 2;
  return 1;
}

export function momentumOrdinalScore(
  features: EntryFeatures,
  previousEvidenceId: string,
  currentEvidenceId: string,
  asOf: string,
): RadarOrdinalScore | null {
  const score = momentumScore(features);
  if (score === null) return null;
  const observedComponents = [
    features.ccuChangeRatio,
    features.visitsVelocity,
    features.favoritesVelocity,
  ].filter((value) => value !== null).length;
  return {
    dimension: "momentum",
    score,
    evidenceIds: [previousEvidenceId, currentEvidenceId],
    confidence: Number((observedComponents / 3).toFixed(4)),
    asOf,
  };
}
