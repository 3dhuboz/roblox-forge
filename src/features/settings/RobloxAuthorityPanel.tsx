import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { isTauriRuntime } from "../../lib/isTauriRuntime";
import {
  isOperationUnavailableError,
  robloxAuthorityCommands,
} from "../../services/tauriCommands";
import { isAuthoritativeSuccess } from "../../types/receipts";
import type {
  CredentialSlotStatus,
  RobloxAuthorityState,
  RobloxCredentialPurpose,
  VerifiedRobloxTarget,
} from "../../types/robloxAuthority";

const DESKTOP_REQUIRED =
  "Roblox publishing setup requires RobloxForge Desktop. Open the Desktop app to configure keys and verified targets.";

type PanelStatus = "loading" | "ready" | "unavailable" | "error";
type CredentialAction = RobloxCredentialPurpose | null;

interface UiError {
  readonly message: string;
  readonly recoveryAction?: string;
}

function hasCredential(
  status: CredentialSlotStatus,
): status is CredentialSlotStatus & { readonly verifiedAt: string } {
  return status.configured && Boolean(status.verifiedAt);
}

function containsSensitiveText(
  value: string,
  sensitiveValues: readonly string[],
): boolean {
  const normalized = value.toLowerCase();
  return (
    sensitiveValues.some(
      (secret) => secret.length > 0 && value.includes(secret),
    ) ||
    [
      ".roblosecurity",
      "authorization",
      "bearer ",
      "x-api-key",
      "api key:",
      "api_key=",
      "password",
      "secret",
    ].some((marker) => normalized.includes(marker))
  );
}

function safeError(
  error: unknown,
  fallback: string,
  sensitiveValues: readonly string[] = [],
): UiError {
  const rawMessage = error instanceof Error ? error.message.trim() : "";
  const message =
    rawMessage && !containsSensitiveText(rawMessage, sensitiveValues)
      ? [...rawMessage].slice(0, 240).join("")
      : fallback;

  if (!isOperationUnavailableError(error)) {
    return { message };
  }

  const rawRecovery = error.receipt.recoveryAction?.trim() ?? "";
  return {
    message,
    ...(rawRecovery && !containsSensitiveText(rawRecovery, sensitiveValues)
      ? { recoveryAction: [...rawRecovery].slice(0, 240).join("") }
      : {}),
  };
}

function validRobloxId(value: string): boolean {
  return /^[1-9]\d*$/.test(value.trim());
}

function CredentialSlot({
  purpose,
  status,
  disabled,
  saving,
  inputRef,
  onSave,
}: {
  readonly purpose: RobloxCredentialPurpose;
  readonly status: CredentialSlotStatus;
  readonly disabled: boolean;
  readonly saving: boolean;
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly onSave: (purpose: RobloxCredentialPurpose) => void;
}) {
  const title = purpose === "publish" ? "Publish key" : "Analytics key";
  const description =
    purpose === "publish"
      ? "Used only by Desktop to verify a target and publish its existing place."
      : "Used only by Desktop to read analytics for games you own.";
  const missing =
    purpose === "publish"
      ? "No verified Roblox publish key."
      : "No verified Roblox analytics key.";

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-100">{title}</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
        </div>
        {hasCredential(status) ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-950/70 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
            <CheckCircle2 size={12} /> Verified
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-gray-400">
        {hasCredential(status)
          ? `${status.alias} is verified for ${purpose}.`
          : missing}
      </p>
      <div className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          aria-label={`Roblox ${purpose} API key`}
          type="password"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled || saving}
          placeholder="Paste once — never stored in this page"
          className="min-w-0 flex-1 rounded-xl border border-gray-700/60 bg-gray-900 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          aria-label={`Save Roblox ${purpose} key`}
          onClick={() => onSave(purpose)}
          disabled={disabled || saving}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
          {saving ? "Verifying" : "Save"}
        </button>
      </div>
    </div>
  );
}

