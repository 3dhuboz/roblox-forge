export type OperationState =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "partial_success"
  | "unavailable"
  | "simulated";

export type RetrySafety =
  | "safe"
  | "unsafe_without_reconciliation"
  | "not_retryable";

export interface OperationReceipt<T = unknown> {
  readonly operationId: string;
  readonly correlationId: string;
  readonly operation: string;
  readonly state: OperationState;
  readonly authoritative: boolean;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly inputHash?: string;
  readonly artifactHash?: string;
  readonly externalResourceId?: string;
  readonly message: string;
  readonly diagnostics: string[];
  readonly retrySafety: RetrySafety;
  readonly recoveryAction?: string;
  readonly value?: T;
}

export type BrowserReceiptState = "simulated" | "unavailable";

export interface BrowserReceiptInput<T = unknown> {
  readonly state: BrowserReceiptState;
  readonly operation: string;
  readonly correlationId: string;
  readonly message: string;
  readonly diagnostics?: readonly string[];
  readonly recoveryAction?: string;
  readonly value?: T;
}

export const MAX_DIAGNOSTICS = 8;
export const MAX_DIAGNOSTIC_LENGTH = 256;

const REDACTED_DIAGNOSTIC = "[REDACTED: unsafe diagnostic]";

export function createBrowserReceipt<T = unknown>(
  input: BrowserReceiptInput<T>,
): OperationReceipt<T> {
  if (input.state !== "simulated" && input.state !== "unavailable") {
    throw new Error("Browser receipts may only be simulated or unavailable");
  }

  const startedAt = new Date().toISOString();
  return {
    operationId: createUuidV4(),
    correlationId: input.correlationId,
    operation: input.operation,
    state: input.state,
    authoritative: false,
    startedAt,
    finishedAt: startedAt,
    message: `[Browser preview] ${input.message}`,
    diagnostics: sanitizeDiagnostics(input.diagnostics ?? []),
    retrySafety: "not_retryable",
    ...(input.recoveryAction === undefined
      ? {}
      : { recoveryAction: input.recoveryAction }),
    ...(input.value === undefined ? {} : { value: input.value }),
  };
}

/**
 * Classifies a Rust-issued receipt for display only. This JavaScript predicate is
 * never an authorization boundary; privileged gates must use Rust authority.
 */
export function isAuthoritativeSuccess<T>(
  receipt: OperationReceipt<T>,
): boolean {
  return receipt.authoritative === true && receipt.state === "succeeded";
}

function sanitizeDiagnostics(diagnostics: readonly string[]): string[] {
  const safe: string[] = [];
  for (const diagnostic of diagnostics) {
    if (safe.length >= MAX_DIAGNOSTICS) {
      break;
    }

    const trimmed = diagnostic.trim();
    if (trimmed.length === 0) {
      continue;
    }

    safe.push(
      isUnsafeDiagnostic(trimmed)
        ? REDACTED_DIAGNOSTIC
        : [...trimmed].slice(0, MAX_DIAGNOSTIC_LENGTH).join(""),
    );
  }
  return safe;
}

function isUnsafeDiagnostic(diagnostic: string): boolean {
  const lower = diagnostic.toLowerCase();
  const unsafeMarker = [
    "authorization",
    "bearer ",
    "api_key",
    "api key",
    "password",
    "secret",
    "token",
    "response body",
    "response_body",
    "sk-or-",
  ].some((marker) => lower.includes(marker));

  const windowsDrive = /[a-z]:[\\/]/i.test(diagnostic);
  const windowsUnc = diagnostic.includes("\\\\");
  const unixHostPath = ["/users/", "/home/", "/etc/", "/var/", "/tmp/"].some(
    (prefix) => lower.includes(prefix),
  );

  return unsafeMarker || windowsDrive || windowsUnc || unixHostPath;
}

function createUuidV4(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}
