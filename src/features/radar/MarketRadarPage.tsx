import { useEffect, useRef } from "react";
import {
  Activity,
  CalendarClock,
  Gauge,
  Radar,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type {
  MarketRadarEntry,
  MarketRadarSnapshot,
} from "../../intelligence/marketRadar";
import { MARKET_RADAR_RATIONALE_COPY } from "../../intelligence/marketRadar";
import { EXAMPLE_MARKET_RADAR_SNAPSHOT } from "../../intelligence/marketRadarExample";
import {
  useMarketRadarStore,
  type MarketRadarLoader,
  type MarketRadarStatus,
} from "../../stores/marketRadarStore";

const ARCHETYPE_LABELS: Record<MarketRadarEntry["archetype"], string> = {
  one_input_incremental: "One-input incremental",
  life_roleplay_toybox: "Life-roleplay toybox",
  pet_collection_economy: "Pet collection economy",
  scarcity_social_risk_tycoon: "Scarcity and social-risk tycoon",
  cooperative_survival_expedition: "Co-op survival expedition",
  asymmetric_round_survival: "Asymmetric round survival",
  arena_combat: "Arena combat",
  action_rpg: "Action RPG",
  fishing_collection: "Fishing collection",
  fashion_avatar_expression: "Fashion and avatar expression",
  social_performance_sandbox: "Social performance sandbox",
  roster_strategy: "Roster strategy",
  hide_and_seek: "Hide and seek",
};

function readable(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/^./, (letter: string) => letter.toUpperCase());
}

function RadarCard({ entry }: { entry: MarketRadarEntry }) {
  return (
    <article
      aria-label={`${ARCHETYPE_LABELS[entry.archetype]} research archetype`}
      className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5 shadow-lg shadow-black/10"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-300">
            Archetype
          </p>
          <h3 className="mt-1 text-base font-bold text-white">
            {ARCHETYPE_LABELS[entry.archetype]}
          </h3>
        </div>
        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
          {readable(entry.evidenceStrength)} evidence
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl bg-gray-950/70 p-3">
          <dt className="flex items-center gap-1.5 text-gray-500">
            <Gauge size={13} /> Momentum
          </dt>
          <dd className="mt-1 font-semibold text-gray-200">
            {readable(entry.momentum)}
          </dd>
        </div>
        <div className="rounded-xl bg-gray-950/70 p-3">
          <dt className="flex items-center gap-1.5 text-gray-500">
            <CalendarClock size={13} /> Live-ops cadence
          </dt>
          <dd className="mt-1 font-semibold text-gray-200">
            {readable(entry.liveOpsCadence)}
          </dd>
        </div>
        <div className="rounded-xl bg-gray-950/70 p-3">
          <dt className="flex items-center gap-1.5 text-gray-500">
            <Users size={13} /> Social orientation
          </dt>
          <dd className="mt-1 font-semibold text-gray-200">
            {readable(entry.socialOrientation)}
          </dd>
        </div>
        <div className="rounded-xl bg-gray-950/70 p-3">
          <dt className="flex items-center gap-1.5 text-gray-500">
            <Activity size={13} /> Evidence strength
          </dt>
          <dd className="mt-1 font-semibold text-gray-200">
            {readable(entry.evidenceStrength)}
          </dd>
        </div>
      </dl>

      <div className="mt-3 rounded-xl border border-purple-500/15 bg-purple-500/5 p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-300">
          <Sparkles size={13} /> Monetization fit — design compatibility only
        </p>
        <p className="mt-1 text-xs font-medium text-gray-300">
          {readable(entry.monetizationDesignCompatibility.category)} ·{" "}
          {readable(entry.monetizationDesignCompatibility.strength)}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-gray-500">
          {
            MARKET_RADAR_RATIONALE_COPY[
              entry.monetizationDesignCompatibility.rationaleToken
            ]
          }
        </p>
      </div>
    </article>
  );
}

function SnapshotGrid({ snapshot }: { snapshot: MarketRadarSnapshot }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {snapshot.entries.map((entry) => (
        <RadarCard key={entry.archetype} entry={entry} />
      ))}
    </div>
  );
}

