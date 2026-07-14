import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { robloxAuthorityCommands } from "../../services/tauriCommands";
import type {
  OwnedAnalyticsMetricReading,
  OwnedAnalyticsNormalizedMetrics,
  OwnedAnalyticsPortfolio,
} from "../../types/ownedAnalytics";
import type {
  CapabilityDetail,
  RobloxAuthorityState,
  VerifiedRobloxTarget,
} from "../../types/robloxAuthority";
import { DashboardPage } from "./DashboardPage";

const { queryPortfolioMock } = vi.hoisted(() => ({
  queryPortfolioMock: vi.fn(),
}));

vi.mock("../../services/ownedAnalyticsClient", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../services/ownedAnalyticsClient")
  >();
  return { ...actual, queryOwnedAnalyticsPortfolio: queryPortfolioMock };
});

const targetAId = "0f65be3e-3771-4a3f-98be-e5af7cfcf8b6";
const targetBId = "92fbdf4c-95aa-4efd-b4fb-ce2c78aa1219";

function capability(
  state: CapabilityDetail["state"],
  reason = "Ready.",
): CapabilityDetail {
  return {
    state,
    ready: state === "ready",
    requiredScopes: [],
    reason,
  };
}

function target(
  id: string,
  label: string,
  universeId: string,
  analyticsCredentialAlias: string | null = "roblox-analytics",
): VerifiedRobloxTarget {
  return {
    id,
    label,
    universeId,
    rootPlaceId: `${universeId}1`,
    publishCredentialAlias: "roblox-publish",
    ...(analyticsCredentialAlias === null ? {} : { analyticsCredentialAlias }),
    verifiedAt: "2026-07-15T00:00:00.000Z",
    gameUrl: `https://www.roblox.com/games/${universeId}1`,
  };
}

const targetA = target(targetAId, "Obby Alpha", "94712001");
const targetB = target(targetBId, "Monster Run", "94712002");

function authority(
  overrides: Partial<RobloxAuthorityState> = {},
): RobloxAuthorityState {
  return {
    publishCredential: {
      purpose: "publish",
      configured: true,
      alias: "roblox-publish",
      verifiedAt: "2026-07-15T00:00:00.000Z",
    },
    analyticsCredential: {
      purpose: "analytics",
      configured: true,
      alias: "roblox-analytics",
      verifiedAt: "2026-07-15T00:00:00.000Z",
    },
    targets: [targetA, targetB],
    capabilities: {
      authMode: "api_key",
      createUniverse: capability("unsupported"),
      publishExistingPlace: capability("ready"),
      updatePlaceMetadata: capability("ready"),
      ownedAnalytics: capability("ready"),
    },
    createUniverseSupported: false,
    ...overrides,
  };
}

function reading(
  overrides: Partial<OwnedAnalyticsMetricReading> = {},
): OwnedAnalyticsMetricReading {
  return {
    value: null,
    quality: null,
    viewState: "not_supplied",
    observedAt: null,
    sourceMetric: null,
    ...overrides,
  };
}

function normalized(
  overrides: Partial<OwnedAnalyticsNormalizedMetrics> = {},
): OwnedAnalyticsNormalizedMetrics {
  return {
    dau: reading(),
    averageSession: reading(),
    d1Retention: reading(),
    d7Retention: reading(),
    d30Retention: reading(),
    dailyRevenue: reading(),
    arpu: reading(),
    arppu: reading(),
    payerConversion: reading(),
    concurrency: reading(),
    crashRate: reading(),
    fps: reading(),
    memoryMb: reading(),
    cpuPercent: reading(),
    ...overrides,
  };
}

