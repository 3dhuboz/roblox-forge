import {
  deriveEntryFeatures,
  momentumOrdinalScore,
  ordinalBandForMetric,
  ordinalBandForRank,
} from "./features";
import { normalizePublicRadarCapture } from "./normalize";
import type {
  NormalizedPublicRadarCapture,
  OrdinalBand,
  PublicRadarCaptureEntry,
  PublicRadarEntry,
  PublicOfferEvidence,
  PublicRadarSignal,
  PublicRadarSnapshot,
  PublicSignalMetric,
  RadarOrdinalScore,
  RadarRefreshResult,
  RadarSourceProvider,
} from "./types";

function bandScore(band: OrdinalBand): 1 | 2 | 3 | 4 | 5 {
  return {
    "very-low": 1,
    low: 2,
    medium: 3,
    high: 4,
    "very-high": 5,
  }[band] as 1 | 2 | 3 | 4 | 5;
}

function publicSignal(
  entry: PublicRadarCaptureEntry,
  capture: NormalizedPublicRadarCapture,
  metric: PublicSignalMetric,
  ordinalBand: OrdinalBand,
  confidence: number,
): PublicRadarSignal {
  return {
    id: `signal:${entry.universeId}-${metric}`,
    metric,
    ordinalBand,
    evidenceId: entry.evidenceId,
    sourceUrl: capture.sourceUrl,
    observedAt: capture.capturedAt,
    expiresAt: capture.expiresAt,
    confidence,
  };
}

function publicOfferSignal(
  offer: PublicOfferEvidence,
  capture: NormalizedPublicRadarCapture,
  universeId: number,
  offerIndex: number,
): PublicRadarSignal {
  return {
    id: `signal:${universeId}-public-offer-${offerIndex + 1}`,
    metric: "public-offer",
    ordinalBand: "medium",
    evidenceId: offer.evidenceId,
    sourceUrl: offer.sourceUrl,
    observedAt: offer.observedAt,
    expiresAt: capture.expiresAt,
    confidence: offer.priceContext === "unavailable" ? 0.7 : 0.9,
  };
}

function daysBetween(later: string, earlier: string): number {
  return Math.max(0, (Date.parse(later) - Date.parse(earlier)) / 86_400_000);
}

function recencyBand(captureAt: string, updatedAt: string): OrdinalBand {
  const days = daysBetween(captureAt, updatedAt);
  if (days <= 3) return "very-high";
  if (days <= 14) return "high";
  if (days <= 45) return "medium";
  if (days <= 120) return "low";
  return "very-low";
}

function buildEntry(
  entry: PublicRadarCaptureEntry,
  index: number,
  snapshotId: string,
  capture: NormalizedPublicRadarCapture,
  previous: PublicRadarCaptureEntry | undefined,
  previousCaptureAt: string | null,
): PublicRadarEntry {
  const signals: PublicRadarSignal[] = [];
  if (entry.discoveryPosition !== null) {
    signals.push(
      publicSignal(
        entry,
        capture,
        "discovery-position",
        ordinalBandForRank(entry.discoveryPosition),
        1,
      ),
    );
  }
  for (const [metric, value] of [
    ["ccu", entry.liveCcu],
    ["visits", entry.visits],
    ["favorites", entry.favorites],
  ] as const) {
    if (value !== null) {
      signals.push(
        publicSignal(entry, capture, metric, ordinalBandForMetric(value), 0.9),
      );
    }
  }
  if (entry.publicRating !== null) {
    const ratingBand: OrdinalBand =
      entry.publicRating >= 0.9
        ? "very-high"
        : entry.publicRating >= 0.8
          ? "high"
          : entry.publicRating >= 0.65
            ? "medium"
            : entry.publicRating >= 0.5
              ? "low"
              : "very-low";
    signals.push(publicSignal(entry, capture, "public-rating", ratingBand, 0.9));
  }
  if (entry.updatedAt !== null) {
    signals.push(
      publicSignal(
        entry,
        capture,
        "update-cadence",
        recencyBand(capture.capturedAt, entry.updatedAt),
        0.75,
      ),
    );
  }
  signals.push(
    ...entry.publicOffers.map((offer, offerIndex) =>
      publicOfferSignal(offer, capture, entry.universeId, offerIndex),
    ),
  );
  const ordinalScores: RadarOrdinalScore[] = [];
  const visibilitySignal = signals.find(
    (signal) => signal.metric === "discovery-position" || signal.metric === "ccu",
  );
  if (visibilitySignal) {
    ordinalScores.push({
      dimension: "visibility",
      score: bandScore(visibilitySignal.ordinalBand),
      evidenceIds: [visibilitySignal.evidenceId],
      confidence: visibilitySignal.confidence,
      asOf: capture.capturedAt,
    });
  }
  const recencySignal = signals.find(
    (signal) => signal.metric === "update-cadence",
  );
  if (recencySignal) {
    ordinalScores.push({
      dimension: "recency",
      score: bandScore(recencySignal.ordinalBand),
      evidenceIds: [recencySignal.evidenceId],
      confidence: recencySignal.confidence,
      asOf: capture.capturedAt,
    });
  }
  const features =
    previous && previousCaptureAt
      ? deriveEntryFeatures(previous, entry, {
          previousCapturedAt: previousCaptureAt,
          currentCapturedAt: capture.capturedAt,
        })
      : null;
  if (features) {
    const momentum = momentumOrdinalScore(
      features,
      previous!.evidenceId,
      entry.evidenceId,
      capture.capturedAt,
    );
    if (momentum) ordinalScores.push(momentum);
  }
  return {
    id: `${snapshotId}-entry-${index + 1}`,
    universeId: entry.universeId,
    rootPlaceId: entry.rootPlaceId,
    gameLabel: entry.gameLabel,
    publicUrl: entry.publicUrl,
    signals,
    ordinalScores,
    patternTags: [...entry.patternTags],
    publicOffers: entry.publicOffers.map((offer) => ({ ...offer })),
    discontinuities: (features?.discontinuities ?? []).map((discontinuity) => ({
      ...discontinuity,
      previousEvidenceId: previous!.evidenceId,
      evidenceId: entry.evidenceId,
      observedAt: capture.capturedAt,
    })),
  };
}

