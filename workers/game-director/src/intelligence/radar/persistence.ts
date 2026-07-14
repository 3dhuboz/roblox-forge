import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import commonSchema from "../../../../../schemas/intelligence/common.schema.json";
import radarSnapshotSchema from "../../../../../schemas/intelligence/radar-snapshot.v1.schema.json";
import type { PublicRadarSnapshot } from "./types";

interface RadarD1Result {
  readonly success: boolean;
  readonly error?: string;
}

interface RadarD1BoundStatement {
  run(): Promise<RadarD1Result>;
}

interface RadarD1PreparedStatement {
  bind(...values: unknown[]): RadarD1BoundStatement;
}

export interface RadarD1Database {
  prepare(query: string): RadarD1PreparedStatement;
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(commonSchema);
const validateRadarSnapshot = ajv.compile(radarSnapshotSchema);

function canonicalId(value: string, errorCode: string): string {
  if (
    value.length > 96 ||
    !/^[a-z][a-z0-9]*(?::[a-z0-9][a-z0-9._-]*)+$/.test(value)
  ) {
    throw new Error(errorCode);
  }
  return value;
}

function isoDate(value: string, errorCode: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error(errorCode);
  return new Date(value).toISOString();
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function assertCanonicalPublicRadarSnapshot(
  value: unknown,
): asserts value is PublicRadarSnapshot {
  if (!validateRadarSnapshot(value)) {
    throw new Error("invalid_canonical_radar_snapshot");
  }
}

export async function persistCanonicalRadarSnapshot(input: {
  db: RadarD1Database;
  captureId: string;
  snapshot: unknown;
  createdAt: string;
}): Promise<void> {
  assertCanonicalPublicRadarSnapshot(input.snapshot);
  const captureId = canonicalId(input.captureId, "invalid_capture_id");
  const createdAt = isoDate(input.createdAt, "invalid_snapshot_created_at");
  const payloadJson = JSON.stringify(input.snapshot);
  const payloadHash = await sha256(payloadJson);
  const result = await input.db
    .prepare(
      `INSERT INTO radar_snapshots
       (id, capture_id, payload_json, payload_hash, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      input.snapshot.id,
      captureId,
      payloadJson,
      payloadHash,
      createdAt,
    )
    .run();
  if (!result.success) {
    throw new Error("radar_snapshot_persistence_failed");
  }
}
