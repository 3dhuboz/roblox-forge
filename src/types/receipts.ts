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
export const MAX_MESSAGE_LENGTH = 256;
export const MAX_RECOVERY_ACTION_LENGTH = 256;
export const MAX_OPERATION_LENGTH = 64;
export const MAX_CORRELATION_ID_LENGTH = 128;
export const MAX_EXTERNAL_RESOURCE_ID_LENGTH = 128;
export const MAX_VALUE_DEPTH = 4;
export const MAX_VALUE_OBJECT_ENTRIES = 16;
export const MAX_VALUE_ARRAY_ITEMS = 16;
export const MAX_VALUE_KEY_LENGTH = 64;
export const MAX_VALUE_STRING_LENGTH = 256;

const BROWSER_MESSAGE_PREFIX = "[Browser preview] ";
const REDACTED_TEXT = "[REDACTED]";
const TRUNCATED_VALUE = "[TRUNCATED]";
const PROTOTYPE_CONTROL_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function createBrowserReceipt<T = unknown>(
  input: BrowserReceiptInput<T>,
): OperationReceipt<T> {
  if (input.state !== "simulated" && input.state !== "unavailable") {
    throw new Error("Browser receipts may only be simulated or unavailable");
  }

  const operation = validateIdentifier(
    input.operation,
    MAX_OPERATION_LENGTH,
    "operation identifier is invalid",
  );
  const correlationId = validateIdentifier(
    input.correlationId,
    MAX_CORRELATION_ID_LENGTH,
    "correlation identifier is invalid",
  );
  const startedAt = new Date().toISOString();
  return {
    operationId: createUuidV4(),
    correlationId,
    operation,
    state: input.state,
    authoritative: false,
    startedAt,
    finishedAt: startedAt,
    message: `${BROWSER_MESSAGE_PREFIX}${sanitizeText(
      input.message,
      MAX_MESSAGE_LENGTH - BROWSER_MESSAGE_PREFIX.length,
    )}`,
    diagnostics: sanitizeDiagnostics(input.diagnostics ?? []),
    retrySafety: "not_retryable",
    ...(input.recoveryAction === undefined
      ? {}
      : {
          recoveryAction: sanitizeText(
            input.recoveryAction,
            MAX_RECOVERY_ACTION_LENGTH,
          ),
        }),
    ...(input.value === undefined
      ? {}
      : { value: sanitizeValue(input.value, 0, new WeakSet()) as T }),
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

    safe.push(sanitizeText(trimmed, MAX_DIAGNOSTIC_LENGTH));
  }
  return safe;
}

function validateIdentifier(
  value: string,
  maxLength: number,
  staticError: string,
): string {
  const valid =
    value.length > 0 &&
    value.trim() === value &&
    [...value].length <= maxLength &&
    !isUnsafeText(value) &&
    /^[A-Za-z0-9._:-]+$/.test(value);
  if (!valid) {
    throw new Error(staticError);
  }
  return value;
}

function sanitizeText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  return isUnsafeText(trimmed)
    ? REDACTED_TEXT
    : [...trimmed].slice(0, maxLength).join("");
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth >= MAX_VALUE_DEPTH) {
    return TRUNCATED_VALUE;
  }
  if (typeof value === "string") {
    return sanitizeText(value, MAX_VALUE_STRING_LENGTH);
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (typeof value !== "object") {
    return TRUNCATED_VALUE;
  }
  if (seen.has(value)) {
    return TRUNCATED_VALUE;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const sanitized = value
      .slice(0, MAX_VALUE_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1, seen));
    seen.delete(value);
    return sanitized;
  }

  const sanitized = Object.create(null) as Record<string, unknown>;
  Object.entries(value)
    .slice(0, MAX_VALUE_OBJECT_ENTRIES)
    .forEach(([key, item], index) => {
      const prototypeControlKey = PROTOTYPE_CONTROL_KEYS.has(key.toLowerCase());
      let safeKey = prototypeControlKey
        ? REDACTED_TEXT
        : sanitizeText(key, MAX_VALUE_KEY_LENGTH);
      if (Object.prototype.hasOwnProperty.call(sanitized, safeKey)) {
        safeKey = [...`${safeKey}#${index}`].slice(0, MAX_VALUE_KEY_LENGTH).join("");
      }
      sanitized[safeKey] = prototypeControlKey
        ? REDACTED_TEXT
        : sanitizeValue(item, depth + 1, seen);
    });
  seen.delete(value);
  return sanitized;
}

function isUnsafeText(value: string): boolean {
  const lower = value.toLowerCase();
  const unsafeMarker = [
    ".roblosecurity",
    "cookie:",
    "x-api-key",
    "authorization",
    "bearer ",
    "api_key",
    "api key",
    "password",
    "secret",
    "token",
    "response body",
    "response_body",
    "sk-",
    "sk_live_",
    "sk_test_",
    "sk-or-",
    "pk_live_",
  ].some((marker) => lower.includes(marker));

  const resendCredential = /(?:^|[^a-z0-9_])re_[a-z0-9_-]{8,}/i.test(value);

  const windowsDrive = /[a-z]:[\\/]/i.test(value);
  const windowsUnc = value.includes("\\\\");
  const unixHostPath = [
    "/root/",
    "/users/",
    "/home/",
    "/workspace/",
    "/etc/",
    "/var/",
    "/tmp/",
  ].some((prefix) => lower.includes(prefix));

  return unsafeMarker || resendCredential || windowsDrive || windowsUnc || unixHostPath;
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