function snapshot(
  capture: NormalizedPublicRadarCapture,
  previous: NormalizedPublicRadarCapture | null,
  id: string,
): PublicRadarSnapshot {
  const comparablePrevious =
    previous?.sort === capture.sort &&
    previous.source === capture.source &&
    previous.sourceUrl === capture.sourceUrl &&
    previous.locale === capture.locale &&
    Date.parse(previous.capturedAt) < Date.parse(capture.capturedAt)
      ? previous
      : null;
  const entries = capture.entries.map((entry, index) =>
    buildEntry(
      entry,
      index,
      id,
      capture,
      comparablePrevious?.entries.find(
        (candidate) =>
          candidate.universeId === entry.universeId &&
          candidate.evidenceId !== entry.evidenceId,
      ),
      comparablePrevious?.capturedAt ?? null,
    ),
  );
  const evidenceIds = entries.flatMap((entry) => [
    ...entry.signals.map((signal) => signal.evidenceId),
    ...entry.ordinalScores.flatMap((score) => score.evidenceIds),
    ...entry.publicOffers.map((offer) => offer.evidenceId),
    ...entry.discontinuities.flatMap((discontinuity) => [
      discontinuity.previousEvidenceId,
      discontinuity.evidenceId,
    ]),
  ]);
  return {
    schemaVersion: "1.0.0",
    id,
    asOf: capture.capturedAt,
    expiresAt: capture.expiresAt,
    corpusRecordIds: [...new Set(capture.entries.map((entry) => entry.corpusRecordId))],
    entries,
    provenance: {
      provenanceId: `${id}-provenance`,
      evidenceIds: [...new Set(evidenceIds)],
      traceIds: [`${id}-refresh`],
    },
    createdAt: capture.capturedAt,
  };
}

export async function refreshPublicRadar(input: {
  provider: RadarSourceProvider;
  previous: NormalizedPublicRadarCapture | null;
  idFactory?: () => string;
  now?: () => string;
}): Promise<RadarRefreshResult> {
  const now = input.now ?? (() => new Date().toISOString());
  try {
    const raw = await input.provider.capture();
    const normalizedCapture = normalizePublicRadarCapture(raw);
    const id = (input.idFactory ?? (() => `radar:${crypto.randomUUID()}`))();
    if (
      id.length > 64 ||
      !/^[a-z][a-z0-9]*(?::[a-z0-9][a-z0-9._-]*)+$/.test(id)
    ) {
      throw new Error("invalid_snapshot_id");
    }
    return {
      status: "published",
      snapshot: snapshot(normalizedCapture, input.previous, id),
      normalizedCapture,
      health: {
        source: "roblox_public_chart",
        status: "ok",
        checkedAt: normalizedCapture.capturedAt,
        errorCode: null,
      },
    };
  } catch {
    return {
      status: "failed",
      health: {
        source: "roblox_public_chart",
        status: "error",
        checkedAt: now(),
        errorCode: "source_refresh_failed",
      },
    };
  }
}
