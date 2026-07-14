import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, it, vi } from "vitest";
import commonSchema from "../../../schemas/intelligence/common.schema.json";
import radarSchema from "../../../schemas/intelligence/radar-snapshot.v1.schema.json";
import { deriveEntryFeatures } from "../src/intelligence/radar/features";
import { normalizePublicRadarCapture } from "../src/intelligence/radar/normalize";
import { refreshPublicRadar } from "../src/intelligence/radar/refresh";
import type {
  NormalizedPublicRadarCapture,
  PublicRadarCaptureInput,
} from "../src/intelligence/radar/types";

function capture(
  overrides: Partial<PublicRadarCaptureInput> = {},
): PublicRadarCaptureInput {
  return {
    source: "roblox_public_chart",
    sort: "top_playing_now",
    sourceUrl: "https://www.roblox.com/charts/top-playing-now",
    capturedAt: "2026-07-14T00:00:00.000Z",
    expiresAt: "2026-07-16T00:00:00.000Z",
    captureMode: "manual_verified",
    locale: "en-AU",
    entries: [
      {
        corpusRecordId: "corpus:public-example-1",
        universeId: 200,
        rootPlaceId: 100,
        gameLabel: "Public Example Experience",
        publicUrl: "https://www.roblox.com/games/100/example",
        discoveryPosition: 4,
        liveCcu: 12_000,
        visits: 2_000_000,
        favorites: 400_000,
        publicRating: 0.91,
        updatedAt: "2026-07-13T00:00:00.000Z",
        evidenceId: "evidence:public-example-1",
        patternTags: ["checkpoint-progression"],
        publicOffers: [],
      },
    ],
    ...overrides,
  };
}

