import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OwnedAnalyticsClientError,
  queryOwnedAnalytics,
  queryOwnedAnalyticsPortfolio,
} from "./ownedAnalyticsClient";
import type {
  OwnedAnalyticsQueryRange,
  OwnedAnalyticsWireResponse,
} from "../types/ownedAnalytics";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const targetId = "0f65be3e-3771-4a3f-98be-e5af7cfcf8b6";
const baseRange: OwnedAnalyticsQueryRange = {
  metric: "DailyActiveUsers",
  granularity: "OneDay",
  startTime: "2026-07-01T00:00:00.000Z",
  endTime: "2026-07-15T00:00:00.000Z",
};

function receipt(state: "succeeded" | "failed" = "succeeded") {
  return {
    operationId: "c6bc51ee-bc31-4315-b8d9-9934ee81e47d",
    correlationId: "analytics-test-1",
    operation: "query_owned_analytics",
    state,
    authoritative: true,
    startedAt: "2026-07-15T00:00:00.000Z",
    finishedAt: "2026-07-15T00:00:01.000Z",
    message: state === "succeeded" ? "Analytics query completed." : "Analytics query failed.",
    diagnostics: [],
    retrySafety: "safe" as const,
  };
}

function response(
  overrides: Partial<OwnedAnalyticsWireResponse> = {},
): OwnedAnalyticsWireResponse {
  return {
    receipt: receipt(),
    targetId,
    universeId: "94712001",
    metric: baseRange.metric,
    granularity: baseRange.granularity,
    startTime: baseRange.startTime,
    endTime: baseRange.endTime,
    status: "available",
    observedAt: "2026-07-15T00:00:01.000Z",
    staleAfter: "2099-07-16T00:00:01.000Z",
    series: [
      {
        breakdowns: [],
        dataPoints: [
          {
            time: "2026-07-14T00:00:00.000Z",
            value: 24,
            stringValues: [],
            quality: "valid",
          },
        ],
      },
    ],
    ...overrides,
  };
}

function clearTauriRuntime(): void {
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
}

function enableTauriRuntime(): void {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
}

beforeEach(() => {
  clearTauriRuntime();
  invokeMock.mockReset();
});

afterEach(() => {
  clearTauriRuntime();
  vi.restoreAllMocks();
});

