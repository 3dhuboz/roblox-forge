import { beforeEach, describe, expect, it } from "vitest";
import type { MarketRadarClientResult } from "../services/marketRadarClient";
import { EXAMPLE_MARKET_RADAR_SNAPSHOT } from "../intelligence/marketRadarExample";
import { useMarketRadarStore } from "./marketRadarStore";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

beforeEach(() => {
  useMarketRadarStore.getState().reset();
});

describe("Market Radar store", () => {
  it("lets only the latest request own state", async () => {
    const first = deferred<MarketRadarClientResult>();
    const second = deferred<MarketRadarClientResult>();
    const firstLoad = useMarketRadarStore
      .getState()
      .loadLatest(() => first.promise, Date.parse("2026-07-14T10:00:00.000Z"));
    const secondLoad = useMarketRadarStore
      .getState()
      .loadLatest(() => second.promise, Date.parse("2026-07-14T10:00:00.000Z"));

    second.resolve({ kind: "ready", snapshot: EXAMPLE_MARKET_RADAR_SNAPSHOT });
    await secondLoad;
    first.resolve({ kind: "error", message: "late failure" });
    await firstLoad;

    expect(useMarketRadarStore.getState()).toMatchObject({
      status: "ready",
      snapshot: EXAMPLE_MARKET_RADAR_SNAPSHOT,
      error: null,
    });
  });

  it("marks an expired validated snapshot stale", async () => {
    await useMarketRadarStore.getState().loadLatest(
      async () => ({
        kind: "ready",
        snapshot: EXAMPLE_MARKET_RADAR_SNAPSHOT,
      }),
      Date.parse("2030-01-01T00:00:00.000Z"),
    );

    expect(useMarketRadarStore.getState()).toMatchObject({
      status: "stale",
      snapshot: EXAMPLE_MARKET_RADAR_SNAPSHOT,
    });
  });

  it("rechecks freshness and never promotes a stale snapshot back to current", async () => {
    await useMarketRadarStore.getState().loadLatest(
      async () => ({
        kind: "ready",
        snapshot: EXAMPLE_MARKET_RADAR_SNAPSHOT,
      }),
      Date.parse("2026-07-14T10:00:00.000Z"),
    );
    expect(useMarketRadarStore.getState().status).toBe("ready");

    useMarketRadarStore
      .getState()
      .recheckFreshness(Date.parse("2026-07-16T00:00:00.000Z"));
    expect(useMarketRadarStore.getState().status).toBe("stale");

    useMarketRadarStore
      .getState()
      .recheckFreshness(Date.parse("2026-07-14T10:00:00.000Z"));
    expect(useMarketRadarStore.getState().status).toBe("stale");
  });

  it.each([
    [{ kind: "empty" } as const, "empty"],
    [{ kind: "malformed", message: "invalid contract" } as const, "malformed"],
    [{ kind: "error", message: "offline" } as const, "error"],
    [
      {
        kind: "unavailable",
        reason: "authority_not_supplied",
        message: "not configured",
      } as const,
      "unavailable",
    ],
  ])("fails closed for %s", async (result, expectedStatus) => {
    await useMarketRadarStore
      .getState()
      .loadLatest(async () => result, Date.parse("2026-07-14T10:00:00.000Z"));

    expect(useMarketRadarStore.getState()).toMatchObject({
      status: expectedStatus,
      snapshot: null,
    });
  });
});
