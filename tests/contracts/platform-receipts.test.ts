import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import * as receipts from "../../src/types/receipts";
import {
  MAX_CORRELATION_ID_LENGTH,
  MAX_DIAGNOSTICS,
  MAX_DIAGNOSTIC_LENGTH,
  MAX_EXTERNAL_RESOURCE_ID_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_OPERATION_LENGTH,
  MAX_RECOVERY_ACTION_LENGTH,
  MAX_VALUE_ARRAY_ITEMS,
  MAX_VALUE_DEPTH,
  MAX_VALUE_KEY_LENGTH,
  MAX_VALUE_OBJECT_ENTRIES,
  MAX_VALUE_STRING_LENGTH,
  createBrowserReceipt,
  isAuthoritativeSuccess,
  type BrowserReceiptInput,
  type BrowserReceiptState,
  type OperationReceipt,
} from "../../src/types/receipts";

interface RedactionFixture {
  sentinel: string;
  redacted: string;
  truncated: string;
  vectors: Array<{ name: string; input: string }>;
  safeStrings: string[];
  limits: {
    messageLength: number;
    recoveryActionLength: number;
    diagnosticsCount: number;
    diagnosticLength: number;
    operationLength: number;
    correlationIdLength: number;
    externalResourceIdLength: number;
    valueDepth: number;
    valueObjectEntries: number;
    valueArrayItems: number;
    valueKeyLength: number;
    valueStringLength: number;
  };
}

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), "tests", "fixtures", "receipt-redaction-vectors.json"), "utf8"),
) as RedactionFixture;
const correlationId = "create-flow-1";
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const common = {
  operation: "build",
  correlationId,
  message: "Operation status",
} as const;

