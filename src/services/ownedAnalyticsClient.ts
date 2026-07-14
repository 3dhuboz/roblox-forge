import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../lib/isTauriRuntime";
import type { OperationReceipt } from "../types/receipts";
import {
  OWNED_ANALYTICS_GRANULARITIES,
  OWNED_ANALYTICS_QUERY_METRICS,
  OWNED_ANALYTICS_WIRE_STATUSES,
  type OwnedAnalyticsBreakdown,
  type OwnedAnalyticsDataPoint,
  type OwnedAnalyticsEvidence,
  type OwnedAnalyticsItemMonetization,
  type OwnedAnalyticsMetricReading,
  type OwnedAnalyticsNormalizedMetrics,
  type OwnedAnalyticsPointQuality,
  type OwnedAnalyticsPortfolio,
  type OwnedAnalyticsPortfolioInput,
  type OwnedAnalyticsQueryInput,
  type OwnedAnalyticsQueryMetric,
  type OwnedAnalyticsQueryRange,
  type OwnedAnalyticsSeries,
  type OwnedAnalyticsViewState,
  type OwnedAnalyticsWireError,
  type OwnedAnalyticsWireQuality,
  type OwnedAnalyticsWireStatus,
} from "../types/ownedAnalytics";

export type OwnedAnalyticsClientErrorCode =
  | "desktop_required"
  | "invalid_request"
  | "authority_failed"
  | "invalid_response";

export class OwnedAnalyticsClientError extends Error {
  readonly code: OwnedAnalyticsClientErrorCode;

  constructor(code: OwnedAnalyticsClientErrorCode, message: string) {
    super(message);
    this.name = "OwnedAnalyticsClientError";
    this.code = code;
  }
}

type UnknownRecord = Record<string, unknown>;

const MAX_QUERY_DAYS = 370;
const MAX_SERIES = 128;
const MAX_POINTS_PER_SERIES = 4_096;
const MAX_BREAKDOWNS = 16;
const MAX_STRING_VALUES = 32;
const MAX_TEXT_LENGTH = 256;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function invalidRequest(message: string): never {
  throw new OwnedAnalyticsClientError("invalid_request", message);
}

function invalidResponse(): never {
  throw new OwnedAnalyticsClientError(
    "invalid_response",
    "Owned analytics authority returned an invalid response.",
  );
}

function isEnumValue<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function parseTimestamp(value: unknown): { text: string; milliseconds: number } {
  if (
    typeof value !== "string" ||
    !RFC3339_PATTERN.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    invalidResponse();
  }
  return { text: value, milliseconds: Date.parse(value) };
}

function validateRange(range: OwnedAnalyticsQueryRange): void {
  if (!isRecord(range)) invalidRequest("Select a valid analytics range.");
  if (!isEnumValue(OWNED_ANALYTICS_QUERY_METRICS, range.metric)) {
    invalidRequest("Select a supported owned analytics metric.");
  }
  if (!isEnumValue(OWNED_ANALYTICS_GRANULARITIES, range.granularity)) {
    invalidRequest("Select a supported analytics granularity.");
  }
  if (
    typeof range.startTime !== "string" ||
    typeof range.endTime !== "string" ||
    !RFC3339_PATTERN.test(range.startTime) ||
    !RFC3339_PATTERN.test(range.endTime)
  ) {
    invalidRequest("Analytics dates must be RFC3339 timestamps.");
  }
  const start = Date.parse(range.startTime);
  const end = Date.parse(range.endTime);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start >= end ||
    end - start > MAX_QUERY_DAYS * 86_400_000
  ) {
    invalidRequest("Select a bounded analytics date range.");
  }
}

function validateInput(input: OwnedAnalyticsQueryInput): void {
  if (!isRecord(input) || typeof input.targetId !== "string") {
    invalidRequest("Select a verified Roblox target.");
  }
  if (!UUID_PATTERN.test(input.targetId)) {
    invalidRequest("Select a verified Roblox target record.");
  }
  validateRange(input.range);
}

