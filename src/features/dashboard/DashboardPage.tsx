import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Clock,
  Database,
  DollarSign,
  Gauge,
  PackageOpen,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { isTauriRuntime } from "../../lib/isTauriRuntime";
import { queryOwnedAnalyticsPortfolio } from "../../services/ownedAnalyticsClient";
import {
  isOperationUnavailableError,
  robloxAuthorityCommands,
} from "../../services/tauriCommands";
import type {
  OwnedAnalyticsMetricReading,
  OwnedAnalyticsPortfolio,
  OwnedAnalyticsReadingState,
} from "../../types/ownedAnalytics";
import type {
  RobloxAuthorityState,
  VerifiedRobloxTarget,
} from "../../types/robloxAuthority";

type DashboardLoadState = "idle" | "loading" | "ready" | "failed";
type AuthorityLoadState = "loading" | "ready" | "unavailable" | "error";
type RangeDays = 7 | 30 | 90;

const DESKTOP_REQUIRED =
  "Owned analytics requires RobloxForge Desktop and a verified analytics key. Browser preview never queries private owner data.";

const READING_STATE_LABELS: Record<OwnedAnalyticsReadingState, string> = {
  available: "Available",
  pending: "Pending",
  no_data: "No data",
  insufficient_sample: "Insufficient sample",
  projected: "Projected",
  stale: "Stale",
  failed: "Failed",
  not_supplied: "Not supplied",
};