function portfolio(
  universeId: string,
  overrides: Partial<OwnedAnalyticsPortfolio> = {},
): OwnedAnalyticsPortfolio {
  return {
    targetId: targetAId,
    universeId,
    granularity: "OneDay",
    startTime: "2026-07-01T00:00:00.000Z",
    endTime: "2026-07-15T00:00:00.000Z",
    metrics: [],
    normalized: normalized(),
    itemMonetization: [],
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function enableTauriRuntime(): void {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
}

function clearTauriRuntime(): void {
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
}

function serveAuthority(value = authority()): void {
  vi.spyOn(robloxAuthorityCommands, "getState").mockResolvedValue(value);
}

async function loadSelectedTarget(): Promise<void> {
  await screen.findByLabelText("Verified owned target");
  fireEvent.click(screen.getByRole("button", { name: "Load owned analytics" }));
  await waitFor(() => expect(queryPortfolioMock).toHaveBeenCalled());
}

beforeEach(() => {
  clearTauriRuntime();
  queryPortfolioMock.mockReset();
});

afterEach(() => {
  clearTauriRuntime();
  vi.restoreAllMocks();
});

describe("DashboardPage owned analytics", () => {
  it("fails closed on a direct browser route with zero authority or analytics calls", () => {
    const getState = vi.spyOn(robloxAuthorityCommands, "getState");

    render(<DashboardPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /Owned analytics requires RobloxForge Desktop/i,
    );
    expect(getState).not.toHaveBeenCalled();
    expect(queryPortfolioMock).not.toHaveBeenCalled();
  });

  it("requires an analytics-enabled verified target and never accepts a raw ID", async () => {
    enableTauriRuntime();
    serveAuthority(
      authority({
        targets: [target(targetAId, "Publish-only target", "94712001", null)],
      }),
    );
    render(<DashboardPage />);

    expect(await screen.findByText("Register an analytics-enabled target")).toBeVisible();
    expect(screen.queryByLabelText("Verified owned target")).not.toBeInTheDocument();
    expect(queryPortfolioMock).not.toHaveBeenCalled();
  });

  it("lets only the latest selected verified target own dashboard data", async () => {
    enableTauriRuntime();
    serveAuthority();
    const first = deferred<OwnedAnalyticsPortfolio>();
    const second = deferred<OwnedAnalyticsPortfolio>();
    queryPortfolioMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    render(<DashboardPage />);

    await loadSelectedTarget();
    fireEvent.change(screen.getByLabelText("Verified owned target"), {
      target: { value: targetBId },
    });
    fireEvent.click(screen.getByRole("button", { name: "Load owned analytics" }));
    await waitFor(() => expect(queryPortfolioMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      first.resolve(portfolio("111111"));
      await first.promise;
    });
    expect(screen.queryByText(/111111/)).not.toBeInTheDocument();

    await act(async () => {
      second.resolve(portfolio("222222", { targetId: targetBId }));
      await second.promise;
    });
    expect(await screen.findByText(/222222/)).toBeVisible();
    expect(screen.queryByText(/111111/)).not.toBeInTheDocument();
  });

  it("keeps missing, zero, projected, insignificant, and stale readings distinct", async () => {
    enableTauriRuntime();
    serveAuthority();
    queryPortfolioMock.mockResolvedValueOnce(
      portfolio("94712001", {
        normalized: normalized({
          dau: reading({
            value: null,
            quality: "Valid",
            viewState: "available",
            sourceMetric: "DailyActiveUsers",
          }),
          dailyRevenue: reading({
            value: 0,
            quality: "Valid",
            viewState: "available",
            sourceMetric: "DailyRevenue",
          }),
          d7Retention: reading({
            value: 12,
            quality: "Projected",
            viewState: "projected",
          }),
          d30Retention: reading({
            value: 4,
            quality: "NotStatisticallySignificant",
            viewState: "insufficient_sample",
          }),
          concurrency: reading({ value: 5, quality: "Valid", viewState: "stale" }),
        }),
      }),
    );
    render(<DashboardPage />);
    await loadSelectedTarget();

    expect(
      await screen.findByText("Verified owned target", { selector: "p" }),
    ).toBeVisible();
    expect(within(screen.getByTestId("metric-dau")).getByText("—")).toBeVisible();
    expect(within(screen.getByTestId("metric-daily-revenue")).getByText("0")).toBeVisible();
    expect(screen.getAllByText("Projected").length).toBeGreaterThan(0);
    expect(screen.getByText("Not statistically significant")).toBeVisible();
    expect(screen.getAllByText("Stale").length).toBeGreaterThan(0);
    expect(screen.getByText(/Raw Roblox values/i)).toBeVisible();
  });

  it("renders item monetization and performance only when supplied", async () => {
    enableTauriRuntime();
    serveAuthority();
    queryPortfolioMock.mockResolvedValueOnce(
      portfolio("94712001", {
        normalized: normalized({
          crashRate: reading({ value: 1.5, quality: "Valid", viewState: "available" }),
          fps: reading({ value: 58, quality: "Valid", viewState: "available" }),
          memoryMb: reading({ value: 420, quality: "Projected", viewState: "projected" }),
          cpuPercent: reading({ value: null, quality: "Valid", viewState: "available" }),
        }),
        itemMonetization: [
          {
            itemId: "product-17",
            label: "Trail Pack",
            revenue: reading({
              value: 35,
              quality: "Valid",
              viewState: "available",
              sourceMetric: "DailyRevenue",
            }),
            unitsSold: reading(),
          },
        ],
      }),
    );
    render(<DashboardPage />);
    await loadSelectedTarget();

    expect(await screen.findByRole("heading", { name: "Performance" })).toBeVisible();
    expect(screen.getByText("58")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Item monetization" })).toBeVisible();
    expect(screen.getByText("Trail Pack")).toBeVisible();
    expect(screen.getAllByText("Not supplied", { selector: "span" }).length).toBeGreaterThan(0);
  });

  it("renders pending states without zero-filled cards", async () => {
    enableTauriRuntime();
    serveAuthority();
    queryPortfolioMock.mockResolvedValueOnce(
      portfolio("94712001", {
        normalized: normalized({
          dau: reading({
            value: null,
            quality: null,
            viewState: "pending",
            sourceMetric: "DailyActiveUsers",
          }),
        }),
      }),
    );
    render(<DashboardPage />);
    await loadSelectedTarget();

    expect(await screen.findByText("Analytics query pending")).toBeVisible();
    expect(within(screen.getByTestId("metric-dau")).getByText("—")).toBeVisible();
    expect(within(screen.getByTestId("metric-dau")).queryByText("0")).not.toBeInTheDocument();
  });
});
