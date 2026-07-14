import { describe, expect, it } from "vitest";
import { normalizePublicRadarCapture } from "../src/intelligence/radar/normalize";
import { scoreMos, scoreSnapshot } from "../src/intelligence/radar/score";

function fixtureCapture() {
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
        patternTags: ["checkpoint-progression", "social-co-play"],
        publicOffers: [],
      },
    ],
  };
}

describe("public radar normalization and scoring", () => {
  it("shrinks low-confidence opportunity signals toward neutral", () => {
    expect(scoreMos({ raw: 90, confidence: 0.2 })).toEqual({
      adjusted: 58,
      uncertainty: 21,
    });
  });

  it("does not convert rank or CCU into competitor revenue", () => {
    const result = scoreSnapshot({
      publicMomentum: 90,
      rankEvidence: 80,
      publicOfferEvidence: null,
      liveOpsActivity: 70,
      buildOriginalityFit: 60,
      confidenceEvidence: {
        sourceCoverage: 0.75,
        sampleDuration: 0.25,
        rankEvidence: 1,
        productObservability: 0,
      },
    });

    expect(JSON.stringify(result)).not.toMatch(
      /estimatedRevenue|estimatedRobux|revenueRank|topMonetizing/i,
    );
    expect(result.components.publicOfferSignal).toBeNull();
  });

  it("keeps missing rank missing instead of zero-filling it", () => {
    const result = scoreSnapshot({
      publicMomentum: 72,
      rankEvidence: null,
      publicOfferEvidence: null,
      liveOpsActivity: 65,
      buildOriginalityFit: 80,
      confidenceEvidence: {
        sourceCoverage: 0.6,
        sampleDuration: 0.2,
        rankEvidence: 0,
        productObservability: 0,
      },
    });

    expect(result.modelVersion).toBe("MOS-public-no-rank-v1");
    expect(result.components.rankEvidence).toBeNull();
  });

  it("rejects non-allowlisted, virtual-content, and owner analytics evidence", () => {
    expect(() =>
      normalizePublicRadarCapture({
        ...fixtureCapture(),
        sourceUrl: "https://example.com/private-chart",
      }),
    ).toThrow("source_not_allowlisted");
    expect(() =>
      normalizePublicRadarCapture({
        ...fixtureCapture(),
        gameplayContent: { map: "raw-place" },
      }),
    ).toThrow("virtual_content_forbidden");
    expect(() =>
      normalizePublicRadarCapture({
        ...fixtureCapture(),
        ownerAnalytics: { dailyRevenue: 500 },
      }),
    ).toThrow("private_owner_evidence_forbidden");
  });

  it("normalizes only the closed public metadata contract", () => {
    const result = normalizePublicRadarCapture(fixtureCapture());

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.liveCcu).toBe(12_000);
    expect(Object.keys(result.entries[0] ?? {}).sort()).toEqual(
      [
        "corpusRecordId",
        "discoveryPosition",
        "evidenceId",
        "favorites",
        "gameLabel",
        "liveCcu",
        "patternTags",
        "publicOffers",
        "publicRating",
        "publicUrl",
        "rootPlaceId",
        "universeId",
        "updatedAt",
        "visits",
      ].sort(),
    );
  });

  it("requires chart rank and matching first-party chart provenance", () => {
    expect(() =>
      normalizePublicRadarCapture({
        ...fixtureCapture(),
        entries: [
          { ...fixtureCapture().entries[0]!, discoveryPosition: null },
        ],
      }),
    ).toThrow("missing_chart_rank");
    expect(() =>
      normalizePublicRadarCapture({
        ...fixtureCapture(),
        sort: "top_trending",
      }),
    ).toThrow("chart_sort_source_mismatch");
  });

  it("binds the public game URL to the numeric root place identity", () => {
    expect(() =>
      normalizePublicRadarCapture({
        ...fixtureCapture(),
        entries: [
          {
            ...fixtureCapture().entries[0]!,
            publicUrl: "https://www.roblox.com/games/999/different-game",
          },
        ],
      }),
    ).toThrow("invalid_public_game_url");
  });

  it("derives an offer component only from typed, attributable public evidence", () => {
    const evidence = {
      evidenceId: "evidence:offer-1",
      offerType: "game_pass" as const,
      offerId: 300,
      sourceUrl: "https://www.roblox.com/game-pass/300/example",
      observedAt: "2026-07-14T00:00:00.000Z",
      locale: "en-AU",
      priceContext: "anonymous_public_page" as const,
      priceRobux: 99,
    };
    const result = scoreSnapshot({
      publicMomentum: 70,
      rankEvidence: 80,
      publicOfferEvidence: [evidence],
      liveOpsActivity: 60,
      buildOriginalityFit: 70,
      confidenceEvidence: {
        sourceCoverage: 1,
        sampleDuration: 0.5,
        rankEvidence: 1,
        productObservability: 1,
      },
    });

    expect(result.components.publicOfferSignal).toBeGreaterThan(0);
    expect(result.publicOfferEvidenceIds).toEqual(["evidence:offer-1"]);
    expect(result.evidenceLabels).toContain("public_offer_signal");
    expect(() =>
      scoreSnapshot({
        publicMomentum: 70,
        rankEvidence: 80,
        publicOfferEvidence: [
          { ...evidence, sourceUrl: "https://example.com/unproven" },
        ],
        liveOpsActivity: 60,
        buildOriginalityFit: 70,
        confidenceEvidence: {
          sourceCoverage: 1,
          sampleDuration: 0.5,
          rankEvidence: 1,
          productObservability: 1,
        },
      }),
    ).toThrow("invalid_public_offer_url");
  });
});
