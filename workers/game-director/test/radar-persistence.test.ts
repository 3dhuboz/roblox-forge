import { describe, expect, it, vi } from "vitest";
import validIntelligenceFixture from "../../../schemas/intelligence/fixtures/valid/obby.json";
import {
  assertCanonicalPublicRadarSnapshot,
  persistCanonicalRadarSnapshot,
  type RadarD1Database,
} from "../src/intelligence/radar/persistence";

function database(result: { success: boolean; error?: string }) {
  const run = vi.fn().mockResolvedValue(result);
  const bind = vi.fn().mockReturnValue({ run });
  const prepare = vi.fn().mockReturnValue({ bind });
  return { db: { prepare } as RadarD1Database, prepare, bind, run };
}

describe("canonical radar persistence boundary", () => {
  it("validates the complete canonical contract before preparing a D1 write", async () => {
    const harness = database({ success: true });
    const snapshot = structuredClone(validIntelligenceFixture.radarSnapshot);

    await persistCanonicalRadarSnapshot({
      db: harness.db,
      captureId: "capture:valid-1",
      snapshot,
      createdAt: "2026-07-14T00:00:00.000Z",
    });

    expect(harness.prepare).toHaveBeenCalledOnce();
    expect(harness.bind).toHaveBeenCalledWith(
      snapshot.id,
      "capture:valid-1",
      JSON.stringify(snapshot),
      expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      "2026-07-14T00:00:00.000Z",
    );
    expect(harness.run).toHaveBeenCalledOnce();
  });

  it("rejects incomplete or nested-invalid payloads before D1 is touched", async () => {
    const harness = database({ success: true });
    const incomplete = {
      schemaVersion: "1.0.0",
      id: "snapshot:incomplete",
      asOf: "2026-07-14T00:00:00.000Z",
      expiresAt: "2026-07-16T00:00:00.000Z",
    };
    const nestedInvalid = structuredClone(
      validIntelligenceFixture.radarSnapshot,
    ) as Record<string, unknown>;
    const entries = nestedInvalid.entries as Array<Record<string, unknown>>;
    entries[0].signals = [];

    expect(() => assertCanonicalPublicRadarSnapshot(incomplete)).toThrow(
      "invalid_canonical_radar_snapshot",
    );
    await expect(
      persistCanonicalRadarSnapshot({
        db: harness.db,
        captureId: "capture:invalid-1",
        snapshot: nestedInvalid,
        createdAt: "2026-07-14T00:00:00.000Z",
      }),
    ).rejects.toThrow("invalid_canonical_radar_snapshot");
    expect(harness.prepare).not.toHaveBeenCalled();
  });

  it("fails closed when the immutable D1 insertion fails", async () => {
    const harness = database({ success: false, error: "constraint" });

    await expect(
      persistCanonicalRadarSnapshot({
        db: harness.db,
        captureId: "capture:valid-2",
        snapshot: validIntelligenceFixture.radarSnapshot,
        createdAt: "2026-07-14T00:00:00.000Z",
      }),
    ).rejects.toThrow("radar_snapshot_persistence_failed");
  });
});
