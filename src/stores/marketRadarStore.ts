import { create } from "zustand";
import type { MarketRadarSnapshot } from "../intelligence/marketRadar";
import {
  requestMarketRadarSnapshot,
  type MarketRadarClientResult,
} from "../services/marketRadarClient";

export type MarketRadarStatus =
  | "idle"
  | "loading"
  | "ready"
  | "stale"
  | "empty"
  | "unavailable"
  | "malformed"
  | "error";

export type MarketRadarLoader = () => Promise<MarketRadarClientResult>;

interface MarketRadarStore {
  status: MarketRadarStatus;
  snapshot: MarketRadarSnapshot | null;
  error: string | null;
  activeRequestId: number | null;
  loadLatest: (loader?: MarketRadarLoader, nowMs?: number) => Promise<void>;
  recheckFreshness: (nowMs?: number) => void;
  reset: () => void;
}

const initialState = {
  status: "idle" as const,
  snapshot: null,
  error: null,
  activeRequestId: null,
};

let requestSequence = 0;

export const useMarketRadarStore = create<MarketRadarStore>((set, get) => ({
  ...initialState,
  loadLatest: async (
    loader = requestMarketRadarSnapshot,
    nowMs = Date.now(),
  ) => {
    requestSequence += 1;
    const requestId = requestSequence;
    set({
      status: "loading",
      snapshot: null,
      error: null,
      activeRequestId: requestId,
    });

    let result: MarketRadarClientResult;
    try {
      result = await loader();
    } catch {
      result = {
        kind: "error",
        message: "The Market Radar loader failed unexpectedly.",
      };
    }
    if (get().activeRequestId !== requestId) return;

    if (result.kind === "ready") {
      const status =
        Date.parse(result.snapshot.expiresAt) <= nowMs ? "stale" : "ready";
      set({
        status,
        snapshot: result.snapshot,
        error: null,
        activeRequestId: null,
      });
      return;
    }

    set({
      status: result.kind,
      snapshot: null,
      error: "message" in result ? result.message : null,
      activeRequestId: null,
    });
  },
  recheckFreshness: (nowMs = Date.now()) => {
    const { status, snapshot } = get();
    if (
      status === "ready" &&
      snapshot !== null &&
      Date.parse(snapshot.expiresAt) <= nowMs
    ) {
      set({ status: "stale" });
    }
  },
  reset: () => {
    requestSequence += 1;
    set(initialState);
  },
}));
