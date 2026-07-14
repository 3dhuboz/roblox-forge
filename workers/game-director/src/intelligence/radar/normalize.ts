import {
  PUBLIC_RADAR_SORTS,
  RADAR_CAPTURE_MODES,
  type NormalizedPublicRadarCapture,
  type PublicRadarCaptureEntry,
  type PublicRadarCaptureInput,
} from "./types";
import { normalizePublicOfferEvidenceList } from "./offers";

const ROOT_FIELDS = new Set([
  "source",
  "sort",
  "sourceUrl",
  "capturedAt",
  "expiresAt",
  "captureMode",
  "locale",
  "entries",
]);

const ENTRY_FIELDS = new Set([
  "corpusRecordId",
  "universeId",
  "rootPlaceId",
  "gameLabel",
  "publicUrl",
  "discoveryPosition",
  "liveCcu",
  "visits",
  "favorites",
  "publicRating",
  "updatedAt",
  "evidenceId",
  "patternTags",
  "publicOffers",
]);

const PRIVATE_OWNER_KEYS = new Set([
  "owneranalytics",
  "dailyrevenue",
  "payingusers",
  "payinguserscvr",
  "payerconversion",
  "arpdau",
  "arppu",
  "d1retention",
  "d7retention",
  "d30retention",
  "estimatedrevenue",
  "estimatedrobux",
  "revenuerank",
  "topmonetizing",
]);

const VIRTUAL_CONTENT_KEYS = new Set([
  "gameplaycontent",
  "placefile",
  "map",
  "scripts",
  "code",
  "assets",
  "audio",
  "interface",
  "ui",
  "rawui",
]);

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function rejectForbiddenEvidence(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(rejectForbiddenEvidence);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizedKey(key);
    if (PRIVATE_OWNER_KEYS.has(normalized)) {
      throw new Error("private_owner_evidence_forbidden");
    }
    if (VIRTUAL_CONTENT_KEYS.has(normalized)) {
      throw new Error("virtual_content_forbidden");
    }
    rejectForbiddenEvidence(child);
  }
}

function record(value: unknown, errorCode: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(errorCode);
  }
  return value as Record<string, unknown>;
}

function assertClosed(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): void {
  const unknown = Object.keys(value).find((key) => !allowed.has(key));
  if (unknown) throw new Error(`unknown_field:${unknown}`);
}

function text(
  value: unknown,
  errorCode: string,
  maxLength = 160,
): string {
  if (typeof value !== "string") throw new Error(errorCode);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) throw new Error(errorCode);
  return trimmed;
}

function canonicalId(value: unknown, errorCode: string): string {
  const result = text(value, errorCode, 96);
  if (!/^[a-z][a-z0-9]*(?::[a-z0-9][a-z0-9._-]*)+$/.test(result)) {
    throw new Error(errorCode);
  }
  return result;
}

function isoDate(value: unknown, errorCode: string): string {
  const result = text(value, errorCode, 64);
  if (!Number.isFinite(Date.parse(result))) throw new Error(errorCode);
  return new Date(result).toISOString();
}

function nullableNumber(
  value: unknown,
  errorCode: string,
  options: { integer?: boolean; max?: number } = {},
): number | null {
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    (options.integer === true && !Number.isInteger(value)) ||
    (options.max !== undefined && value > options.max)
  ) {
    throw new Error(errorCode);
  }
  return value;
}

function chartUrl(value: unknown): string {
  const raw = text(value, "source_not_allowlisted", 512);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("source_not_allowlisted");
  }
  const path = url.pathname.replace(/\/$/, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hostname !== "www.roblox.com" ||
    !["/charts/top-playing-now", "/charts/top-trending"].includes(path)
  ) {
    throw new Error("source_not_allowlisted");
  }
  return `${url.origin}${path}`;
}

function positiveSafeInteger(value: unknown, errorCode: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error(errorCode);
  }
  return Number(value);
}

function publicGameUrl(value: unknown, rootPlaceId: number): string {
  const raw = text(value, "invalid_public_game_url", 512);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid_public_game_url");
  }
  const match = /^\/games\/(\d+)(?:\/[^?#]+)?$/.exec(url.pathname.replace(/\/$/, ""));
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hostname !== "www.roblox.com" ||
    url.search ||
    url.hash ||
    match === null ||
    Number(match[1]) !== rootPlaceId
  ) {
    throw new Error("invalid_public_game_url");
  }
  return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
}

