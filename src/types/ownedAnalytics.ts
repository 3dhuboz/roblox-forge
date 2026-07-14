import type { OperationReceipt } from "./receipts";

export const OWNED_ANALYTICS_QUERY_METRICS = [
  "DailyActiveUsers",
  "DailyRevenue",
  "ForwardD1Retention",
  "PayingUsersCVR",
] as const;

export const OWNED_ANALYTICS_GRANULARITIES = [
  "OneDay",
  "OneWeek",
  "OneMonth",
  "None",
] as const;

export const OWNED_ANALYTICS_WIRE_STATUSES = [
  "available",
  "pending",
  "no_data",
  "insufficient",
  "projected",
  "stale",
  "failed",
] as const;

export type OwnedAnalyticsQueryMetric =
  (typeof OWNED_ANALYTICS_QUERY_METRICS)[number];
export type OwnedAnalyticsGranularity =
  (typeof OWNED_ANALYTICS_GRANULARITIES)[number];
export type OwnedAnalyticsWireStatus =
  (typeof OWNED_ANALYTICS_WIRE_STATUSES)[number];
export type OwnedAnalyticsViewState =
  | "available"
  | "pending"
  | "no_data"
  | "insufficient_sample"
  | "projected"
  | "stale"
  | "failed";

export type OwnedAnalyticsWireQuality =
  | "valid"
  | "projected"
  | "insufficient";
export type OwnedAnalyticsPointQuality =
  | "Valid"
  | "Projected"
  | "NotStatisticallySignificant";

export interface OwnedAnalyticsQueryRange {
  readonly metric: OwnedAnalyticsQueryMetric;
  readonly granularity: OwnedAnalyticsGranularity;
  readonly startTime: string;
  readonly endTime: string;
}

export interface OwnedAnalyticsQueryInput {
  readonly targetId: string;
  readonly range: OwnedAnalyticsQueryRange;
}

export interface OwnedAnalyticsPortfolioInput {
  readonly targetId: string;
  readonly granularity: OwnedAnalyticsGranularity;
  readonly startTime: string;
  readonly endTime: string;
}

export interface OwnedAnalyticsWireBreakdown {
  readonly dimension: string;
  readonly value: string;
  readonly displayValue?: string;
}

export interface OwnedAnalyticsWireDataPoint {
  readonly time: string;
  readonly value?: number;
  readonly stringValues: string[];
  /** Omitted when Roblox omits point status; absence must not be treated as Valid. */
  readonly quality?: OwnedAnalyticsWireQuality;
}

export interface OwnedAnalyticsWireSeries {
  readonly breakdowns: OwnedAnalyticsWireBreakdown[];
  readonly dataPoints: OwnedAnalyticsWireDataPoint[];
}

export interface OwnedAnalyticsWireError {
  readonly code?: number;
  readonly category: string;
  readonly message: string;
}

export interface OwnedAnalyticsWireResponse {
  readonly receipt: OperationReceipt;
  readonly targetId: string;
  readonly universeId: string;
  readonly metric: OwnedAnalyticsQueryMetric;
  readonly granularity: OwnedAnalyticsGranularity;
  readonly startTime: string;
  readonly endTime: string;
  readonly status: OwnedAnalyticsWireStatus;
  readonly observedAt: string;
  readonly staleAfter: string;
  readonly series: OwnedAnalyticsWireSeries[];
  readonly error?: OwnedAnalyticsWireError;
}

export interface OwnedAnalyticsBreakdown {
  readonly dimension: string;
  readonly value: string;
  readonly displayValue: string | null;
}

export interface OwnedAnalyticsDataPoint {
  readonly time: string;
  readonly value: number | null;
  readonly stringValues: string[];
  /** Null means the authority supplied no point status. */
  readonly quality: OwnedAnalyticsPointQuality | null;
}

export interface OwnedAnalyticsSeries {
  readonly breakdowns: OwnedAnalyticsBreakdown[];
  readonly dataPoints: OwnedAnalyticsDataPoint[];
}

export interface OwnedAnalyticsEvidence {
  readonly receipt: OperationReceipt;
  readonly targetId: string;
  readonly universeId: string;
  readonly metric: OwnedAnalyticsQueryMetric;
  readonly granularity: OwnedAnalyticsGranularity;
  readonly startTime: string;
  readonly endTime: string;
  readonly status: OwnedAnalyticsWireStatus;
  readonly viewState: OwnedAnalyticsViewState;
  readonly observedAt: string;
  readonly staleAfter: string;
  readonly series: OwnedAnalyticsSeries[];
  readonly error: OwnedAnalyticsWireError | null;
}

export type OwnedAnalyticsReadingState =
  | OwnedAnalyticsViewState
  | "not_supplied";

export interface OwnedAnalyticsMetricReading {
  readonly value: number | null;
  readonly quality: OwnedAnalyticsPointQuality | null;
  readonly viewState: OwnedAnalyticsReadingState;
  readonly observedAt: string | null;
  readonly sourceMetric: OwnedAnalyticsQueryMetric | null;
}

export interface OwnedAnalyticsNormalizedMetrics {
  readonly dau: OwnedAnalyticsMetricReading;
  readonly averageSession: OwnedAnalyticsMetricReading;
  readonly d1Retention: OwnedAnalyticsMetricReading;
  readonly d7Retention: OwnedAnalyticsMetricReading;
  readonly d30Retention: OwnedAnalyticsMetricReading;
  readonly dailyRevenue: OwnedAnalyticsMetricReading;
  readonly arpu: OwnedAnalyticsMetricReading;
  readonly arppu: OwnedAnalyticsMetricReading;
  readonly payerConversion: OwnedAnalyticsMetricReading;
  readonly concurrency: OwnedAnalyticsMetricReading;
  readonly crashRate: OwnedAnalyticsMetricReading;
  readonly fps: OwnedAnalyticsMetricReading;
  readonly memoryMb: OwnedAnalyticsMetricReading;
  readonly cpuPercent: OwnedAnalyticsMetricReading;
}

export interface OwnedAnalyticsItemMonetization {
  readonly itemId: string;
  readonly label: string;
  readonly revenue: OwnedAnalyticsMetricReading;
  readonly unitsSold: OwnedAnalyticsMetricReading;
}

export interface OwnedAnalyticsPortfolio {
  readonly targetId: string;
  readonly universeId: string;
  readonly granularity: OwnedAnalyticsGranularity;
  readonly startTime: string;
  readonly endTime: string;
  readonly metrics: OwnedAnalyticsEvidence[];
  readonly normalized: OwnedAnalyticsNormalizedMetrics;
  readonly itemMonetization: OwnedAnalyticsItemMonetization[];
}