export function RobloxAuthorityPanel() {
  const desktopAtRender = isTauriRuntime();
  const [panelStatus, setPanelStatus] = useState<PanelStatus>(
    desktopAtRender ? "loading" : "unavailable",
  );
  const [authority, setAuthority] = useState<RobloxAuthorityState | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [credentialAction, setCredentialAction] =
    useState<CredentialAction>(null);
  const [registering, setRegistering] = useState(false);
  const [label, setLabel] = useState("");
  const [universeId, setUniverseId] = useState("");
  const [rootPlaceId, setRootPlaceId] = useState("");
  const publishKeyRef = useRef<HTMLInputElement>(null);
  const analyticsKeyRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const loadAttemptRef = useRef(0);
  const credentialAttemptRef = useRef(0);
  const targetAttemptRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadAttemptRef.current += 1;
      credentialAttemptRef.current += 1;
      targetAttemptRef.current += 1;
    };
  }, []);

  const loadAuthority = useCallback(async () => {
    if (!isTauriRuntime()) {
      setPanelStatus("unavailable");
      setAuthority(null);
      setError(null);
      return;
    }

    const attempt = ++loadAttemptRef.current;
    setPanelStatus("loading");
    setError(null);
    try {
      const next = await robloxAuthorityCommands.getState();
      if (
        !mountedRef.current ||
        loadAttemptRef.current !== attempt ||
        !isTauriRuntime()
      ) {
        return;
      }
      setAuthority(next);
      setPanelStatus("ready");
    } catch (caught) {
      if (!mountedRef.current || loadAttemptRef.current !== attempt) return;
      const unavailable =
        isOperationUnavailableError(caught) || !isTauriRuntime();
      setAuthority(null);
      setPanelStatus(unavailable ? "unavailable" : "error");
      setError(
        unavailable
          ? null
          : safeError(
              caught,
              "RobloxForge Desktop could not read Roblox setup.",
            ),
      );
    }
  }, []);

  useEffect(() => {
    if (desktopAtRender) void loadAuthority();
  }, [desktopAtRender, loadAuthority]);

  const saveCredential = async (purpose: RobloxCredentialPurpose) => {
    const input = purpose === "publish" ? publishKeyRef.current : analyticsKeyRef.current;
    const apiKey = input?.value.trim() ?? "";
    if (input) input.value = "";
    if (!apiKey || !isTauriRuntime() || credentialAction !== null) return;

    const attempt = ++credentialAttemptRef.current;
    setCredentialAction(purpose);
    setError(null);
    try {
      const result = await robloxAuthorityCommands.setApiKey(purpose, apiKey);
      if (
        !mountedRef.current ||
        credentialAttemptRef.current !== attempt ||
        !isTauriRuntime()
      ) {
        return;
      }
      if (
        !isAuthoritativeSuccess(result) ||
        result.value?.purpose !== purpose ||
        !hasCredential(result.value)
      ) {
        setError({
          message:
            "RobloxForge Desktop did not return an authoritative verified-key receipt.",
        });
        return;
      }

      setAuthority((current) => {
        if (!current) return current;
        return purpose === "publish"
          ? { ...current, publishCredential: result.value! }
          : { ...current, analyticsCredential: result.value! };
      });
    } catch (caught) {
      if (!mountedRef.current || credentialAttemptRef.current !== attempt) return;
      setError(
        safeError(
          caught,
          `RobloxForge Desktop could not save the Roblox ${purpose} key.`,
          [apiKey],
        ),
      );
    } finally {
      if (
        mountedRef.current &&
        credentialAttemptRef.current === attempt
      ) {
        setCredentialAction(null);
      }
    }
  };

  const registerTarget = async () => {
    const publishCredential = authority?.publishCredential;
    if (
      !isTauriRuntime() ||
      !publishCredential ||
      !hasCredential(publishCredential) ||
      registering ||
      !label.trim() ||
      !validRobloxId(universeId) ||
      !validRobloxId(rootPlaceId)
    ) {
      return;
    }

    const attempt = ++targetAttemptRef.current;
    const analyticsCredential = authority?.analyticsCredential;
    setRegistering(true);
    setError(null);
    try {
      const result = await robloxAuthorityCommands.registerTarget({
        label: label.trim(),
        universeId: universeId.trim(),
        rootPlaceId: rootPlaceId.trim(),
        publishCredentialAlias: publishCredential.alias,
        ...(analyticsCredential && hasCredential(analyticsCredential)
          ? { analyticsCredentialAlias: analyticsCredential.alias }
          : {}),
      });
      if (
        !mountedRef.current ||
        targetAttemptRef.current !== attempt ||
        !isTauriRuntime()
      ) {
        return;
      }
      if (!isAuthoritativeSuccess(result) || !result.value) {
        setError({
          message:
            "RobloxForge Desktop did not return an authoritative verified-target receipt.",
        });
        return;
      }

      const verifiedTarget = result.value;
      setAuthority((current) =>
        current
          ? {
              ...current,
              targets: [
                ...current.targets.filter(
                  (target) => target.id !== verifiedTarget.id,
                ),
                verifiedTarget,
              ],
            }
          : current,
      );
      setLabel("");
      setUniverseId("");
      setRootPlaceId("");
    } catch (caught) {
      if (!mountedRef.current || targetAttemptRef.current !== attempt) return;
      setError(
        safeError(
          caught,
          "RobloxForge Desktop could not verify this Roblox target.",
        ),
      );
    } finally {
      if (mountedRef.current && targetAttemptRef.current === attempt) {
        setRegistering(false);
      }
    }
  };

  const publishStatus = authority?.publishCredential;
  const analyticsStatus = authority?.analyticsCredential;
  const setupDisabled = panelStatus !== "ready" || !authority;
  const canRegister =
    !setupDisabled &&
    publishStatus !== undefined &&
    hasCredential(publishStatus) &&
    label.trim().length > 0 &&
    validRobloxId(universeId) &&
    validRobloxId(rootPlaceId) &&
    !registering;

  return (
    <section
      aria-labelledby="roblox-authority-heading"
      className="rounded-2xl border border-indigo-900/50 bg-gradient-to-br from-gray-900/90 to-indigo-950/20 p-6"
    >
      <div className="flex items-center gap-2.5">
        <ShieldCheck size={20} className="text-indigo-400" />
        <div>
          <h3 id="roblox-authority-heading" className="text-[15px] font-bold text-white">
            Roblox publish & analytics
          </h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Private-alpha Desktop authority for games you own
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-amber-800/40 bg-amber-950/20 p-4">
        <p className="text-sm font-semibold text-amber-200">One-time Studio bootstrap</p>
        <p className="mt-1 text-xs leading-5 text-amber-200/80">
          Open Cloud cannot create a universe. Create the experience and its start
          place once in Roblox Studio or Creator Dashboard, then enter those IDs
          below. RobloxForge can verify and publish that existing place afterward.
        </p>
      </div>

      {panelStatus === "unavailable" ? (
        <div role="alert" className="mt-4 rounded-xl border border-amber-800/50 bg-amber-950/20 p-4 text-sm text-amber-200">
          {DESKTOP_REQUIRED}
        </div>
      ) : panelStatus === "loading" ? (
        <div role="status" className="mt-4 flex items-center gap-2 text-sm text-gray-400">
          <Loader2 size={15} className="animate-spin" /> Reading Desktop setup…
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          aria-label="Roblox setup error"
          className="mt-4 flex gap-2 rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-200"
        >
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          <div>
            <p>{error.message}</p>
            {error.recoveryAction ? (
              <p className="mt-1 text-xs text-red-200/80">{error.recoveryAction}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        <CredentialSlot
          purpose="publish"
          status={
            publishStatus ?? {
              purpose: "publish",
              configured: false,
              alias: "publish-default",
            }
          }
          disabled={setupDisabled}
          saving={credentialAction === "publish"}
          inputRef={publishKeyRef}
          onSave={(purpose) => void saveCredential(purpose)}
        />
        <CredentialSlot
          purpose="analytics"
          status={
            analyticsStatus ?? {
              purpose: "analytics",
              configured: false,
              alias: "analytics-default",
            }
          }
          disabled={setupDisabled}
          saving={credentialAction === "analytics"}
          inputRef={analyticsKeyRef}
          onSave={(purpose) => void saveCredential(purpose)}
        />
      </div>

      <div className="mt-5 border-t border-gray-800 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-100">Register an owned game</p>
            <p className="mt-1 text-xs text-gray-500">
              Desktop verifies the universe/place relationship and allocates an immutable target ID.
            </p>
          </div>
          <span className="rounded-full bg-gray-800 px-2.5 py-1 text-[11px] text-gray-400">
            No free-form target IDs
          </span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-gray-300 sm:col-span-2">
            Target label
            <input
              aria-label="Roblox target label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              disabled={setupDisabled || registering}
              maxLength={80}
              className="mt-1.5 w-full rounded-xl border border-gray-700/60 bg-gray-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500 disabled:opacity-50"
            />
          </label>
          <label className="text-xs font-semibold text-gray-300">
            Universe ID
            <input
              aria-label="Roblox universe ID"
              inputMode="numeric"
              value={universeId}
              onChange={(event) => setUniverseId(event.target.value)}
              disabled={setupDisabled || registering}
              className="mt-1.5 w-full rounded-xl border border-gray-700/60 bg-gray-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500 disabled:opacity-50"
            />
          </label>
          <label className="text-xs font-semibold text-gray-300">
            Root place ID
            <input
              aria-label="Roblox root place ID"
              inputMode="numeric"
              value={rootPlaceId}
              onChange={(event) => setRootPlaceId(event.target.value)}
              disabled={setupDisabled || registering}
              className="mt-1.5 w-full rounded-xl border border-gray-700/60 bg-gray-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500 disabled:opacity-50"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => void registerTarget()}
          disabled={!canRegister}
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {registering ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
          {registering ? "Verifying…" : "Verify target"}
        </button>
      </div>

      {authority?.targets.length ? (
        <div className="mt-5 space-y-2 border-t border-gray-800 pt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
            Verified immutable targets
          </p>
          {authority.targets.map((target: VerifiedRobloxTarget) => (
            <div key={target.id} className="rounded-xl border border-emerald-900/40 bg-emerald-950/15 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{target.label}</p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
                    <span>Universe {target.universeId}</span>
                    <span>Root place {target.rootPlaceId}</span>
                  </div>
                </div>
                <a
                  href={target.gameUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${target.label} on Roblox`}
                  className="rounded-lg p-2 text-indigo-300 hover:bg-indigo-950/50"
                >
                  <ExternalLink size={15} />
                </a>
              </div>
              <p className="mt-2 text-[11px] text-emerald-300/80">
                Verified by Desktop · immutable target
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