function formatRawValue(value: number | null): string {
  return value === null ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function qualityLabel(reading: OwnedAnalyticsMetricReading): string | null {
  switch (reading.quality) {
    case "Valid":
      return "Valid";
    case "Projected":
      return "Projected";
    case "NotStatisticallySignificant":
      return "Not statistically significant";
    case null:
      return null;
  }
}

function statusTone(state: OwnedAnalyticsReadingState): string {
  switch (state) {
    case "available":
      return "border-emerald-800/60 bg-emerald-950/40 text-emerald-300";
    case "projected":
      return "border-sky-800/60 bg-sky-950/40 text-sky-300";
    case "insufficient_sample":
      return "border-amber-800/60 bg-amber-950/40 text-amber-300";
    case "stale":
      return "border-orange-800/60 bg-orange-950/40 text-orange-300";
    case "failed":
      return "border-red-800/60 bg-red-950/40 text-red-300";
    default:
      return "border-gray-700/60 bg-gray-900/60 text-gray-400";
  }
}

function MetricCard({
  icon: Icon,
  label,
  reading,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  reading: OwnedAnalyticsMetricReading;
  testId: string;
}) {
  const quality = qualityLabel(reading);
  const showState =
    reading.viewState !== "available" &&
    !(reading.viewState === "projected" && quality === "Projected");
  return (
    <article
      data-testid={testId}
      className="rounded-2xl border border-gray-800/70 bg-gray-900/70 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300">
            <Icon size={16} />
          </span>
          <span className="text-xs font-semibold text-gray-400">{label}</span>
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-white">
        {formatRawValue(reading.value)}
      </p>
      <div className="mt-2 flex min-h-6 flex-wrap gap-1.5">
        {quality !== null && (
          <span className="rounded-full border border-gray-700 bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-300">
            {quality}
          </span>
        )}
        {showState && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone(reading.viewState)}`}
          >
            {READING_STATE_LABELS[reading.viewState]}
          </span>
        )}
      </div>
    </article>
  );
}

function dateWindow(days: RangeDays): {
  startTime: string;
  endTime: string;
  granularity: "OneDay" | "OneWeek";
} {
  const end = Date.now();
  return {
    startTime: new Date(end - days * 86_400_000).toISOString(),
    endTime: new Date(end).toISOString(),
    granularity: days === 90 ? "OneWeek" : "OneDay",
  };
}

function hasVerifiedAnalyticsKey(
  authority: RobloxAuthorityState | null,
): boolean {
  return Boolean(
    authority?.analyticsCredential.configured &&
      authority.analyticsCredential.verifiedAt &&
      authority.capabilities.ownedAnalytics.ready,
  );
}

function allReadings(portfolio: OwnedAnalyticsPortfolio): OwnedAnalyticsMetricReading[] {
  return Object.values(portfolio.normalized);
}

function portfolioState(portfolio: OwnedAnalyticsPortfolio): OwnedAnalyticsReadingState {
  const states = allReadings(portfolio)
    .map((reading) => reading.viewState)
    .filter((state) => state !== "not_supplied");
  if (states.includes("failed")) return "failed";
  if (states.includes("pending")) return "pending";
  if (states.includes("stale")) return "stale";
  if (states.includes("insufficient_sample")) return "insufficient_sample";
  if (states.includes("projected")) return "projected";
  if (states.length > 0 && states.every((state) => state === "no_data")) {
    return "no_data";
  }
  return "available";
}

function PortfolioStateBanner({ portfolio }: { portfolio: OwnedAnalyticsPortfolio }) {
  const state = portfolioState(portfolio);
  const copy: Record<OwnedAnalyticsReadingState, string> = {
    available: "Authoritative owned analytics are available.",
    pending: "Analytics query pending",
    no_data: "No owned analytics data for this date range",
    insufficient_sample: "Insufficient sample for reliable metrics",
    projected: "Some analytics values are projected",
    stale: "Analytics data is stale",
    failed: "Analytics query failed",
    not_supplied: "Analytics were not supplied",
  };
  if (state === "available") return null;
  return (
    <div
      role={state === "failed" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm ${statusTone(state)}`}
    >
      {copy[state]}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  message,
  role,
}: {
  icon: LucideIcon;
  title: string;
  message: string;
  role?: "alert" | "status";
}) {
  return (
    <div
      role={role}
      className="flex flex-col items-center justify-center gap-4 py-20 text-center"
    >
      <Icon size={32} className="text-gray-600" />
      <div>
        <h2 className="text-lg font-bold text-gray-300">{title}</h2>
        <p className="mt-1 max-w-md text-sm text-gray-500">{message}</p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const desktopAtRender = isTauriRuntime();
  const [authorityState, setAuthorityState] = useState<AuthorityLoadState>(
    desktopAtRender ? "loading" : "unavailable",
  );
  const [authority, setAuthority] = useState<RobloxAuthorityState | null>(null);
  const [authorityError, setAuthorityError] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);
  const [portfolio, setPortfolio] = useState<OwnedAnalyticsPortfolio | null>(null);
  const [loadState, setLoadState] = useState<DashboardLoadState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const authorityAttemptRef = useRef(0);
  const requestGenerationRef = useRef(0);
  const authorityRef = useRef<RobloxAuthorityState | null>(null);
  const authorityStateRef = useRef<AuthorityLoadState>(authorityState);
  const selectedTargetIdRef = useRef(selectedTargetId);

  authorityRef.current = authority;
  authorityStateRef.current = authorityState;
  selectedTargetIdRef.current = selectedTargetId;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      authorityAttemptRef.current += 1;
      requestGenerationRef.current += 1;
    };
  }, []);

  const loadAuthority = useCallback(async () => {
    requestGenerationRef.current += 1;
    setPortfolio(null);
    setLoadError(null);
    setLoadState("idle");
    if (!isTauriRuntime()) {
      setAuthority(null);
      setAuthorityState("unavailable");
      setAuthorityError(null);
      return;
    }

    const attempt = ++authorityAttemptRef.current;
    setAuthorityState("loading");
    setAuthorityError(null);
    try {
      const next = await robloxAuthorityCommands.getState();
      if (
        !mountedRef.current ||
        authorityAttemptRef.current !== attempt
      ) {
        return;
      }
      if (!isTauriRuntime()) {
        setAuthority(null);
        setSelectedTargetId("");
        setAuthorityState("unavailable");
        setAuthorityError(null);
        return;
      }
      setAuthority(next);
      const analyticsTargets = next.targets.filter(
        (target) => target.analyticsCredentialAlias,
      );
      setSelectedTargetId((current) =>
        analyticsTargets.some((target) => target.id === current)
          ? current
          : (analyticsTargets[0]?.id ?? ""),
      );
      setAuthorityState("ready");
    } catch (error) {
      if (!mountedRef.current || authorityAttemptRef.current !== attempt) return;
      setAuthority(null);
      setSelectedTargetId("");
      if (isOperationUnavailableError(error) || !isTauriRuntime()) {
        setAuthorityState("unavailable");
        setAuthorityError(null);
      } else {
        setAuthorityState("error");
        setAuthorityError(
          "RobloxForge Desktop could not read the verified analytics setup.",
        );
      }
    }
  }, []);

  useEffect(() => {
    if (desktopAtRender) void loadAuthority();
  }, [desktopAtRender, loadAuthority]);

  const selectedTarget: VerifiedRobloxTarget | null =
    authority?.targets.find((target) => target.id === selectedTargetId) ?? null;
  const analyticsTargets =
    authority?.targets.filter((target) => target.analyticsCredentialAlias) ?? [];
  const setupReady =
    authorityState === "ready" &&
    hasVerifiedAnalyticsKey(authority) &&
    selectedTarget?.analyticsCredentialAlias !== undefined;

  const runQuery = useCallback(async () => {
    const authoritySnapshot = authorityRef.current;
    const selectedTarget = authoritySnapshot?.targets.find(
      (target) => target.id === selectedTargetIdRef.current,
    );
    if (
      !isTauriRuntime() ||
      authorityStateRef.current !== "ready" ||
      !hasVerifiedAnalyticsKey(authoritySnapshot) ||
      selectedTarget?.analyticsCredentialAlias === undefined
    ) {
      setPortfolio(null);
      setLoadState("failed");
      setLoadError("Choose a verified owned target with analytics access.");
      return;
    }

    const targetId = selectedTarget.id;
    const authorityAttempt = authorityAttemptRef.current;
    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    const ownsRequest = () =>
      mountedRef.current &&
        requestGenerationRef.current === generation &&
        authorityAttemptRef.current === authorityAttempt &&
        selectedTargetIdRef.current === targetId &&
        authorityStateRef.current === "ready" &&
        isTauriRuntime();

    setPortfolio(null);
    setLoadError(null);
    setLoadState("loading");
    try {
      const window = dateWindow(rangeDays);
      const result = await queryOwnedAnalyticsPortfolio({
        targetId,
        ...window,
      });
      if (ownsRequest()) {
        setPortfolio(result);
        setLoadState("ready");
      }
    } catch (error) {
      if (ownsRequest()) {
        setPortfolio(null);
        setLoadState("failed");
        setLoadError(error instanceof Error ? error.message : "Owned analytics query failed.");
      }
    }
  }, [rangeDays]);

  const handleTargetChange = (value: string) => {
    requestGenerationRef.current += 1;
    setSelectedTargetId(value);
    setPortfolio(null);
    setLoadError(null);
    setLoadState("idle");
  };

  const performanceSupplied = useMemo(() => {
    if (portfolio === null) return false;
    const { crashRate, fps, memoryMb, cpuPercent } = portfolio.normalized;
    return [crashRate, fps, memoryMb, cpuPercent].some(
      (reading) => reading.viewState !== "not_supplied",
    );
  }, [portfolio]);

  const authorityContent = (() => {
    if (authorityState === "loading") {
      return (
        <EmptyState
          role="status"
          icon={RefreshCw}
          title="Reading verified analytics setup"
          message="Loading verified keys and owned targets from RobloxForge Desktop."
        />
      );
    }
    if (authorityState === "unavailable") {
      return (
        <EmptyState
          role="alert"
          icon={AlertCircle}
          title="Owned Analytics Need the Desktop App"
          message={DESKTOP_REQUIRED}
        />
      );
    }
    if (authorityState === "error") {
      return (
        <div className="py-16 text-center" role="alert">
          <AlertCircle size={32} className="mx-auto text-red-400" />
          <h2 className="mt-4 text-lg font-bold text-gray-300">Couldn&apos;t verify analytics access</h2>
          <p className="mt-1 text-sm text-gray-500">{authorityError}</p>
          <button
            type="button"
            onClick={() => void loadAuthority()}
            className="mt-4 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white"
          >
            Check again
          </button>
        </div>
      );
    }
    if (!hasVerifiedAnalyticsKey(authority)) {
      return (
        <EmptyState
          role="alert"
          icon={BarChart3}
          title="Verify an analytics key first"
          message="In Settings, add the private analytics API key and confirm the owned analytics capability is ready."
        />
      );
    }
    if (analyticsTargets.length === 0) {
      return (
        <EmptyState
          role="alert"
          icon={ShieldCheck}
          title="Register an analytics-enabled target"
          message="In Settings, register the existing universe and root place with the verified analytics key. Older targets without that key binding must be registered again."
        />
      );
    }
    return null;
  })();

  return (
    <div className="flex h-full flex-col bg-gray-950">
      <header className="flex items-center justify-between border-b border-gray-800/50 px-8 py-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-600/20">
            <BarChart3 size={20} className="text-white" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-white">Owned analytics</h1>
            <p className="text-sm text-gray-400">Private evidence for one verified Roblox target.</p>
          </div>
        </div>
        {portfolio !== null && (
          <button
            type="button"
            onClick={() => void runQuery()}
            className="flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-gray-300"
          >
            <RefreshCw size={14} className={loadState === "loading" ? "animate-spin" : ""} />
            Refresh
          </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-8">
        {authorityContent ?? (
          <div className="mx-auto max-w-6xl space-y-6">
            <section className="rounded-2xl border border-gray-800/70 bg-gray-900/60 p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck size={20} className="mt-0.5 shrink-0 text-emerald-400" />
                <div className="flex-1">
                  <h2 className="font-semibold text-white">Monitor a verified owned target</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    RobloxForge Desktop supplies only analytics-enabled targets already verified in Settings.
                  </p>
                  <form
                    className="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void runQuery();
                    }}
                  >
                    <label className="space-y-1.5 text-xs font-medium text-gray-400">
                      <span>Verified owned target</span>
                      <select
                        aria-label="Verified owned target"
                        value={selectedTargetId}
                        onChange={(event) => handleTargetChange(event.target.value)}
                        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500"
                      >
                        {analyticsTargets.map((target) => (
                          <option key={target.id} value={target.id}>
                            {target.label} · Universe {target.universeId}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1.5 text-xs font-medium text-gray-400">
                      <span>Date range</span>
                      <select
                        aria-label="Date range"
                        value={rangeDays}
                        onChange={(event) => {
                          requestGenerationRef.current += 1;
                          setRangeDays(Number(event.target.value) as RangeDays);
                          setPortfolio(null);
                          setLoadState("idle");
                        }}
                        className="w-full rounded-xl border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-white"
                      >
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                      </select>
                    </label>
                    <button
                      type="submit"
                      disabled={!setupReady || loadState === "loading"}
                      className="self-end rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Load owned analytics
                    </button>
                  </form>
                </div>
              </div>
            </section>

            {loadState === "loading" && (
              <div role="status" className="flex items-center gap-2 rounded-xl border border-indigo-900/50 bg-indigo-950/30 px-4 py-3 text-sm text-indigo-200">
                <RefreshCw size={15} className="animate-spin" />
                Querying private owner analytics…
              </div>
            )}

            {loadState === "failed" && (
              <div role="alert" className="rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                <p className="font-semibold">Analytics query failed</p>
                <p className="mt-1 text-red-300/80">{loadError ?? "No analytics data was substituted."}</p>
              </div>
            )}

            {portfolio !== null && (
              <>
                <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={20} className="text-emerald-400" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-200">Verified owned target</p>
                      <p className="text-xs text-gray-400">Universe {portfolio.universeId}</p>
                    </div>
                  </div>
                  <code className="rounded-lg bg-gray-950/70 px-3 py-1.5 text-xs text-gray-400">
                    {portfolio.targetId}
                  </code>
                </section>

                <PortfolioStateBanner portfolio={portfolio} />

                <section>
                  <h2 className="mb-3 text-sm font-bold text-gray-200">Engagement</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <MetricCard icon={Users} label="DAU" reading={portfolio.normalized.dau} testId="metric-dau" />
                    <MetricCard icon={Clock} label="Average session" reading={portfolio.normalized.averageSession} testId="metric-average-session" />
                    <MetricCard icon={Activity} label="Concurrency" reading={portfolio.normalized.concurrency} testId="metric-concurrency" />
                  </div>
                </section>

                <section>
                  <h2 className="mb-3 text-sm font-bold text-gray-200">Retention</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <MetricCard icon={TrendingUp} label="D1 retention" reading={portfolio.normalized.d1Retention} testId="metric-d1-retention" />
                    <MetricCard icon={TrendingUp} label="D7 retention" reading={portfolio.normalized.d7Retention} testId="metric-d7-retention" />
                    <MetricCard icon={TrendingUp} label="D30 retention" reading={portfolio.normalized.d30Retention} testId="metric-d30-retention" />
                  </div>
                </section>

                <section>
                  <h2 className="mb-3 text-sm font-bold text-gray-200">Monetization</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricCard icon={DollarSign} label="Daily revenue" reading={portfolio.normalized.dailyRevenue} testId="metric-daily-revenue" />
                    <MetricCard icon={DollarSign} label="ARPU" reading={portfolio.normalized.arpu} testId="metric-arpu" />
                    <MetricCard icon={DollarSign} label="ARPPU" reading={portfolio.normalized.arppu} testId="metric-arppu" />
                    <MetricCard icon={Gauge} label="Payer conversion" reading={portfolio.normalized.payerConversion} testId="metric-payer-conversion" />
                  </div>
                </section>

                <section className="rounded-2xl border border-gray-800/70 bg-gray-900/50 p-5">
                  <div className="flex items-center gap-2">
                    <PackageOpen size={17} className="text-indigo-300" />
                    <h2 className="text-sm font-bold text-gray-200">Item monetization</h2>
                  </div>
                  {portfolio.itemMonetization.length === 0 ? (
                    <p className="mt-3 text-sm text-gray-500">No item breakdown was supplied for this query.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {portfolio.itemMonetization.map((item) => (
                        <div key={item.itemId} className="grid gap-3 rounded-xl bg-gray-950/60 p-3 sm:grid-cols-[1fr_160px_160px]">
                          <div>
                            <p className="text-sm font-semibold text-white">{item.label}</p>
                            <p className="text-xs text-gray-600">{item.itemId}</p>
                          </div>
                          <div className="text-sm text-gray-300">
                            <span className="text-xs text-gray-500">Revenue</span>
                            <p>{formatRawValue(item.revenue.value)}</p>
                          </div>
                          <div className="text-sm text-gray-300">
                            <span className="text-xs text-gray-500">Units</span>
                            <p>{formatRawValue(item.unitsSold.value)}</p>
                            {item.unitsSold.viewState === "not_supplied" && <span className="text-[10px] text-gray-500">Not supplied</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {performanceSupplied && (
                  <section>
                    <h2 className="mb-3 text-sm font-bold text-gray-200">Performance</h2>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <MetricCard icon={Activity} label="Crash rate" reading={portfolio.normalized.crashRate} testId="metric-crash-rate" />
                      <MetricCard icon={Gauge} label="FPS" reading={portfolio.normalized.fps} testId="metric-fps" />
                      <MetricCard icon={Database} label="Memory" reading={portfolio.normalized.memoryMb} testId="metric-memory" />
                      <MetricCard icon={Gauge} label="CPU" reading={portfolio.normalized.cpuPercent} testId="metric-cpu" />
                    </div>
                  </section>
                )}

                <p className="rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 text-xs text-gray-500">
                  Raw Roblox values are shown without inferred percentages, currency, or zero-filled gaps. Owner analytics remain private to this dashboard.
                </p>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