describe("owned analytics client", () => {
  it("requires Desktop and makes zero browser calls", async () => {
    const error = await queryOwnedAnalytics({ targetId, range: baseRange }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(OwnedAnalyticsClientError);
    expect((error as OwnedAnalyticsClientError).code).toBe("desktop_required");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("invokes the exact verified-target command and normalizes authority evidence", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce(
      response({ universeId: "18446744073709551615" }),
    );

    const result = await queryOwnedAnalytics({ targetId, range: baseRange });

    expect(invokeMock).toHaveBeenCalledWith("query_owned_analytics", {
      targetId,
      range: baseRange,
    });
    expect(result.targetId).toBe(targetId);
    expect(result.universeId).toBe("18446744073709551615");
    expect(result.status).toBe("available");
    expect(result.series[0].dataPoints[0]).toEqual({
      time: "2026-07-14T00:00:00.000Z",
      value: 24,
      stringValues: [],
      quality: "Valid",
    });
  });

  it("preserves omitted quality distinctly from explicit Valid without inferring either", async () => {
    enableTauriRuntime();
    invokeMock.mockResolvedValueOnce(
      response({
        status: "insufficient",
        series: [
          {
            breakdowns: [],
            dataPoints: [
              {
                time: "2026-07-11T00:00:00.000Z",
                value: 0,
                stringValues: [],
                quality: "valid",
              },
              {
                time: "2026-07-12T00:00:00.000Z",
                stringValues: [],
              },
              {
                time: "2026-07-13T00:00:00.000Z",
                value: 7,
                stringValues: [],
                quality: "projected",
              },
              {
                time: "2026-07-14T00:00:00.000Z",
                value: 2,
                stringValues: [],
                quality: "insufficient",
              },
            ],
          },
        ],
      }),
    );

    const result = await queryOwnedAnalytics({ targetId, range: baseRange });
    const points = result.series[0].dataPoints;

    expect(result.status).toBe("insufficient");
    expect(points[0].value).toBe(0);
    expect(points[0].quality).toBe("Valid");
    expect(points[1].value).toBeNull();
    expect(points[1].quality).toBeNull();
    expect(points[2].quality).toBe("Projected");
    expect(points[3].quality).toBe("NotStatisticallySignificant");
  });

  it("keeps omitted point quality absent in the normalized metric reading", async () => {
    enableTauriRuntime();
    invokeMock.mockImplementation(
      (_command: string, args: { range: OwnedAnalyticsQueryRange }) =>
        Promise.resolve(
          response({
            metric: args.range.metric,
            granularity: args.range.granularity,
            startTime: args.range.startTime,
            endTime: args.range.endTime,
            series: [
              {
                breakdowns: [],
                dataPoints: [
                  {
                    time: "2026-07-14T00:00:00.000Z",
                    value: 24,
                    stringValues: [],
                  },
                ],
              },
            ],
          }),
        ),
    );

    const result = await queryOwnedAnalyticsPortfolio({
      targetId,
      granularity: "OneDay",
      startTime: baseRange.startTime,
      endTime: baseRange.endTime,
    });

    expect(result.metrics[0].series[0].dataPoints[0].quality).toBeNull();
    expect(result.normalized.dau).toMatchObject({
      value: 24,
      quality: null,
      viewState: "available",
    });
  });

  it("preserves pending, no-data, projected, stale, and failed states", async () => {
    enableTauriRuntime();
    for (const status of [
      "pending",
      "no_data",
      "projected",
      "stale",
      "failed",
    ] as const) {
      invokeMock.mockResolvedValueOnce(
        response({
          status,
          series:
            status === "no_data" || status === "pending" || status === "failed"
              ? []
              : status === "projected"
                ? [
                    {
                      breakdowns: [],
                      dataPoints: [
                        {
                          time: "2026-07-14T00:00:00.000Z",
                          value: 24,
                          stringValues: [],
                          quality: "projected",
                        },
                      ],
                    },
                  ]
                : response().series,
          ...(status === "failed"
            ? {
                receipt: receipt("failed"),
                error: {
                  category: "authority_unavailable",
                  message: "Owned analytics could not be queried.",
                },
              }
            : {}),
        }),
      );

      await expect(
        queryOwnedAnalytics({ targetId, range: baseRange }),
      ).resolves.toMatchObject({ status });
    }
  });

  it("rejects mismatched targets, ranges, non-authoritative receipts, and malformed values", async () => {
    enableTauriRuntime();
    const invalidResponses = [
      response({ targetId: "different-target" }),
      response({ metric: "DailyRevenue" }),
      response({ receipt: { ...receipt(), authoritative: false } }),
      response({ universeId: 9_471_200_1 as unknown as string }),
      response({
        series: [
          {
            breakdowns: [],
            dataPoints: [
              {
                time: "2026-07-14T00:00:00.000Z",
                value: Number.NaN,
                stringValues: [],
                quality: "valid",
              },
            ],
          },
        ],
      }),
    ];

    for (const invalid of invalidResponses) {
      invokeMock.mockResolvedValueOnce(invalid);
      const error = await queryOwnedAnalytics({ targetId, range: baseRange }).catch(
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(OwnedAnalyticsClientError);
      expect((error as OwnedAnalyticsClientError).code).toBe("invalid_response");
    }
  });

  it("loads the bounded supported portfolio without inventing unsupported metrics", async () => {
    enableTauriRuntime();
    invokeMock.mockImplementation(
      (_command: string, args: { range: OwnedAnalyticsQueryRange }) =>
        Promise.resolve(
          response({
            metric: args.range.metric,
            granularity: args.range.granularity,
            startTime: args.range.startTime,
            endTime: args.range.endTime,
          }),
        ),
    );

    const result = await queryOwnedAnalyticsPortfolio({
      targetId,
      granularity: "OneDay",
      startTime: baseRange.startTime,
      endTime: baseRange.endTime,
    });

    expect(invokeMock).toHaveBeenCalledTimes(4);
    expect(result.targetId).toBe(targetId);
    expect(result.universeId).toBe("94712001");
    expect(result.metrics.map((metric) => metric.metric)).toEqual([
      "DailyActiveUsers",
      "DailyRevenue",
      "ForwardD1Retention",
      "PayingUsersCVR",
    ]);
    expect(result.normalized.dau).toMatchObject({
      value: 24,
      quality: "Valid",
      viewState: "available",
    });
    expect(result.normalized.averageSession).toEqual({
      value: null,
      quality: null,
      viewState: "not_supplied",
      observedAt: null,
      sourceMetric: null,
    });
    expect(result.normalized.d7Retention.value).toBeNull();
    expect(result.normalized.arpu.value).toBeNull();
    expect(result.normalized.crashRate.value).toBeNull();
  });
});
