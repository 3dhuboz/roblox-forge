import { describe, expect, it } from "vitest";
import {
  MARKET_RADAR_ARCHETYPES,
  MARKET_RADAR_RATIONALE_COPY,
  MARKET_RADAR_RATIONALE_TOKENS,
  validateMarketRadarSnapshot,
} from "./marketRadar";
import { EXAMPLE_MARKET_RADAR_SNAPSHOT } from "./marketRadarExample";

describe("Market Radar contract", () => {
  it("accepts the closed rights-safe aggregate example", () => {
    expect(validateMarketRadarSnapshot(EXAMPLE_MARKET_RADAR_SNAPSHOT)).toBe(
      true,
    );
    expect(EXAMPLE_MARKET_RADAR_SNAPSHOT.researchBasis.experienceCount).toBe(
      30,
    );
    expect(EXAMPLE_MARKET_RADAR_SNAPSHOT.entries).toHaveLength(13);
    expect(
      EXAMPLE_MARKET_RADAR_SNAPSHOT.entries.map((entry) => entry.archetype),
    ).toEqual(MARKET_RADAR_ARCHETYPES);
  });

  it.each([
    "estimatedRevenue",
    "payerConversion",
    "ARPDAU",
    "arppu",
    "ownedAnalytics",
  ])("recursively rejects the forbidden field %s", (field) => {
    const candidate = structuredClone(EXAMPLE_MARKET_RADAR_SNAPSHOT) as Record<
      string,
      unknown
    >;
    const entries = candidate.entries as Array<Record<string, unknown>>;
    const compatibility = entries[0]
      .monetizationDesignCompatibility as Record<string, unknown>;
    compatibility[field] = 123;

    expect(validateMarketRadarSnapshot(candidate)).toBe(false);
  });

  it("rejects unknown fields at every object boundary", () => {
    const topLevel = {
      ...EXAMPLE_MARKET_RADAR_SNAPSHOT,
      surprise: true,
    };
    const nested = structuredClone(EXAMPLE_MARKET_RADAR_SNAPSHOT) as Record<
      string,
      unknown
    >;
    const entries = nested.entries as Array<Record<string, unknown>>;
    entries[0].unknownSignal = "not in the contract";

    expect(validateMarketRadarSnapshot(topLevel)).toBe(false);
    expect(validateMarketRadarSnapshot(nested)).toBe(false);
  });

  it("accepts only closed rationale tokens backed by fixed UI copy", () => {
    const candidate = structuredClone(EXAMPLE_MARKET_RADAR_SNAPSHOT) as Record<
      string,
      unknown
    >;
    const entries = candidate.entries as Array<Record<string, unknown>>;
    const compatibility = entries[0]
      .monetizationDesignCompatibility as Record<string, unknown>;
    compatibility.rationaleToken = "authority supplied arbitrary copy";

    expect(validateMarketRadarSnapshot(candidate)).toBe(false);
    expect(Object.keys(MARKET_RADAR_RATIONALE_COPY).sort()).toEqual(
      [...MARKET_RADAR_RATIONALE_TOKENS].sort(),
    );
    for (const entry of EXAMPLE_MARKET_RADAR_SNAPSHOT.entries) {
      expect(
        MARKET_RADAR_RATIONALE_COPY[
          entry.monetizationDesignCompatibility.rationaleToken
        ],
      ).toBeTruthy();
    }
  });

  it("contains no competitor identity, locator, or raw game fields", () => {
    const serialized = JSON.stringify(EXAMPLE_MARKET_RADAR_SNAPSHOT);
    const entryKeys = new Set(
      EXAMPLE_MARKET_RADAR_SNAPSHOT.entries.flatMap((entry) =>
        Object.keys(entry),
      ),
    );

    expect(serialized).not.toMatch(/https?:\/\//i);
    expect(serialized).not.toMatch(/universeId|placeId|gameId|gameName/i);
    expect(entryKeys.has("name")).toBe(false);
    expect(entryKeys.has("url")).toBe(false);
    expect(entryKeys.has("id")).toBe(false);
  });
});