function entry(
  value: unknown,
  context: { locale: string; capturedAt: string },
): PublicRadarCaptureEntry {
  const input = record(value, "invalid_radar_entry");
  assertClosed(input, ENTRY_FIELDS);
  const tags = input.patternTags;
  if (!Array.isArray(tags) || tags.length > 24) {
    throw new Error("invalid_pattern_tags");
  }
  const patternTags = [...new Set(tags.map((tag) => text(tag, "invalid_pattern_tag", 64)))];
  if (patternTags.some((tag) => !/^[a-z0-9][a-z0-9-]*$/.test(tag))) {
    throw new Error("invalid_pattern_tag");
  }
  const discoveryPosition = nullableNumber(
    input.discoveryPosition,
    "invalid_discovery_position",
    { integer: true, max: 10_000 },
  );
  if (discoveryPosition === 0) throw new Error("invalid_discovery_position");
  const updatedAt =
    input.updatedAt === null
      ? null
      : isoDate(input.updatedAt, "invalid_updated_at");
  const universeId = positiveSafeInteger(
    input.universeId,
    "invalid_universe_id",
  );
  const rootPlaceId = positiveSafeInteger(
    input.rootPlaceId,
    "invalid_root_place_id",
  );
  if (updatedAt !== null && Date.parse(updatedAt) > Date.parse(context.capturedAt)) {
    throw new Error("updated_after_capture");
  }
  const publicOffers = normalizePublicOfferEvidenceList(input.publicOffers, {
    locale: context.locale,
    rootPlaceId,
  });
  if (
    publicOffers.some(
      (offer) => Date.parse(offer.observedAt) > Date.parse(context.capturedAt),
    )
  ) {
    throw new Error("offer_observed_after_capture");
  }
  return {
    corpusRecordId: canonicalId(
      input.corpusRecordId,
      "invalid_corpus_record_id",
    ),
    universeId,
    rootPlaceId,
    gameLabel: text(input.gameLabel, "invalid_game_label", 80),
    publicUrl: publicGameUrl(input.publicUrl, rootPlaceId),
    discoveryPosition,
    liveCcu: nullableNumber(input.liveCcu, "invalid_ccu", { integer: true }),
    visits: nullableNumber(input.visits, "invalid_visits", { integer: true }),
    favorites: nullableNumber(input.favorites, "invalid_favorites", {
      integer: true,
    }),
    publicRating: nullableNumber(input.publicRating, "invalid_public_rating", {
      max: 1,
    }),
    updatedAt,
    evidenceId: canonicalId(input.evidenceId, "invalid_evidence_id"),
    patternTags,
    publicOffers,
  };
}

export function normalizePublicRadarCapture(
  value: unknown,
): NormalizedPublicRadarCapture {
  rejectForbiddenEvidence(value);
  const input = record(value, "invalid_radar_capture");
  assertClosed(input, ROOT_FIELDS);
  if (input.source !== "roblox_public_chart") {
    throw new Error("source_not_allowlisted");
  }
  if (
    typeof input.sort !== "string" ||
    !(PUBLIC_RADAR_SORTS as readonly string[]).includes(input.sort)
  ) {
    throw new Error("invalid_public_sort");
  }
  if (
    typeof input.captureMode !== "string" ||
    !(RADAR_CAPTURE_MODES as readonly string[]).includes(input.captureMode)
  ) {
    throw new Error("invalid_capture_mode");
  }
  if (!Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 32) {
    throw new Error("invalid_radar_entries");
  }
  const capturedAt = isoDate(input.capturedAt, "invalid_captured_at");
  const expiresAt = isoDate(input.expiresAt, "invalid_expires_at");
  if (Date.parse(expiresAt) <= Date.parse(capturedAt)) {
    throw new Error("invalid_expiry_window");
  }
  const locale = text(input.locale, "invalid_locale", 32);
  const entries = input.entries.map((candidate) =>
    entry(candidate, { locale, capturedAt }),
  );
  if (entries.some((item) => item.discoveryPosition === null)) {
    throw new Error("missing_chart_rank");
  }
  const sourceUrl = chartUrl(input.sourceUrl);
  const expectedPath =
    input.sort === "top_playing_now"
      ? "/charts/top-playing-now"
      : "/charts/top-trending";
  if (new URL(sourceUrl).pathname !== expectedPath) {
    throw new Error("chart_sort_source_mismatch");
  }
  for (const key of [
    "universeId",
    "rootPlaceId",
    "corpusRecordId",
    "evidenceId",
  ] as const) {
    const values = entries.map((item) => item[key]);
    if (new Set(values).size !== values.length) {
      throw new Error(`duplicate_${key}`);
    }
  }
  const allEvidenceIds = entries.flatMap((item) => [
    item.evidenceId,
    ...item.publicOffers.map((offer) => offer.evidenceId),
  ]);
  if (new Set(allEvidenceIds).size !== allEvidenceIds.length) {
    throw new Error("duplicate_evidence_id");
  }
  const frozenEntries = entries.map((item) =>
    Object.freeze({
      ...item,
      patternTags: Object.freeze([...item.patternTags]),
      publicOffers: Object.freeze([...item.publicOffers]),
    }),
  );
  return Object.freeze({
    source: "roblox_public_chart" as const,
    sort: input.sort as PublicRadarCaptureInput["sort"],
    sourceUrl,
    capturedAt,
    expiresAt,
    captureMode: input.captureMode as PublicRadarCaptureInput["captureMode"],
    locale,
    entries: Object.freeze(frozenEntries),
  });
}