describe("public radar refresh", () => {
  it("publishes no snapshot when collection fails", async () => {
    const provider = {
      capture: vi.fn().mockRejectedValue(new Error("upstream unavailable")),
    };

    const result = await refreshPublicRadar({
      provider,
      previous: null,
      idFactory: () => "radar:attempt-1",
    });

    expect(result.status).toBe("failed");
    expect(result).not.toHaveProperty("snapshot");
    expect(result.health).toMatchObject({ status: "error" });
  });

  it("publishes a closed ordinal snapshot from validated public evidence", async () => {
    const provider = { capture: vi.fn().mockResolvedValue(capture()) };

    const result = await refreshPublicRadar({
      provider,
      previous: null,
      idFactory: () => "radar:snapshot-1",
    });

    expect(result.status).toBe("published");
    if (result.status !== "published") throw new Error("expected snapshot");
    expect(result.snapshot.entries).toHaveLength(1);
    expect(result.snapshot.entries[0]?.signals.length).toBeGreaterThan(0);
    expect(result.snapshot.corpusRecordIds).toEqual([
      "corpus:public-example-1",
    ]);
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    ajv.addSchema(commonSchema);
    const validate = ajv.compile(radarSchema);
    expect(validate(result.snapshot), JSON.stringify(validate.errors)).toBe(true);
    expect(JSON.stringify(result.snapshot)).not.toMatch(
      /dailyRevenue|payer|retention|estimatedRobux/i,
    );
  });

  it("records counter resets as discontinuities instead of negative velocity", async () => {
    const previousCapture = capture({
      capturedAt: "2026-07-13T00:00:00.000Z",
      expiresAt: "2026-07-15T00:00:00.000Z",
    });
    const previous = previousCapture.entries[0]!;
    const current = {
      ...previous,
      visits: previous.visits! - 100,
      liveCcu: previous.liveCcu! - 100,
      evidenceId: "evidence:public-example-2",
    };

    const result = deriveEntryFeatures(previous, current, {
      previousCapturedAt: previousCapture.capturedAt,
      currentCapturedAt: "2026-07-14T00:00:00.000Z",
    });

    expect(result.discontinuities).toEqual([
      { metric: "visits", previousValue: 2_000_000, currentValue: 1_999_900 },
    ]);
    expect(result.visitsVelocity).toBeNull();
    expect(result.ccuChangeRatio).toBeLessThan(0);

    const published = await refreshPublicRadar({
      provider: { capture: vi.fn().mockResolvedValue(capture({ entries: [current] })) },
      previous: previousCapture as NormalizedPublicRadarCapture,
      idFactory: () => "radar:snapshot-reset",
    });
    expect(published.status).toBe("published");
    if (published.status !== "published") throw new Error("expected snapshot");
    expect(published.snapshot.entries[0]?.discontinuities).toEqual([
      {
        metric: "visits",
        previousValue: 2_000_000,
        currentValue: 1_999_900,
        previousEvidenceId: "evidence:public-example-1",
        evidenceId: "evidence:public-example-2",
        observedAt: "2026-07-14T00:00:00.000Z",
      },
    ]);
    const momentum = published.snapshot.entries[0]?.ordinalScores.find(
      (score) => score.dimension === "momentum",
    );
    expect(momentum?.evidenceIds).toEqual([
      "evidence:public-example-1",
      "evidence:public-example-2",
    ]);
    const provenanceIds = new Set(published.snapshot.provenance.evidenceIds);
    const nestedEvidenceIds = published.snapshot.entries.flatMap((entry) => [
      ...entry.signals.map((signal) => signal.evidenceId),
      ...entry.ordinalScores.flatMap((score) => score.evidenceIds),
      ...entry.publicOffers.map((offer) => offer.evidenceId),
      ...entry.discontinuities.flatMap((discontinuity) => [
        discontinuity.previousEvidenceId,
        discontinuity.evidenceId,
      ]),
    ]);
    expect(nestedEvidenceIds.every((id) => provenanceIds.has(id))).toBe(true);
  });

  it("ignores a previous capture for a different public sort", async () => {
    const previous = capture({ sort: "top_trending" }) as NormalizedPublicRadarCapture;
    const provider = { capture: vi.fn().mockResolvedValue(capture()) };

    const result = await refreshPublicRadar({
      provider,
      previous,
      idFactory: () => "radar:snapshot-2",
    });

    expect(result.status).toBe("published");
    if (result.status !== "published") throw new Error("expected snapshot");
    expect(result.snapshot.entries[0]?.ordinalScores).not.toContainEqual(
      expect.objectContaining({ dimension: "momentum" }),
    );
  });

  it("does not compare momentum across different numeric universe identities", async () => {
    const previous = capture({
      capturedAt: "2026-07-13T00:00:00.000Z",
      expiresAt: "2026-07-15T00:00:00.000Z",
      entries: [{ ...capture().entries[0]!, universeId: 201 }],
    }) as NormalizedPublicRadarCapture;
    const result = await refreshPublicRadar({
      provider: { capture: vi.fn().mockResolvedValue(capture()) },
      previous,
      idFactory: () => "radar:snapshot-identity",
    });

    expect(result.status).toBe("published");
    if (result.status !== "published") throw new Error("expected snapshot");
    expect(result.snapshot.entries[0]?.ordinalScores).not.toContainEqual(
      expect.objectContaining({ dimension: "momentum" }),
    );
  });

  it.each([
    [
      "future capture",
      {
        capturedAt: "2026-07-15T00:00:00.000Z",
        expiresAt: "2026-07-17T00:00:00.000Z",
      },
    ],
    [
      "different locale",
      {
        capturedAt: "2026-07-13T00:00:00.000Z",
        expiresAt: "2026-07-15T00:00:00.000Z",
        locale: "fr-FR",
      },
    ],
  ])("ignores a %s when pairing momentum", async (_label, overrides) => {
    const previous = capture(overrides) as NormalizedPublicRadarCapture;
    const result = await refreshPublicRadar({
      provider: { capture: vi.fn().mockResolvedValue(capture()) },
      previous,
      idFactory: () => "radar:snapshot-invalid-pair",
    });

    expect(result.status).toBe("published");
    if (result.status !== "published") throw new Error("expected snapshot");
    expect(result.snapshot.entries[0]?.ordinalScores).not.toContainEqual(
      expect.objectContaining({ dimension: "momentum" }),
    );
  });

  it("normalizes momentum features across unequal sampling intervals", () => {
    const previous = capture().entries[0]!;
    const oneDay = {
      ...previous,
      liveCcu: 12_600,
      visits: 2_100_000,
      favorites: 420_000,
    };
    const twoDays = {
      ...previous,
      liveCcu: 13_200,
      visits: 2_200_000,
      favorites: 440_000,
    };
    const daily = deriveEntryFeatures(previous, oneDay, {
      previousCapturedAt: "2026-07-12T00:00:00.000Z",
      currentCapturedAt: "2026-07-13T00:00:00.000Z",
    });
    const everyTwoDays = deriveEntryFeatures(previous, twoDays, {
      previousCapturedAt: "2026-07-12T00:00:00.000Z",
      currentCapturedAt: "2026-07-14T00:00:00.000Z",
    });

    expect(everyTwoDays.ccuChangeRatio).toBeCloseTo(daily.ccuChangeRatio!);
    expect(everyTwoDays.visitsVelocity).toBeCloseTo(daily.visitsVelocity!);
    expect(everyTwoDays.favoritesVelocity).toBeCloseTo(
      daily.favoritesVelocity!,
    );
  });

  it("does not form a schema-invalid comparison from a reused evidence ID", async () => {
    const previous = capture({
      capturedAt: "2026-07-13T00:00:00.000Z",
      expiresAt: "2026-07-15T00:00:00.000Z",
    }) as NormalizedPublicRadarCapture;
    const current = capture({
      entries: [
        {
          ...capture().entries[0]!,
          liveCcu: 14_000,
          visits: 2_200_000,
          favorites: 440_000,
        },
      ],
    });
    const result = await refreshPublicRadar({
      provider: { capture: vi.fn().mockResolvedValue(current) },
      previous,
      idFactory: () => "radar:snapshot-reused-evidence",
    });

    expect(result.status).toBe("published");
    if (result.status !== "published") throw new Error("expected snapshot");
    expect(result.snapshot.entries[0]?.ordinalScores).not.toContainEqual(
      expect.objectContaining({ dimension: "momentum" }),
    );
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    ajv.addSchema(commonSchema);
    const validate = ajv.compile(radarSchema);
    expect(validate(result.snapshot), JSON.stringify(validate.errors)).toBe(true);
  });

  it("keeps the maximum valid capture provenance within the canonical bound", async () => {
    const entries = (
      prefix: "previous" | "current",
      observedAt: string,
      growth: number,
    ): PublicRadarCaptureInput["entries"] =>
      Array.from({ length: 32 }, (_, entryIndex) => {
        const universeId = 10_000 + entryIndex;
        const rootPlaceId = 20_000 + entryIndex;
        return {
          corpusRecordId: `corpus:${prefix}-${entryIndex + 1}`,
          universeId,
          rootPlaceId,
          gameLabel: `Public Game ${entryIndex + 1}`,
          publicUrl: `https://www.roblox.com/games/${rootPlaceId}/public-game`,
          discoveryPosition: entryIndex + 1,
          liveCcu: 1_000 * growth,
          visits: 10_000 * growth,
          favorites: 1_000 * growth,
          publicRating: 0.9,
          updatedAt: observedAt,
          evidenceId: `evidence:${prefix}-${entryIndex + 1}`,
          patternTags: [],
          publicOffers: Array.from({ length: 18 }, (_, offerIndex) => {
            const offerId = 100_000 + entryIndex * 100 + offerIndex;
            return {
              evidenceId: `evidence:${prefix}-${entryIndex + 1}-offer-${offerIndex + 1}`,
              offerType: "game_pass" as const,
              offerId,
              sourceUrl: `https://www.roblox.com/game-pass/${offerId}/public-offer`,
              observedAt,
              locale: "en-AU",
              priceContext: "unavailable" as const,
              priceRobux: null,
            };
          }),
        };
      });
    const previous = normalizePublicRadarCapture({
      ...capture(),
      capturedAt: "2026-07-13T00:00:00.000Z",
      expiresAt: "2026-07-15T00:00:00.000Z",
      entries: entries("previous", "2026-07-13T00:00:00.000Z", 1),
    });
    const current = {
      ...capture(),
      entries: entries("current", "2026-07-14T00:00:00.000Z", 2),
    };
    const result = await refreshPublicRadar({
      provider: { capture: vi.fn().mockResolvedValue(current) },
      previous,
      idFactory: () => "radar:snapshot-max-evidence",
    });

    expect(result.status).toBe("published");
    if (result.status !== "published") throw new Error("expected snapshot");
    expect(result.snapshot.provenance.evidenceIds).toHaveLength(640);
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    ajv.addSchema(commonSchema);
    const validate = ajv.compile(radarSchema);
    expect(validate(result.snapshot), JSON.stringify(validate.errors)).toBe(true);
  });
});