function normalizeUniverseId(value: unknown): string {
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) return value;
  return invalidResponse();
}

function boundedText(value: unknown, allowEmpty = false): string {
  if (typeof value !== "string" || value.length > MAX_TEXT_LENGTH) {
    return invalidResponse();
  }
  if (!allowEmpty && value.trim().length === 0) return invalidResponse();
  return value;
}

function normalizeReceipt(value: unknown): OperationReceipt {
  if (!isRecord(value)) return invalidResponse();
  if (
    value.authoritative !== true ||
    value.operation !== "query_owned_analytics" ||
    typeof value.operationId !== "string" ||
    typeof value.correlationId !== "string" ||
    typeof value.state !== "string" ||
    typeof value.startedAt !== "string" ||
    typeof value.message !== "string" ||
    !Array.isArray(value.diagnostics) ||
    typeof value.retrySafety !== "string"
  ) {
    return invalidResponse();
  }
  return value as unknown as OperationReceipt;
}

function normalizeBreakdowns(value: unknown): OwnedAnalyticsBreakdown[] {
  if (!Array.isArray(value) || value.length > MAX_BREAKDOWNS) {
    return invalidResponse();
  }
  return value.map((item) => {
    if (!isRecord(item)) return invalidResponse();
    return {
      dimension: boundedText(item.dimension),
      value: boundedText(item.value),
      displayValue:
        item.displayValue === undefined
          ? null
          : boundedText(item.displayValue, true),
    };
  });
}

function displayQuality(
  quality: OwnedAnalyticsWireQuality,
): OwnedAnalyticsPointQuality {
  switch (quality) {
    case "valid":
      return "Valid";
    case "projected":
      return "Projected";
    case "insufficient":
      return "NotStatisticallySignificant";
  }
}

function normalizeDataPoints(value: unknown): OwnedAnalyticsDataPoint[] {
  if (!Array.isArray(value) || value.length > MAX_POINTS_PER_SERIES) {
    return invalidResponse();
  }
  return value.map((item) => {
    if (!isRecord(item)) return invalidResponse();
    const timestamp = parseTimestamp(item.time).text;
    const hasValue = Object.prototype.hasOwnProperty.call(item, "value");
    if (hasValue && (typeof item.value !== "number" || !Number.isFinite(item.value))) {
      return invalidResponse();
    }
    if (
      !Array.isArray(item.stringValues) ||
      item.stringValues.length > MAX_STRING_VALUES ||
      !item.stringValues.every(
        (entry) => typeof entry === "string" && entry.length <= MAX_TEXT_LENGTH,
      )
    ) {
      return invalidResponse();
    }
    if (
      item.quality !== undefined &&
      item.quality !== "valid" &&
      item.quality !== "projected" &&
      item.quality !== "insufficient"
    ) {
      return invalidResponse();
    }
    return {
      time: timestamp,
      value: hasValue ? (item.value as number) : null,
      stringValues: [...item.stringValues],
      quality:
        item.quality === undefined ? null : displayQuality(item.quality),
    };
  });
}

function normalizeSeries(value: unknown): OwnedAnalyticsSeries[] {
  if (!Array.isArray(value) || value.length > MAX_SERIES) {
    return invalidResponse();
  }
  return value.map((item) => {
    if (!isRecord(item)) return invalidResponse();
    return {
      breakdowns: normalizeBreakdowns(item.breakdowns),
      dataPoints: normalizeDataPoints(item.dataPoints),
    };
  });
}

function normalizeError(value: unknown): OwnedAnalyticsWireError | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) return invalidResponse();
  if (
    value.code !== undefined &&
    (typeof value.code !== "number" || !Number.isInteger(value.code))
  ) {
    return invalidResponse();
  }
  return {
    ...(value.code === undefined ? {} : { code: value.code as number }),
    category: boundedText(value.category),
    message: boundedText(value.message),
  };
}