describe("browser operation receipt boundary", () => {
  it("exports exactly one browser-only receipt factory", () => {
    expect(
      Object.keys(receipts)
        .filter((name) => name.startsWith("create"))
        .sort(),
    ).toEqual(["createBrowserReceipt"]);
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

  it("rejects desktop states and drops hostile evidence fields", () => {
    expect(() =>
      createBrowserReceipt({ ...common, state: "succeeded" as BrowserReceiptState }),
    ).toThrow("Browser receipts may only be simulated or unavailable");

    const receipt = createBrowserReceipt({
      ...common,
      state: "simulated",
      authoritative: true,
      inputHash: "sha256:authority",
      artifactHash: "sha256:authority",
      externalResourceId: "place-version:42",
    } as unknown as BrowserReceiptInput);

    expect(receipt.authoritative).toBe(false);
    expect(receipt).not.toHaveProperty("inputHash");
    expect(receipt).not.toHaveProperty("artifactHash");
    expect(receipt).not.toHaveProperty("externalResourceId");
  });

  it("uses distinct UUID v4 IDs and terminal RFC3339 timestamps", () => {
    const first = createBrowserReceipt({ ...common, state: "simulated" });
    const second = createBrowserReceipt({ ...common, state: "unavailable" });

    expect(first.operationId).toMatch(UUID_V4);
    expect(second.operationId).toMatch(UUID_V4);
    expect(first.operationId).not.toBe(second.operationId);
    expect(Number.isNaN(Date.parse(first.startedAt))).toBe(false);
    expect(Number.isNaN(Date.parse(first.finishedAt ?? ""))).toBe(false);
  });

  it("applies every shared redaction vector to all browser data surfaces", () => {
    for (const vector of fixture.vectors) {
      const receipt = createBrowserReceipt({
        operation: "publish",
        correlationId,
        state: "unavailable",
        message: vector.input,
        recoveryAction: vector.input,
        diagnostics: [vector.input],
        value: { nested: { [vector.input]: vector.input } },
      });
      const serialized = JSON.stringify(receipt);

      expect(receipt.message, `${vector.name} message`).toBe(
        `[Browser preview] ${fixture.redacted}`,
      );
      expect(receipt.recoveryAction).toBe(fixture.redacted);
      expect(receipt.diagnostics).toEqual([fixture.redacted]);
      expect(serialized).toContain(fixture.redacted);
      expect(serialized, `${vector.name} sentinel`).not.toContain(fixture.sentinel);
      expect(serialized, `${vector.name} raw`).not.toContain(vector.input);
    }
  });

  it("validates browser operation and correlation identifiers with static errors", () => {
    const oversizedOperation = "x".repeat(MAX_OPERATION_LENGTH + 1);
    const oversizedCorrelation = "x".repeat(MAX_CORRELATION_ID_LENGTH + 1);
    for (const operation of ["", "bad operation", oversizedOperation, fixture.vectors[0].input]) {
      expect(() =>
        createBrowserReceipt({ ...common, operation, state: "simulated" }),
      ).toThrow("operation identifier is invalid");
    }
    for (const invalidCorrelation of [
      "",
      "bad correlation",
      oversizedCorrelation,
      fixture.vectors[1].input,
    ]) {
      expect(() =>
        createBrowserReceipt({
          ...common,
          correlationId: invalidCorrelation,
          state: "simulated",
        }),
      ).toThrow("correlation identifier is invalid");
    }
  });

  it("bounds text and recursive value data using the shared limits", () => {
    expect({
      messageLength: MAX_MESSAGE_LENGTH,
      recoveryActionLength: MAX_RECOVERY_ACTION_LENGTH,
      diagnosticsCount: MAX_DIAGNOSTICS,
      diagnosticLength: MAX_DIAGNOSTIC_LENGTH,
      operationLength: MAX_OPERATION_LENGTH,
      correlationIdLength: MAX_CORRELATION_ID_LENGTH,
      externalResourceIdLength: MAX_EXTERNAL_RESOURCE_ID_LENGTH,
      valueDepth: MAX_VALUE_DEPTH,
      valueObjectEntries: MAX_VALUE_OBJECT_ENTRIES,
      valueArrayItems: MAX_VALUE_ARRAY_ITEMS,
      valueKeyLength: MAX_VALUE_KEY_LENGTH,
      valueStringLength: MAX_VALUE_STRING_LENGTH,
    }).toEqual(fixture.limits);

    const long = "z".repeat(MAX_VALUE_STRING_LENGTH + 50);
    const receipt = createBrowserReceipt({
      operation: "analytics",
      correlationId,
      state: "simulated",
      message: long,
      recoveryAction: long,
      diagnostics: Array.from({ length: MAX_DIAGNOSTICS + 5 }, () => long),
      value: {
        long,
        array: Array.from({ length: MAX_VALUE_ARRAY_ITEMS + 5 }, (_, index) => index),
        deep: { a: { b: { c: { d: { e: fixture.sentinel } } } } },
        [fixture.vectors[0].input]: fixture.vectors[0].input,
      },
    });
    const serializedValue = JSON.stringify(receipt.value);

    expect([...receipt.message.replace("[Browser preview] ", "")].length).toBeLessThanOrEqual(
      MAX_MESSAGE_LENGTH,
    );
    expect([...(receipt.recoveryAction ?? "")].length).toBeLessThanOrEqual(
      MAX_RECOVERY_ACTION_LENGTH,
    );
    expect(receipt.diagnostics.length).toBeLessThanOrEqual(MAX_DIAGNOSTICS);
    expect(receipt.diagnostics.every((item) => [...item].length <= MAX_DIAGNOSTIC_LENGTH)).toBe(
      true,
    );
    expect(serializedValue).toContain(fixture.truncated);
    expect(serializedValue).not.toContain(fixture.sentinel);
    assertValueBounds(receipt.value, 0);
    expect(isAuthoritativeSuccess(receipt)).toBe(false);
  });

  it("removes prototype-control keys without inheriting attacker data", () => {
    const hostile = Object.create({ inheritedPollution: fixture.sentinel }) as Record<
      string,
      unknown
    >;
    const prototypeControlEntries = [
      ["__PrOtO__", { prototypePollution: fixture.sentinel }],
      ["PrOtOtYpE", fixture.sentinel],
      ["CONSTRUCTOR", fixture.sentinel],
    ] as const;
    for (const [key, item] of prototypeControlEntries) {
      Object.defineProperty(hostile, key, {
        configurable: true,
        enumerable: true,
        value: item,
        writable: true,
      });
      expect(Object.prototype.hasOwnProperty.call(hostile, key)).toBe(true);
      expect(Object.prototype.propertyIsEnumerable.call(hostile, key)).toBe(true);
    }
    Object.defineProperty(hostile, "safe", {
      configurable: true,
      enumerable: true,
      value: "preserved",
      writable: true,
    });

    const receipt = createBrowserReceipt({
      ...common,
      state: "simulated",
      value: { nested: hostile },
    });
    const value = receipt.value as { nested: Record<string, unknown> };
    const serialized = JSON.stringify(value);

    expect(Object.getPrototypeOf(value)).toBeNull();
    expect(Object.getPrototypeOf(value.nested)).toBeNull();
    const safeKeys = Object.keys(value.nested);
    expect(
      safeKeys.filter((key) =>
        ["__proto__", "prototype", "constructor"].includes(key.toLowerCase()),
      ),
    ).toEqual([]);
    expect(safeKeys.filter((key) => key.startsWith(fixture.redacted))).toHaveLength(3);
    expect(value.nested.safe).toBe("preserved");
    expect(serialized).not.toContain(fixture.sentinel);
    expect(({} as Record<string, unknown>).prototypePollution).toBeUndefined();
    expect(({} as Record<string, unknown>).inheritedPollution).toBeUndefined();
  });

  it("preserves safe strings and keeps the success guard display-only", () => {
    const receipt = createBrowserReceipt({
      operation: "build",
      correlationId,
      state: "simulated",
      message: fixture.safeStrings[0],
      recoveryAction: fixture.safeStrings[0],
      value: { status: fixture.safeStrings[0] },
    });
    expect(receipt.message).toBe(`[Browser preview] ${fixture.safeStrings[0]}`);
    expect(receipt.recoveryAction).toBe(fixture.safeStrings[0]);
    expect(isAuthoritativeSuccess(receipt)).toBe(false);

    const receivedFromRust: OperationReceipt = {
      operationId: "b92aeffb-a527-4197-a48a-d640b6e8b156",
      correlationId,
      operation: "publish",
      state: "succeeded",
      authoritative: true,
      startedAt: "2026-07-14T08:00:00.000Z",
      finishedAt: "2026-07-14T08:00:01.000Z",
      artifactHash:
        "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      message: "Private place version uploaded",
      diagnostics: [],
      retrySafety: "safe",
    };
    expect(isAuthoritativeSuccess(receivedFromRust)).toBe(true);
  });
});

function assertValueBounds(value: unknown, depth: number): void {
  if (depth >= MAX_VALUE_DEPTH) {
    expect(typeof value).toBe("string");
    return;
  }
  if (typeof value === "string") {
    expect([...value].length).toBeLessThanOrEqual(MAX_VALUE_STRING_LENGTH);
  } else if (Array.isArray(value)) {
    expect(value.length).toBeLessThanOrEqual(MAX_VALUE_ARRAY_ITEMS);
    value.forEach((item) => assertValueBounds(item, depth + 1));
  } else if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    expect(entries.length).toBeLessThanOrEqual(MAX_VALUE_OBJECT_ENTRIES);
    for (const [key, item] of entries) {
      expect([...key].length).toBeLessThanOrEqual(MAX_VALUE_KEY_LENGTH);
      assertValueBounds(item, depth + 1);
    }
  }
}
