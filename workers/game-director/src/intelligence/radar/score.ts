import type { RadarScoreInput } from "./types";
import {
  derivePublicOfferScore,
  normalizePublicOfferEvidenceList,
} from "./offers";

const WEIGHTS = {
  publicMomentum: 30,
  rankEvidence: 20,
  publicOfferSignal: 25,
  liveOpsActivity: 15,
  buildOriginalityFit: 10,
} as const;

function bounded(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) throw new Error("invalid_score_value");
  return Math.min(maximum, Math.max(minimum, value));
}

export function scoreMos(input: { raw: number; confidence: number }): {
  adjusted: number;
  uncertainty: number;
} {
  const raw = bounded(input.raw, 0, 100);
  const confidence = bounded(input.confidence, 0, 1);
  return {
    adjusted: Math.round(50 + confidence * (raw - 50)),
    uncertainty: Math.round(5 + 20 * (1 - confidence)),
  };
}

function optionalScore(value: number | null): number | null {
  return value === null ? null : bounded(value, 0, 100);
}

export function scoreSnapshot(input: RadarScoreInput) {
  const publicOfferEvidence =
    input.publicOfferEvidence === null
      ? null
      : normalizePublicOfferEvidenceList(input.publicOfferEvidence);
  const components = {
    publicMomentum: optionalScore(input.publicMomentum),
    rankEvidence: optionalScore(input.rankEvidence),
    publicOfferSignal:
      publicOfferEvidence === null
        ? null
        : derivePublicOfferScore(publicOfferEvidence),
    liveOpsActivity: optionalScore(input.liveOpsActivity),
    buildOriginalityFit: optionalScore(input.buildOriginalityFit),
  };
  const available = (Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>).filter(
    (key) => components[key] !== null,
  );
  if (available.length === 0) throw new Error("insufficient_public_evidence");
  const availableWeight = available.reduce((sum, key) => sum + WEIGHTS[key], 0);
  const raw = Math.round(
    available.reduce(
      (sum, key) => sum + (components[key] ?? 0) * WEIGHTS[key],
      0,
    ) / availableWeight,
  );
  const confidence = bounded(
    0.35 * bounded(input.confidenceEvidence.sourceCoverage, 0, 1) +
      0.25 * bounded(input.confidenceEvidence.sampleDuration, 0, 1) +
      0.2 * bounded(input.confidenceEvidence.rankEvidence, 0, 1) +
      0.2 * bounded(input.confidenceEvidence.productObservability, 0, 1),
    0,
    1,
  );
  return {
    modelVersion:
      components.rankEvidence === null
        ? ("MOS-public-no-rank-v1" as const)
        : ("MOS-public-v1" as const),
    raw,
    confidence: Number(confidence.toFixed(4)),
    ...scoreMos({ raw, confidence }),
    components,
    publicOfferEvidenceIds:
      publicOfferEvidence?.map((item) => item.evidenceId) ?? [],
    evidenceLabels: [
      ...(components.publicOfferSignal === null
        ? []
        : (["public_offer_signal"] as const)),
      "inferred_monetization_fit" as const,
    ],
  };
}