function viewState(
  status: OwnedAnalyticsWireStatus,
  staleAfter: number,
): OwnedAnalyticsViewState {
  if (
    (status === "available" ||
      status === "projected" ||
      status === "insufficient") &&
    staleAfter <= Date.now()
  ) {
    return "stale";
  }
  return status === "insufficient" ? "insufficient_sample" : status;
}

function assertStatusConsistency(
  status: OwnedAnalyticsWireStatus,
  series: readonly OwnedAnalyticsSeries[],
): void {
  const points = series.flatMap((item) => item.dataPoints);
  if (
    (status === "pending" || status === "no_data" || status === "failed") &&
    points.length !== 0
  ) {
    invalidResponse();
  }
  if (status === "available") {
    if (
      points.length === 0 ||
      points.some(
        (point) =>
          point.quality === "Projected" ||
          point.quality === "NotStatisticallySignificant",
      )
    ) {
      invalidResponse();
    }
  }
  if (
    status === "projected" &&
    !points.some((point) => point.quality === "Projected")
  ) {
    invalidResponse();
  }
  if (
    status === "insufficient" &&
    !points.some(
      (point) => point.quality === "NotStatisticallySignificant",
    )
  ) {
    invalidResponse();
  }
}

function normalizeResponse(
  value: unknown,
  input: OwnedAnalyticsQueryInput,
): OwnedAnalyticsEvidence {
  if (!isRecord(value)) return invalidResponse();
  if (
    value.targetId !== input.targetId ||
    value.metric !== input.range.metric ||
    value.granularity !== input.range.granularity ||
    value.startTime !== input.range.startTime ||
    value.endTime !== input.range.endTime ||
    !isEnumValue(OWNED_ANALYTICS_WIRE_STATUSES, value.status)
  ) {
    return invalidResponse();
  }

  const observedAt = parseTimestamp(value.observedAt);
  const staleAfter = parseTimestamp(value.staleAfter);
  if (staleAfter.milliseconds < observedAt.milliseconds) return invalidResponse();
  const series = normalizeSeries(value.series);
  assertStatusConsistency(value.status, series);
  const error = normalizeError(value.error);
  if ((value.status === "failed") !== (error !== null)) return invalidResponse();

  return {
    receipt: normalizeReceipt(value.receipt),
    targetId: input.targetId,
    universeId: normalizeUniverseId(value.universeId),
    metric: input.range.metric,
    granularity: input.range.granularity,
    startTime: input.range.startTime,
    endTime: input.range.endTime,
    status: value.status,
    viewState: viewState(value.status, staleAfter.milliseconds),
    observedAt: observedAt.text,
    staleAfter: staleAfter.text,
    series,
    error,
  };
}

export async function queryOwnedAnalytics(
  input: OwnedAnalyticsQueryInput,
): Promise<OwnedAnalyticsEvidence> {
  if (!isTauriRuntime()) {
    throw new OwnedAnalyticsClientError(
      "desktop_required",
      "Owned Roblox analytics require RobloxForge Desktop.",
    );
  }
  validateInput(input);
  let response: unknown;
  try {
    response = await invoke<unknown>("query_owned_analytics", {
      targetId: input.targetId,
      range: input.range,
    });
  } catch {
    throw new OwnedAnalyticsClientError(
      "authority_failed",
      "Owned analytics authority request failed.",
    );
  }
  return normalizeResponse(response, input);
}

const NOT_SUPPLIED_READING: OwnedAnalyticsMetricReading = {
  value: null,
  quality: null,
  viewState: "not_supplied",
  observedAt: null,
  sourceMetric: null,
};

