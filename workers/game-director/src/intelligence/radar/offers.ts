import {
  PUBLIC_OFFER_PRICE_CONTEXTS,
  PUBLIC_OFFER_TYPES,
  type PublicOfferEvidence,
} from "./types";

const OFFER_FIELDS = new Set([
  "evidenceId",
  "offerType",
  "offerId",
  "sourceUrl",
  "observedAt",
  "locale",
  "priceContext",
  "priceRobux",
]);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("invalid_public_offer_evidence");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, errorCode: string, maxLength: number): string {
  if (typeof value !== "string") throw new Error(errorCode);
  const result = value.trim();
  if (!result || result.length > maxLength) throw new Error(errorCode);
  return result;
}

function canonicalId(value: unknown): string {
  const result = text(value, "invalid_offer_evidence_id", 96);
  if (!/^[a-z][a-z0-9]*(?::[a-z0-9][a-z0-9._-]*)+$/.test(result)) {
    throw new Error("invalid_offer_evidence_id");
  }
  return result;
}

function isoDate(value: unknown): string {
  const result = text(value, "invalid_offer_observed_at", 40);
  if (!Number.isFinite(Date.parse(result))) {
    throw new Error("invalid_offer_observed_at");
  }
  return new Date(result).toISOString();
}

function optionalPositiveInteger(
  value: unknown,
  errorCode: string,
): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error(errorCode);
  }
  return Number(value);
}

function optionalNonNegativeInteger(
  value: unknown,
  errorCode: string,
): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(errorCode);
  }
  return Number(value);
}

function publicOfferUrl(
  value: unknown,
  identity: {
    rootPlaceId?: number;
    offerId: number | null;
    offerType: PublicOfferEvidence["offerType"];
  },
): string {
  const raw = text(value, "invalid_public_offer_url", 512);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid_public_offer_url");
  }
  const path = url.pathname.replace(/\/$/, "");
  const gamePassPath = /^\/game-pass\/\d+(?:\/[^?#]+)?$/.test(path);
  const experiencePath = /^\/games\/(\d+)(?:\/[^?#]+)?$/.exec(path);
  const matchesExpectedPlace =
    experiencePath !== null &&
    (identity.rootPlaceId === undefined ||
      Number(experiencePath[1]) === identity.rootPlaceId);
  const gamePassId = gamePassPath
    ? Number(/^\/game-pass\/(\d+)/.exec(path)?.[1])
    : null;
  const matchesExpectedOffer =
    gamePassPath &&
    identity.offerType === "game_pass" &&
    identity.offerId !== null &&
    gamePassId === identity.offerId;
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hostname !== "www.roblox.com" ||
    url.search ||
    url.hash ||
    (!matchesExpectedOffer && !matchesExpectedPlace)
  ) {
    throw new Error("invalid_public_offer_url");
  }
  return `${url.origin}${path}`;
}

export function normalizePublicOfferEvidenceList(
  value: unknown,
  expected: { locale?: string; rootPlaceId?: number } = {},
): readonly Readonly<PublicOfferEvidence>[] {
  if (!Array.isArray(value) || value.length > 18) {
    throw new Error("invalid_public_offer_evidence");
  }
  const normalized = value.map((candidate) => {
    const input = record(candidate);
    const unknown = Object.keys(input).find((key) => !OFFER_FIELDS.has(key));
    if (unknown) throw new Error(`unknown_offer_field:${unknown}`);
    if (
      typeof input.offerType !== "string" ||
      !(PUBLIC_OFFER_TYPES as readonly string[]).includes(input.offerType)
    ) {
      throw new Error("invalid_public_offer_type");
    }
    if (
      typeof input.priceContext !== "string" ||
      !(PUBLIC_OFFER_PRICE_CONTEXTS as readonly string[]).includes(
        input.priceContext,
      )
    ) {
      throw new Error("invalid_offer_price_context");
    }
    const locale = text(input.locale, "invalid_offer_locale", 32);
    if (expected.locale !== undefined && locale !== expected.locale) {
      throw new Error("offer_locale_mismatch");
    }
    const priceRobux = optionalNonNegativeInteger(
      input.priceRobux,
      "invalid_offer_price",
    );
    if (
      (input.priceContext === "unavailable" && priceRobux !== null) ||
      (input.priceContext !== "unavailable" && priceRobux === null)
    ) {
      throw new Error("offer_price_context_mismatch");
    }
    const offerType = input.offerType as PublicOfferEvidence["offerType"];
    const offerId = optionalPositiveInteger(input.offerId, "invalid_offer_id");
    return Object.freeze({
      evidenceId: canonicalId(input.evidenceId),
      offerType,
      offerId,
      sourceUrl: publicOfferUrl(input.sourceUrl, {
        rootPlaceId: expected.rootPlaceId,
        offerId,
        offerType,
      }),
      observedAt: isoDate(input.observedAt),
      locale,
      priceContext:
        input.priceContext as PublicOfferEvidence["priceContext"],
      priceRobux,
    });
  });
  const evidenceIds = normalized.map((item) => item.evidenceId);
  if (new Set(evidenceIds).size !== evidenceIds.length) {
    throw new Error("duplicate_offer_evidence_id");
  }
  return Object.freeze(normalized);
}

export function derivePublicOfferScore(
  evidence: readonly PublicOfferEvidence[],
): number | null {
  if (evidence.length === 0) return null;
  const observableTypes = new Set(evidence.map((item) => item.offerType)).size;
  const pricedOffers = evidence.filter((item) => item.priceRobux !== null).length;
  const coverage = Math.min(1, observableTypes / PUBLIC_OFFER_TYPES.length);
  const priceObservability = Math.min(1, pricedOffers / evidence.length);
  return Math.round(20 + 50 * coverage + 30 * priceObservability);
}