function LiveRadarState({
  status,
  snapshot,
  error,
}: {
  status: MarketRadarStatus;
  snapshot: MarketRadarSnapshot | null;
  error: string | null;
}) {
  if (status === "idle" || status === "loading") {
    return (
      <div role="status" className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 text-sm text-gray-400">
        Checking the configured public-signal source…
      </div>
    );
  }
  if (status === "ready" && snapshot) {
    return (
      <section aria-labelledby="current-radar-heading" className="space-y-4">
        <div>
          <h2 id="current-radar-heading" className="text-lg font-bold text-white">
            Current market snapshot
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Observed {new Date(snapshot.observedAt).toLocaleString()}
          </p>
        </div>
        <SnapshotGrid snapshot={snapshot} />
      </section>
    );
  }

  const message =
    status === "stale"
      ? "The configured snapshot has expired and is not current."
      : status === "empty"
        ? "No validated current snapshot is available."
        : status === "malformed"
          ? "The authority response failed the closed radar contract."
          : status === "error"
            ? "Live public-signal data could not be loaded."
            : "Live Market Radar is not configured for this private preview.";
  return (
    <div role="alert" className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      <p className="text-sm font-semibold text-amber-300">{message}</p>
      {error ? <p className="mt-1 text-xs text-gray-500">{error}</p> : null}
    </div>
  );
}

export interface MarketRadarPageProps {
  readonly loader?: MarketRadarLoader;
  readonly nowMs?: number;
}

export function MarketRadarPage({ loader, nowMs }: MarketRadarPageProps) {
  const status = useMarketRadarStore((state) => state.status);
  const snapshot = useMarketRadarStore((state) => state.snapshot);
  const error = useMarketRadarStore((state) => state.error);
  const loadLatest = useMarketRadarStore((state) => state.loadLatest);
  const recheckFreshness = useMarketRadarStore(
    (state) => state.recheckFreshness,
  );
  const nowRef = useRef(nowMs ?? Date.now());

  useEffect(() => {
    void loadLatest(loader, nowRef.current);
  }, [loadLatest, loader]);

  useEffect(() => {
    if (status !== "ready" || snapshot === null) return;

    const expiresAt = Date.parse(snapshot.expiresAt);
    let timeoutId: number | undefined;
    let cancelled = false;
    const scheduleExpiryCheck = () => {
      if (cancelled) return;
      const remainingMs = expiresAt - Date.now();
      if (remainingMs <= 0) {
        recheckFreshness();
        return;
      }
      timeoutId = window.setTimeout(
        scheduleExpiryCheck,
        Math.min(remainingMs, 2_147_483_647),
      );
    };
    scheduleExpiryCheck();

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [recheckFreshness, snapshot, status]);

  useEffect(() => {
    const handleFocus = () => recheckFreshness();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") recheckFreshness();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [recheckFreshness]);

  return (
    <section className="h-full overflow-y-auto bg-gray-950">
      <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-indigo-300">
              <Radar size={15} /> Private research workspace
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
              Market Radar
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
              Compare public, aggregate design signals without copying games or
              pretending public popularity reveals private business results.
            </p>
          </div>
          <div className="max-w-xl rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-indigo-200">
              <ShieldCheck size={16} /> Public-signal boundary
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              Public aggregate signals only. No competitor revenue estimates.
              Monetization fit means design compatibility, not revenue
              performance.
            </p>
          </div>
        </header>

        <LiveRadarState status={status} snapshot={snapshot} error={error} />

        <section aria-labelledby="example-radar-heading" className="space-y-5">
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
            <p className="text-sm font-bold text-cyan-200">
              Example snapshot — not current market data
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              Rights-safe aggregate context distilled into 13 reusable
              archetypes from a research basis of 30 public experiences. It
              contains no competitor names, links, or platform identifiers.
            </p>
          </div>
          <div>
            <h2 id="example-radar-heading" className="text-xl font-bold text-white">
              Aggregate pattern library
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Use these patterns as design context, then create an original
              game loop, look, progression, and economy.
            </p>
          </div>
          <SnapshotGrid snapshot={EXAMPLE_MARKET_RADAR_SNAPSHOT} />
        </section>
      </div>
    </section>
  );
}
