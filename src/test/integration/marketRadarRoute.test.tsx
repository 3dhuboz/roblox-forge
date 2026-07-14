import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import { Layout } from "../../components/Layout";
import { MarketRadarPage } from "../../features/radar/MarketRadarPage";
import {
  MARKET_RADAR_RATIONALE_COPY,
  type MarketRadarSnapshot,
} from "../../intelligence/marketRadar";
import { EXAMPLE_MARKET_RADAR_SNAPSHOT } from "../../intelligence/marketRadarExample";
import { requestMarketRadarSnapshot } from "../../services/marketRadarClient";
import type { MarketRadarLoader } from "../../stores/marketRadarStore";
import { useMarketRadarStore } from "../../stores/marketRadarStore";
import { useUserStore } from "../../stores/userStore";

const initialProfile = useUserStore.getState().profile;

beforeEach(() => {
  useMarketRadarStore.getState().reset();
  useUserStore.setState({
    profile: { ...initialProfile, hasCompletedOnboarding: true },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function expiringSnapshot(nowMs: number): MarketRadarSnapshot {
  return {
    ...EXAMPLE_MARKET_RADAR_SNAPSHOT,
    observedAt: new Date(nowMs - 1_000).toISOString(),
    expiresAt: new Date(nowMs + 1_000).toISOString(),
  };
}

describe("Market Radar navigation and preview", () => {
  it("places Radar immediately after Director in navigation", () => {
    render(
      <MemoryRouter initialEntries={["/radar"]}>
        <Layout>
          <div>Radar route content</div>
        </Layout>
      </MemoryRouter>,
    );

    const links = screen.getAllByRole("link");
    const directorIndex = links.findIndex((link) =>
      link.textContent?.includes("Director"),
    );
    const radarIndex = links.findIndex((link) =>
      link.textContent?.includes("Radar"),
    );
    expect(radarIndex).toBe(directorIndex + 1);
    expect(links[radarIndex]).toHaveAttribute("href", "/radar");
    expect(links[radarIndex]).toHaveAttribute("aria-current", "page");
    expect(links[directorIndex]).not.toHaveAttribute("aria-current");
  });

  it("mounts the lazy route with a clearly isolated 13-archetype example", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(
      <MemoryRouter initialEntries={["/radar"]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Market Radar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Example snapshot — not current market data"),
    ).toBeVisible();
    expect(
      screen.getByText(/No competitor revenue estimates/i),
    ).toBeVisible();
    expect(
      screen.getAllByRole("article", { name: /research archetype/i }),
    ).toHaveLength(13);
    expect(screen.getByText(/30 public experiences/i)).toBeVisible();
    const firstEntry = EXAMPLE_MARKET_RADAR_SNAPSHOT.entries[0];
    expect(
      screen.getByText(
        MARKET_RADAR_RATIONALE_COPY[
          firstEntry.monetizationDesignCompatibility.rationaleToken
        ],
      ),
    ).toBeVisible();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("Market Radar fail-closed states", () => {
  function renderWith(loader: MarketRadarLoader, nowMs = Date.now()) {
    return render(
      <MemoryRouter>
        <MarketRadarPage loader={loader} nowMs={nowMs} />
      </MemoryRouter>,
    );
  }

  it("shows loading without claiming a current snapshot", () => {
    renderWith(() => new Promise(() => undefined));

    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking the configured public-signal source",
    );
    expect(
      screen.queryByRole("heading", { name: "Current market snapshot" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    [async () => ({ kind: "empty" as const }), /No validated current snapshot/i],
    [
      async () => ({ kind: "malformed" as const, message: "bad contract" }),
      /failed the closed radar contract/i,
    ],
    [
      async () => ({ kind: "error" as const, message: "offline" }),
      /could not be loaded/i,
    ],
  ])("renders an explicit non-current state", async (loader, message) => {
    const view = renderWith(loader);

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(
      screen.queryByRole("heading", { name: "Current market snapshot" }),
    ).not.toBeInTheDocument();
    view.unmount();
    useMarketRadarStore.getState().reset();
  });

  it("labels an expired authority snapshot stale and does not claim it is current", async () => {
    renderWith(
      async () => ({
        kind: "ready",
        snapshot: EXAMPLE_MARKET_RADAR_SNAPSHOT,
      }),
      Date.parse("2030-01-01T00:00:00.000Z"),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /expired and is not current/i,
    );
    expect(
      screen.queryByRole("heading", { name: "Current market snapshot" }),
    ).not.toBeInTheDocument();
  });

  it("does not render arbitrary authority rationale copy", async () => {
    const candidate = structuredClone(EXAMPLE_MARKET_RADAR_SNAPSHOT) as Record<
      string,
      unknown
    >;
    const entries = candidate.entries as Array<Record<string, unknown>>;
    const compatibility = entries[0]
      .monetizationDesignCompatibility as Record<string, unknown>;
    compatibility.rationale = "UNSAFE_AUTHORITY_COPY_SENTINEL";
    const loader: MarketRadarLoader = () =>
      requestMarketRadarSnapshot({
        endpoint: "https://radar.example.test/v1/radar/latest",
        getToken: async () => "private-token",
        fetcher: async () =>
          new Response(JSON.stringify(candidate), { status: 200 }),
      });

    renderWith(loader);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /failed the closed radar contract/i,
    );
    expect(
      screen.queryByText("UNSAFE_AUTHORITY_COPY_SENTINEL"),
    ).not.toBeInTheDocument();
  });

  it("expires a current snapshot when its freshness timer elapses", async () => {
    const nowMs = Date.parse("2026-07-14T10:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(nowMs);
    const snapshot = expiringSnapshot(nowMs);
    renderWith(async () => ({ kind: "ready", snapshot }), nowMs);
    await act(async () => Promise.resolve());
    expect(
      screen.getByRole("heading", { name: "Current market snapshot" }),
    ).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1_001);
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      /expired and is not current/i,
    );
    expect(
      screen.queryByRole("heading", { name: "Current market snapshot" }),
    ).not.toBeInTheDocument();
  });

  it.each(["focus", "visibilitychange"] as const)(
    "rechecks expiry when the window receives %s",
    async (eventName) => {
      const nowMs = Date.parse("2026-07-14T10:00:00.000Z");
      vi.useFakeTimers();
      vi.setSystemTime(nowMs);
      const snapshot = expiringSnapshot(nowMs);
      renderWith(async () => ({ kind: "ready", snapshot }), nowMs);
      await act(async () => Promise.resolve());
      expect(
        screen.getByRole("heading", { name: "Current market snapshot" }),
      ).toBeInTheDocument();

      vi.setSystemTime(nowMs + 2_000);
      if (eventName === "visibilitychange") {
        vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
      }
      act(() => {
        const target = eventName === "focus" ? window : document;
        target.dispatchEvent(new Event(eventName));
      });

      expect(screen.getByRole("alert")).toHaveTextContent(
        /expired and is not current/i,
      );
    },
  );
});
