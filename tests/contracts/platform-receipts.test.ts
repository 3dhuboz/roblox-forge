import { describe, expect, it } from "vitest";

import {
  MAX_DIAGNOSTICS,
  MAX_DIAGNOSTIC_LENGTH,
  createBrowserReceipt,
  createCancelledReceipt,
  createFailedReceipt,
  createPartialSuccessReceipt,
  createQueuedReceipt,
  createRunningReceipt,
  createSimulatedReceipt,
  createSucceededReceipt,
  createUnavailableReceipt,
  isAuthoritativeSuccess,
  type BrowserReceiptState,
  type OperationReceipt,
  type OperationState,
} from "../../src/types/receipts";

const correlationId = "create-flow-1";

const common = {
  operation: "build",
  correlationId,
  message: "Operation status",
} as const;

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("platform operation receipts", () => {
  it("does not let a browser simulation unlock an authoritative gate", () => {
    const receipt = createBrowserReceipt({
      state: "simulated",
      operation: "build",
      correlationId: "create-flow-1",
      message: "Browser preview only",
    });

    expect(receipt.state).toBe("simulated");
    expect(receipt.authoritative).toBe(false);
    expect(isAuthoritativeSuccess(receipt)).toBe(false);
  });

  it.each<[OperationState, boolean]>([
    ["queued", false],
    ["running", false],
    ["succeeded", true],
    ["failed", false],
    ["cancelled", false],
    ["partial_success", false],
    ["unavailable", false],
    ["simulated", false],
  ])("requires succeeded plus authoritative for %s", (state, expected) => {
    const receipt = {
      ...createSucceededReceipt(common),
      state,
      authoritative: true,
    } satisfies OperationReceipt;

    expect(isAuthoritativeSuccess(receipt)).toBe(expected);
    expect(
      isAuthoritativeSuccess({ ...receipt, authoritative: false }),
    ).toBe(false);
  });

  it("derives safe authority in every constructor", () => {
    const nonAuthoritative = [
      createQueuedReceipt(common),
      createRunningReceipt(common),
      createFailedReceipt(common),
      createCancelledReceipt(common),
      createPartialSuccessReceipt({
        ...common,
        operation: "publish",
        externalResourceId: "place-version:42",
      }),
      createUnavailableReceipt(common),
      createSimulatedReceipt(common),
    ];

    for (const receipt of nonAuthoritative) {
      expect(receipt.authoritative).toBe(false);
      expect(isAuthoritativeSuccess(receipt)).toBe(false);
    }

    const success = createSucceededReceipt(common);
    expect(success.authoritative).toBe(true);
    expect(isAuthoritativeSuccess(success)).toBe(true);
  });

  it("models partial success as reconciliation-required evidence", () => {
    const receipt = createPartialSuccessReceipt({
      ...common,
      operation: "publish",
      externalResourceId: "place-version:42",
      message: "Version uploaded; metadata update failed",
    });

    expect(receipt).toMatchObject({
      state: "partial_success",
      authoritative: false,
      externalResourceId: "place-version:42",
      retrySafety: "unsafe_without_reconciliation",
    });
    expect(isAuthoritativeSuccess(receipt)).toBe(false);
  });

  it("uses distinct UUID v4 operation IDs while sharing a caller correlation ID", () => {
    const build = createQueuedReceipt(common);
    const studio = createRunningReceipt({
      ...common,
      operation: "studio_test",
    });
    const publish = createSucceededReceipt({
      ...common,
      operation: "publish",
    });

    expect(build.operationId).toMatch(UUID_V4);
    expect(studio.operationId).toMatch(UUID_V4);
    expect(publish.operationId).toMatch(UUID_V4);
    expect(new Set([build.operationId, studio.operationId, publish.operationId])).toHaveProperty(
      "size",
      3,
    );
    expect([build.correlationId, studio.correlationId, publish.correlationId]).toEqual([
      correlationId,
      correlationId,
      correlationId,
    ]);
  });

  it("omits finishedAt for queued/running and uses RFC3339 for terminals", () => {
    const queued = createQueuedReceipt(common);
    const running = createRunningReceipt(common);
    const terminal = createFailedReceipt(common);

    expect(queued).not.toHaveProperty("finishedAt");
    expect(running).not.toHaveProperty("finishedAt");
    expect(Number.isNaN(Date.parse(queued.startedAt))).toBe(false);
    expect(terminal.finishedAt).toBeDefined();
    expect(Number.isNaN(Date.parse(terminal.finishedAt ?? ""))).toBe(false);
  });

  it("omits absent optional fields from JSON", () => {
    const serialized = JSON.parse(JSON.stringify(createQueuedReceipt(common))) as Record<
      string,
      unknown
    >;

    expect(serialized).toMatchObject({
      operation: "build",
      state: "queued",
      authoritative: false,
      retrySafety: "safe",
    });
    for (const optional of [
      "finishedAt",
      "inputHash",
      "artifactHash",
      "externalResourceId",
      "recoveryAction",
      "value",
    ]) {
      expect(serialized).not.toHaveProperty(optional);
    }
  });

  it("only creates visibly simulated or unavailable browser receipts", () => {
    for (const state of ["simulated", "unavailable"] as const) {
      const receipt = createBrowserReceipt({ ...common, state });
      expect(receipt.state).toBe(state);
      expect(receipt.authoritative).toBe(false);
      expect(receipt.message).toMatch(/^\[Browser preview\]/);
      expect(isAuthoritativeSuccess(receipt)).toBe(false);
    }

    expect(() =>
      createBrowserReceipt({
        ...common,
        state: "succeeded" as BrowserReceiptState,
      }),
    ).toThrow(/browser receipts/i);
  });

  it("bounds, deterministically sanitizes, and pre-redacts diagnostics", () => {
    const diagnostics = [
      "safe diagnostic",
      "Authorization: Bearer bearer-sentinel",
      "api_key=sk-or-v1-api-sentinel",
      String.raw`C:\Users\Steve\secret-project\.env`,
      "/home/steve/secret-project/.env",
      'response body: {"token":"body-sentinel"}',
      "x".repeat(MAX_DIAGNOSTIC_LENGTH + 40),
      ...Array.from(
        { length: MAX_DIAGNOSTICS + 4 },
        (_, index) => `bounded-${index}`,
      ),
    ];

    const first = createFailedReceipt({ ...common, diagnostics });
    const second = createFailedReceipt({ ...common, diagnostics });

    expect(first.diagnostics).toEqual(second.diagnostics);
    expect(first.diagnostics.length).toBeLessThanOrEqual(MAX_DIAGNOSTICS);
    expect(
      first.diagnostics.every(
        (diagnostic) => [...diagnostic].length <= MAX_DIAGNOSTIC_LENGTH,
      ),
    ).toBe(true);

    const serialized = JSON.stringify(first.diagnostics);
    for (const forbidden of [
      "bearer-sentinel",
      "api-sentinel",
      String.raw`C:\Users`,
      "/home/steve",
      "body-sentinel",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("keeps typed value data from granting authority", () => {
    const receipt: OperationReceipt<{ claimedSuccess: boolean }> = createSimulatedReceipt({
      ...common,
      operation: "analytics",
      value: { claimedSuccess: true },
    });

    expect(receipt.value).toEqual({ claimedSuccess: true });
    expect(isAuthoritativeSuccess(receipt)).toBe(false);
  });
});
