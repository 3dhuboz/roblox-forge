import { describe, expect, it } from "vitest";

import * as receipts from "../../src/types/receipts";
import {
  MAX_DIAGNOSTICS,
  MAX_DIAGNOSTIC_LENGTH,
  createBrowserReceipt,
  isAuthoritativeSuccess,
  type BrowserReceiptInput,
  type BrowserReceiptState,
  type OperationReceipt,
} from "../../src/types/receipts";

const correlationId = "create-flow-1";
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const common = {
  operation: "build",
  correlationId,
  message: "Operation status",
} as const;

describe("browser operation receipt boundary", () => {
  it("exports exactly one receipt factory and it is browser-only", () => {
    const factoryExports = Object.keys(receipts)
      .filter((name) => name.startsWith("create"))
      .sort();

    expect(factoryExports).toEqual(["createBrowserReceipt"]);
  });

  it.each(["simulated", "unavailable"] as const)(
    "creates a visibly %s non-authoritative receipt",
    (state) => {
      const receipt = createBrowserReceipt({ ...common, state });

      expect(receipt).toMatchObject({
        state,
        authoritative: false,
        retrySafety: "not_retryable",
        correlationId,
      });
      expect(receipt.message).toMatch(/^\[Browser preview\]/);
      expect(isAuthoritativeSuccess(receipt)).toBe(false);
    },
  );

  it("rejects a desktop state even when the type boundary is bypassed", () => {
    expect(() =>
      createBrowserReceipt({
        ...common,
        state: "succeeded" as BrowserReceiptState,
      }),
    ).toThrow(/browser receipts/i);
  });

  it("drops authority-bearing artifact fields from hostile browser input", () => {
    const hostileInput = {
      ...common,
      state: "simulated",
      authoritative: true,
      inputHash: "input-authority",
      artifactHash: "artifact-authority",
      externalResourceId: "place-version:42",
      finishedAt: "2000-01-01T00:00:00.000Z",
    } as unknown as BrowserReceiptInput;

    const receipt = createBrowserReceipt(hostileInput);

    expect(receipt.authoritative).toBe(false);
    expect(receipt).not.toHaveProperty("inputHash");
    expect(receipt).not.toHaveProperty("artifactHash");
    expect(receipt).not.toHaveProperty("externalResourceId");
    expect(receipt.finishedAt).not.toBe("2000-01-01T00:00:00.000Z");
    expect(isAuthoritativeSuccess(receipt)).toBe(false);
  });

  it("generates distinct UUID v4 operation IDs and RFC3339 timestamps", () => {
    const first = createBrowserReceipt({ ...common, state: "simulated" });
    const second = createBrowserReceipt({ ...common, state: "unavailable" });

    expect(first.operationId).toMatch(UUID_V4);
    expect(second.operationId).toMatch(UUID_V4);
    expect(first.operationId).not.toBe(second.operationId);
    expect(Number.isNaN(Date.parse(first.startedAt))).toBe(false);
    expect(Number.isNaN(Date.parse(first.finishedAt ?? ""))).toBe(false);
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

    const first = createBrowserReceipt({
      ...common,
      state: "unavailable",
      diagnostics,
    });
    const second = createBrowserReceipt({
      ...common,
      state: "unavailable",
      diagnostics,
    });

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

  it("keeps value as non-authoritative browser data", () => {
    const receipt = createBrowserReceipt<{ claimedSuccess: boolean }>({
      ...common,
      operation: "analytics",
      state: "simulated",
      value: { claimedSuccess: true },
    });

    expect(receipt.value).toEqual({ claimedSuccess: true });
    expect(isAuthoritativeSuccess(receipt)).toBe(false);
  });

  it("uses the success guard only to display a Rust-issued receipt", () => {
    const receivedFromRust: OperationReceipt = {
      operationId: "b92aeffb-a527-4197-a48a-d640b6e8b156",
      correlationId,
      operation: "publish",
      state: "succeeded",
      authoritative: true,
      startedAt: "2026-07-14T08:00:00.000Z",
      finishedAt: "2026-07-14T08:00:01.000Z",
      message: "Private place version uploaded",
      diagnostics: [],
      retrySafety: "safe",
    };

    expect(isAuthoritativeSuccess(receivedFromRust)).toBe(true);
    expect(Object.keys(receipts).filter((name) => name.startsWith("create"))).toEqual([
      "createBrowserReceipt",
    ]);
  });
});