function latestPoint(
  evidence: OwnedAnalyticsEvidence,
  seriesPredicate: (series: OwnedAnalyticsSeries) => boolean,
): OwnedAnalyticsDataPoint | null {
  const points = evidence.series
    .filter(seriesPredicate)
    .flatMap((series) => series.dataPoints)
    .slice()
    .sort((left, right) => left.time.localeCompare(right.time));
  return points.length === 0 ? null : points[points.length - 1];
}

function readingFromEvidence(
  evidence: OwnedAnalyticsEvidence,
): OwnedAnalyticsMetricReading {
  const point = latestPoint(
    evidence,
    (series) => series.breakdowns.length === 0,
  );
  return {
    value: point?.value ?? null,
    quality: point?.quality ?? null,
    viewState: evidence.viewState,
    observedAt: point?.time ?? evidence.observedAt,
    sourceMetric: evidence.metric,
  };
}

function normalizeMetrics(
  evidence: readonly OwnedAnalyticsEvidence[],
): OwnedAnalyticsNormalizedMetrics {
  const byMetric = new Map(evidence.map((item) => [item.metric, item]));
  const supplied = (
    metric: OwnedAnalyticsQueryMetric,
  ): OwnedAnalyticsMetricReading => {
    const item = byMetric.get(metric);
    return item === undefined ? NOT_SUPPLIED_READING : readingFromEvidence(item);
  };
  return {
    dau: supplied("DailyActiveUsers"),
    averageSession: NOT_SUPPLIED_READING,
    d1Retention: supplied("ForwardD1Retention"),
    d7Retention: NOT_SUPPLIED_READING,
    d30Retention: NOT_SUPPLIED_READING,
    dailyRevenue: supplied("DailyRevenue"),
    arpu: NOT_SUPPLIED_READING,
    arppu: NOT_SUPPLIED_READING,
    payerConversion: supplied("PayingUsersCVR"),
    concurrency: NOT_SUPPLIED_READING,
    crashRate: NOT_SUPPLIED_READING,
    fps: NOT_SUPPLIED_READING,
    memoryMb: NOT_SUPPLIED_READING,
    cpuPercent: NOT_SUPPLIED_READING,
  };
}

function normalizeItemMonetization(
  evidence: readonly OwnedAnalyticsEvidence[],
): OwnedAnalyticsItemMonetization[] {
  const revenue = evidence.find((item) => item.metric === "DailyRevenue");
  if (revenue === undefined) return [];
  return revenue.series.flatMap((series) => {
    const identity = series.breakdowns.find((breakdown) =>
      /item|product|asset/i.test(breakdown.dimension),
    );
    if (identity === undefined) return [];
    const point = latestPoint(revenue, (candidate) => candidate === series);
    return [
      {
        itemId: identity.value,
        label: identity.displayValue ?? identity.value,
        revenue: {
          value: point?.value ?? null,
          quality: point?.quality ?? null,
          viewState: revenue.viewState,
          observedAt: point?.time ?? revenue.observedAt,
          sourceMetric: "DailyRevenue",
        },
        unitsSold: NOT_SUPPLIED_READING,
      },
    ];
  });
}

export async function queryOwnedAnalyticsPortfolio(
  input: OwnedAnalyticsPortfolioInput,
): Promise<OwnedAnalyticsPortfolio> {
  const metrics = await Promise.all(
    OWNED_ANALYTICS_QUERY_METRICS.map((metric: OwnedAnalyticsQueryMetric) =>
      queryOwnedAnalytics({
        targetId: input.targetId,
        range: {
          metric,
          granularity: input.granularity,
          startTime: input.startTime,
          endTime: input.endTime,
        },
      }),
    ),
  );
  const universeId = metrics[0].universeId;
  if (metrics.some((metric) => metric.universeId !== universeId)) {
    return invalidResponse();
  }
  return {
    targetId: input.targetId,
    universeId,
    granularity: input.granularity,
    startTime: input.startTime,
    endTime: input.endTime,
    metrics,
    normalized: normalizeMetrics(metrics),
    itemMonetization: normalizeItemMonetization(metrics),
  };
}
