import { useState, useEffect, useCallback, useRef } from "react";
import {
  Key,
  Save,
  CheckCircle,
  User,
  RotateCcw,
  Info,
  Eye,
  EyeOff,
  ExternalLink,
  Palette,
  Shield,
  HelpCircle,
  Radio,
  Play,
  Square,
  Loader2,
} from "lucide-react";
import {
  aiCommands,
  isOperationUnavailableError,
  rojoCommands,
} from "../../services/tauriCommands";
import type { RojoStatus } from "../../services/tauriCommands";
import { useUserStore } from "../../stores/userStore";
import { EXPERIENCE_DESCRIPTIONS } from "../../types/user";
import type { ExperienceLevel } from "../../types/user";
import { isTauriRuntime } from "../../lib/isTauriRuntime";
import { RobloxAuthorityPanel } from "./RobloxAuthorityPanel";

type ApiAuthorityStatus =
  | "checking"
  | "missing"
  | "configured"
  | "saving"
  | "unavailable"
  | "error";

type ApiAuthorityState = {
  status: ApiAuthorityStatus;
  message: string | null;
  provider: string | null;
  recoveryAction: string | null;
};

type RojoAuthorityStatus =
  | "idle"
  | "checking"
  | "ready"
  | "unavailable"
  | "error";

type RojoAuthorityState = {
  status: RojoAuthorityStatus;
  message: string | null;
  recoveryAction: string | null;
};

type AuthorityUiError = {
  status: "unavailable" | "error";
  message: string;
  recoveryAction: string | null;
};

const API_DESKTOP_REQUIRED =
  "AI key management requires the RobloxForge Desktop app. Open the Desktop app to continue.";
const ROJO_DESKTOP_REQUIRED =
  "Advanced Studio Sync can only be managed in RobloxForge Desktop.";

function unavailableApiAuthorityState(): ApiAuthorityState {
  return {
    status: "unavailable",
    message: API_DESKTOP_REQUIRED,
    provider: null,
    recoveryAction: null,
  };
}

function unavailableRojoAuthorityState(): RojoAuthorityState {
  return {
    status: "unavailable",
    message: ROJO_DESKTOP_REQUIRED,
    recoveryAction: null,
  };
}

function providerLabel(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  if (normalized === "openrouter") return "OpenRouter";
  if (normalized === "anthropic") return "Anthropic";
  return "Desktop provider";
}

function safeDisplayMessage(
  message: string,
  fallbackMessage: string,
  sensitiveValues: readonly string[] = [],
): string {
  const trimmed = message.trim();
  const containsCredential =
    /sk-(?:or-|ant-)?[a-z0-9_-]{3,}/i.test(trimmed) ||
    /(?:bearer|password|secret|token|api[_ -]?key)\s*[:=]\s*\S+/i.test(
      trimmed,
    ) ||
    sensitiveValues.some(
      (value) => value.length > 0 && trimmed.includes(value),
    );
  if (!trimmed || containsCredential) return fallbackMessage;
  return [...trimmed].slice(0, 256).join("");
}

function toAuthorityUiError(
  error: unknown,
  fallbackMessage: string,
  sensitiveValues: readonly string[] = [],
): AuthorityUiError {
  if (isOperationUnavailableError(error)) {
    const recoveryAction = error.receipt.recoveryAction;
    return {
      status: "unavailable",
      message: safeDisplayMessage(
        error.message,
        fallbackMessage,
        sensitiveValues,
      ),
      recoveryAction: recoveryAction
        ? safeDisplayMessage(
            recoveryAction,
            "Follow the recovery steps shown in RobloxForge Desktop.",
            sensitiveValues,
          )
        : null,
    };
  }

  return {
    status: "error",
    message:
      error instanceof Error && error.message.trim()
        ? safeDisplayMessage(error.message, fallbackMessage, sensitiveValues)
        : fallbackMessage,
    recoveryAction: null,
  };
}

export function SettingsPage() {
  const { profile, updateProfile, resetProfile } = useUserStore();
  const desktopRuntime = isTauriRuntime();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [apiAuthority, setApiAuthority] = useState<ApiAuthorityState>(() =>
    desktopRuntime
      ? {
          status: "checking",
          message: "Checking AI key in RobloxForge Desktop...",
          provider: null,
          recoveryAction: null,
        }
      : unavailableApiAuthorityState(),
  );
  const [rojoStatus, setRojoStatus] = useState<RojoStatus | null>(null);
  const [rojoLoading, setRojoLoading] = useState(false);
  const [rojoExpanded, setRojoExpanded] = useState(false);
  const [rojoAuthority, setRojoAuthority] = useState<RojoAuthorityState>(
    () => ({ status: "idle", message: null, recoveryAction: null }),
  );
  const mountedRef = useRef(false);
  const apiAttemptIdRef = useRef(0);
  const apiSaveInFlightRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const studioSyncExpandedRef = useRef(false);
  const rojoGenerationRef = useRef(0);
  const rojoOperationSequenceRef = useRef(0);
  const rojoOperationOwnerRef = useRef<number | null>(null);
  const [rojoReconcileTick, setRojoReconcileTick] = useState(0);

  const clearSavedTimer = useCallback(() => {
    if (savedTimerRef.current !== null) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
  }, []);

  const showApiRuntimeUnavailable = useCallback(() => {
    clearSavedTimer();
    setSaved(false);
    setApiAuthority(unavailableApiAuthorityState());
  }, [clearSavedTimer]);

  const showRojoRuntimeUnavailable = useCallback(() => {
    setRojoStatus(null);
    setRojoLoading(false);
    setRojoAuthority(unavailableRojoAuthorityState());
  }, []);

  const refreshRojoStatus = useCallback(async () => {
    if (!isTauriRuntime()) {
      rojoGenerationRef.current += 1;
      showRojoRuntimeUnavailable();
      return;
    }
    if (
      !desktopRuntime ||
      !studioSyncExpandedRef.current ||
      !mountedRef.current ||
      rojoOperationOwnerRef.current !== null
    ) {
      return;
    }
    if (!isTauriRuntime()) { showRojoRuntimeUnavailable(); return; }

    const operationOwner = ++rojoOperationSequenceRef.current;
    rojoOperationOwnerRef.current = operationOwner;
    const generation = rojoGenerationRef.current;
    setRojoLoading(true);
    try {
      const status = await rojoCommands.checkStatus();
      if (!mountedRef.current || generation !== rojoGenerationRef.current || !studioSyncExpandedRef.current) {
        return;
      }
      if (!isTauriRuntime()) {
        showRojoRuntimeUnavailable();
        return;
      }
      setRojoStatus(status);
      setRojoAuthority({
        status: "ready",
        message: null,
        recoveryAction: null,
      });
    } catch (error) {
      if (!mountedRef.current || generation !== rojoGenerationRef.current || !studioSyncExpandedRef.current) {
        return;
      }
      if (!isTauriRuntime()) {
        showRojoRuntimeUnavailable();
        return;
      }
      const uiError = toAuthorityUiError(
        error,
        "RobloxForge Desktop could not check Rojo status.",
      );
      setRojoAuthority(uiError);
    } finally {
      if (rojoOperationOwnerRef.current === operationOwner) rojoOperationOwnerRef.current = null;
      if (mountedRef.current && generation === rojoGenerationRef.current && studioSyncExpandedRef.current) setRojoLoading(false);
      if (mountedRef.current && generation !== rojoGenerationRef.current && studioSyncExpandedRef.current) setRojoReconcileTick((tick) => tick + 1);
    }
  }, [desktopRuntime, showRojoRuntimeUnavailable]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      apiAttemptIdRef.current += 1;
      rojoGenerationRef.current += 1;
      studioSyncExpandedRef.current = false;
      apiSaveInFlightRef.current = false;
      clearSavedTimer();
    };
  }, [clearSavedTimer]);

  useEffect(() => {

    if (desktopRuntime) {
      const attemptId = ++apiAttemptIdRef.current;
      void aiCommands
        .checkApiKey()
        .then((provider) => {
          if (!mountedRef.current || attemptId !== apiAttemptIdRef.current) {
            return;
          }
          if (!isTauriRuntime()) {
            showApiRuntimeUnavailable();
            return;
          }

          if (provider) {
            setApiAuthority({
              status: "configured",
              message: "AI key configured in RobloxForge Desktop.",
              provider: providerLabel(provider),
              recoveryAction: null,
            });
            updateProfile({ hasSetApiKey: true });
          } else {
            setApiAuthority({
              status: "missing",
              message: "No AI key is configured in RobloxForge Desktop.",
              provider: null,
              recoveryAction: null,
            });
          }
        })
        .catch((error: unknown) => {
          if (!mountedRef.current || attemptId !== apiAttemptIdRef.current) {
            return;
          }
          if (!isTauriRuntime()) {
            showApiRuntimeUnavailable();
            return;
          }
          const uiError = toAuthorityUiError(
            error,
            "RobloxForge Desktop could not check the AI key.",
          );
          setApiAuthority({
            ...uiError,
            provider: null,
          });
        });
    }

  }, [
    desktopRuntime,
    showApiRuntimeUnavailable,
    updateProfile,
  ]);

  useEffect(() => {
    if (!rojoExpanded) return;
    if (!desktopRuntime || !isTauriRuntime()) {
      showRojoRuntimeUnavailable();
      return;
    }
    setRojoAuthority({
      status: "checking",
      message: null,
      recoveryAction: null,
    });
    void refreshRojoStatus();
  }, [
    desktopRuntime,
    rojoExpanded,
    rojoReconcileTick,
    refreshRojoStatus,
    showRojoRuntimeUnavailable,
  ]);

  useEffect(() => {
    if (!desktopRuntime || !isTauriRuntime()) {
      rojoGenerationRef.current += 1;
      showRojoRuntimeUnavailable();
    }
  }, [desktopRuntime, showRojoRuntimeUnavailable]);

  const runRojoAction = useCallback(
    async (action: () => Promise<unknown>) => {
      if (!isTauriRuntime()) {
        rojoGenerationRef.current += 1;
        showRojoRuntimeUnavailable();
        return;
      }
      if (
        !desktopRuntime ||
        !studioSyncExpandedRef.current ||
        !mountedRef.current ||
        rojoOperationOwnerRef.current !== null
      ) {
        return;
      }
      if (!isTauriRuntime()) { showRojoRuntimeUnavailable(); return; }

      const operationOwner = ++rojoOperationSequenceRef.current;
      rojoOperationOwnerRef.current = operationOwner;
      const generation = rojoGenerationRef.current;
      setRojoLoading(true);
      try {
        await action();
        if (!mountedRef.current || generation !== rojoGenerationRef.current || !studioSyncExpandedRef.current) {
          return;
        }
        if (!isTauriRuntime()) {
          showRojoRuntimeUnavailable();
          return;
        }

        const status = await rojoCommands.checkStatus();
        if (!mountedRef.current || generation !== rojoGenerationRef.current || !studioSyncExpandedRef.current) {
          return;
        }
        if (!isTauriRuntime()) {
          showRojoRuntimeUnavailable();
          return;
        }
        setRojoStatus(status);
        setRojoAuthority({
          status: "ready",
          message: null,
          recoveryAction: null,
        });
      } catch (error) {
        if (!mountedRef.current || generation !== rojoGenerationRef.current || !studioSyncExpandedRef.current) {
          return;
        }
        if (!isTauriRuntime()) {
          showRojoRuntimeUnavailable();
          return;
        }
        const uiError = toAuthorityUiError(
          error,
          "RobloxForge Desktop could not change Rojo sync.",
        );
        setRojoAuthority(uiError);
      } finally {
        if (rojoOperationOwnerRef.current === operationOwner) rojoOperationOwnerRef.current = null;
        if (mountedRef.current && generation === rojoGenerationRef.current && studioSyncExpandedRef.current) setRojoLoading(false);
        if (mountedRef.current && generation !== rojoGenerationRef.current && studioSyncExpandedRef.current) setRojoReconcileTick((tick) => tick + 1);
      }
    },
    [desktopRuntime, showRojoRuntimeUnavailable],
  );

  const handleStartServe = async () => {
    await runRojoAction(() => rojoCommands.startServe("."));
  };

  const handleStopServe = async () => {
    await runRojoAction(() => rojoCommands.stopServe());
  };

  const handleSaveKey = async () => {
    const trimmedKey = apiKey.trim();
    if (
      !desktopRuntime ||
      !isTauriRuntime() ||
      !trimmedKey ||
      apiSaveInFlightRef.current ||
      !mountedRef.current
    ) {
      return;
    }

    apiSaveInFlightRef.current = true;
    const attemptId = ++apiAttemptIdRef.current;
    clearSavedTimer();
    setSaved(false);
    setApiKey("");
    setApiAuthority({
      status: "saving",
      message: "Saving AI key in RobloxForge Desktop...",
      provider: null,
      recoveryAction: null,
    });
    try {
      await aiCommands.setApiKey(trimmedKey);
      if (!mountedRef.current || attemptId !== apiAttemptIdRef.current) {
        return;
      }
      if (!isTauriRuntime()) {
        showApiRuntimeUnavailable();
        return;
      }
      updateProfile({ hasSetApiKey: true });
      setApiAuthority({
        status: "configured",
        message: "AI key configured in RobloxForge Desktop.",
        provider: "Saved key",
        recoveryAction: null,
      });
      setSaved(true);
      savedTimerRef.current = setTimeout(() => {
        savedTimerRef.current = null;
        if (mountedRef.current && attemptId === apiAttemptIdRef.current) {
          setSaved(false);
        }
      }, 3000);
    } catch (error) {
      if (!mountedRef.current || attemptId !== apiAttemptIdRef.current) {
        return;
      }
      if (!isTauriRuntime()) {
        showApiRuntimeUnavailable();
        return;
      }
      const uiError = toAuthorityUiError(
        error,
        "RobloxForge Desktop could not save the AI key.",
        [trimmedKey],
      );
      setSaved(false);
      setApiAuthority({
        ...uiError,
        provider: null,
      });
    } finally {
      if (attemptId === apiAttemptIdRef.current) {
        apiSaveInFlightRef.current = false;
      }
    }
  };

  const handleReset = () => {
    resetProfile();
    setShowResetConfirm(false);
    window.location.reload();
  };

  return (
    <div className="flex h-full flex-col bg-gray-950">
      <div className="border-b border-gray-800/40 px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-600/20">
            <Palette size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Settings</h1>
            <p className="text-sm text-gray-400">
              Customize how RobloxForge works for you
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-xl space-y-5">
          {/* Profile section */}
          <div className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-6">
            <div className="flex items-center gap-2.5">
              <User size={20} className="text-indigo-400" />
              <h3 className="text-[15px] font-bold text-white">About You</h3>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-gray-300">
                  Your Name
                </label>
                <input
                  type="text"
                  value={profile.displayName}
                  onChange={(e) =>
                    updateProfile({ displayName: e.target.value })
                  }
                  className="w-full rounded-xl border border-gray-700/50 bg-gray-800/60 px-4 py-3 text-white outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[13px] font-semibold text-gray-300">
                  How much do you know about Roblox?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    Object.entries(EXPERIENCE_DESCRIPTIONS) as [
                      ExperienceLevel,
                      (typeof EXPERIENCE_DESCRIPTIONS)[ExperienceLevel],
                    ][]
                  ).map(([key, desc]) => (
                    <button
                      key={key}
                      onClick={() => {
                        updateProfile({
                          experienceLevel: key,
                          preferGuidedMode: key === "beginner",
                          showTooltips: key !== "advanced",
                        });
                      }}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        profile.experienceLevel === key
                          ? "border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500/30"
                          : "border-gray-800/60 bg-gray-800/40 hover:border-gray-700"
                      }`}
                    >
                      <p className="text-[13px] font-bold text-white">
                        {desc.title}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {desc.subtitle}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gray-800/50 px-4 py-3.5">
                <div>
                  <p className="text-[13px] font-semibold text-gray-200">
                    Step-by-Step Builder
                  </p>
                  <p className="text-xs text-gray-500">
                    Walk you through building with a wizard
                  </p>
                </div>
                <button
                  onClick={() =>
                    updateProfile({
                      preferGuidedMode: !profile.preferGuidedMode,
                    })
                  }
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    profile.preferGuidedMode ? "bg-indigo-600" : "bg-gray-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                      profile.preferGuidedMode
                        ? "translate-x-5.5"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gray-800/50 px-4 py-3.5">
                <div>
                  <p className="text-[13px] font-semibold text-gray-200">
                    Show Hints
                  </p>
                  <p className="text-xs text-gray-500">
                    Show helpful tips throughout the app
                  </p>
                </div>
                <button
                  onClick={() =>
                    updateProfile({ showTooltips: !profile.showTooltips })
                  }
                  className={`relative h-7 w-12 rounded-full transition-colors ${
                    profile.showTooltips ? "bg-indigo-600" : "bg-gray-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                      profile.showTooltips
                        ? "translate-x-5.5"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* API Key */}
          <div className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-6">
            <div className="flex items-center gap-2.5">
              <Key size={20} className="text-indigo-400" />
              <h3 className="text-[15px] font-bold text-white">AI Key</h3>
            </div>
            {apiAuthority.status === "configured" ? (
              <div
                className="mt-3 rounded-xl border border-green-900/40 bg-green-950/20 px-4 py-3 text-[13px] text-green-300"
                role="status"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} />
                  {apiAuthority.message}
                  {apiAuthority.provider ? ` (${apiAuthority.provider})` : ""}
                </div>
              </div>
            ) : apiAuthority.status === "checking" ||
              apiAuthority.status === "saving" ? (
              <div
                className="mt-3 flex items-center gap-2 text-[13px] text-gray-400"
                role="status"
              >
                <Loader2 size={14} className="animate-spin" />
                {apiAuthority.message}
              </div>
            ) : apiAuthority.status === "missing" ? (
              <div className="mt-2 space-y-2 text-[13px] text-gray-400">
                <p>{apiAuthority.message}</p>
                <p>
                  Add{" "}
                  <code className="rounded bg-gray-800 px-1.5 py-0.5 text-indigo-300">
                    OPENROUTER_API_KEY
                  </code>{" "}
                  or{" "}
                  <code className="rounded bg-gray-800 px-1.5 py-0.5 text-indigo-300">
                    ANTHROPIC_API_KEY
                  </code>{" "}
                  to your{" "}
                  <code className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-300">
                    .env
                  </code>{" "}
                  file, or paste below.
                </p>
              </div>
            ) : (
              <div
                className="mt-3 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-[13px] text-red-300"
                role="alert"
              >
                <p>{apiAuthority.message}</p>
                {apiAuthority.recoveryAction && (
                  <p className="mt-1 text-red-200">
                    {apiAuthority.recoveryAction}
                  </p>
                )}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <div className="relative flex-1">
                <input
                  aria-label="AI API key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-or-... or sk-ant-..."
                  disabled={
                    !desktopRuntime ||
                    apiAuthority.status === "saving" ||
                    apiAuthority.status === "unavailable"
                  }
                  className="w-full rounded-xl border border-gray-700/50 bg-gray-800/60 px-4 py-3 pr-10 text-white outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  disabled={
                    !desktopRuntime ||
                    apiAuthority.status === "saving" ||
                    apiAuthority.status === "unavailable"
                  }
                  aria-label={showKey ? "Hide AI API key" : "Show AI API key"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                onClick={handleSaveKey}
                disabled={
                  !desktopRuntime ||
                  !apiKey.trim() ||
                  apiAuthority.status === "saving" ||
                  apiAuthority.status === "unavailable"
                }
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {apiAuthority.status === "saving" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Saving...
                  </>
                ) : saved ? (
                  <>
                    <CheckCircle size={16} /> Saved!
                  </>
                ) : (
                  <>
                    <Save size={16} /> Save
                  </>
                )}
              </button>
            </div>
          </div>

          <RobloxAuthorityPanel />

          {/* Advanced Studio Sync */}
          <section
            className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-6"
            role="region"
            aria-labelledby="advanced-studio-sync-heading"
          >
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <Radio size={20} className="text-indigo-400" />
                <h3
                  id="advanced-studio-sync-heading"
                  className="text-[15px] font-bold text-white"
                >
                  Advanced Studio Sync
                </h3>
                <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Optional
                </span>
              </div>
              <button
                type="button"
                aria-expanded={rojoExpanded}
                aria-label={`${rojoExpanded ? "Hide" : "Show"} Advanced Studio Sync`}
                aria-controls="advanced-studio-sync-content"
                onClick={() => {
                  const next = !studioSyncExpandedRef.current;
                    studioSyncExpandedRef.current = next;
                    rojoGenerationRef.current += 1;
                    if (!next) {
                      setRojoStatus(null);
                      setRojoLoading(false);
                      setRojoAuthority({ status: "idle", message: null, recoveryAction: null });
                    }
                  setRojoExpanded(next);
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-gray-800"
              >
                <span aria-hidden="true">{rojoExpanded ? "Hide" : "Show"}</span>
              </button>
            </div>
            <p className="mt-2 text-[13px] text-gray-400">
              Not needed to create, preview, publish, or monitor your game. Open
              this only if you want live synchronization with Roblox Studio.
            </p>

            {rojoExpanded && (
              <div id="advanced-studio-sync-content">
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Rojo live synchronization
                  </p>
                  <button
                    type="button"
                    aria-label="Refresh Rojo status"
                    onClick={refreshRojoStatus}
                    disabled={
                      !desktopRuntime ||
                      rojoLoading ||
                      rojoAuthority.status === "unavailable"
                    }
                    className="rounded-lg p-2 text-gray-500 hover:bg-gray-800 hover:text-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <RotateCcw
                      size={14}
                      className={rojoLoading ? "animate-spin" : undefined}
                    />
                  </button>
                </div>

                {rojoAuthority.status === "error" ||
                rojoAuthority.status === "unavailable" ? (
                  <div
                    className="mt-3 rounded-xl border border-gray-800 bg-gray-950/40 px-4 py-3 text-[13px] text-gray-400"
                    role={
                      rojoAuthority.status === "unavailable"
                        ? "status"
                        : "alert"
                    }
                  >
                    <p>{rojoAuthority.message}</p>
                    {rojoAuthority.recoveryAction && (
                      <p className="mt-1 text-red-200">
                        {rojoAuthority.recoveryAction}
                      </p>
                    )}
                  </div>
                ) : rojoAuthority.status === "ready" && rojoStatus ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between rounded-xl bg-gray-800/50 px-4 py-3">
                      <div>
                        <p className="text-[13px] font-semibold text-gray-200">
                          Rojo Installed
                        </p>
                        <p className="text-xs text-gray-500">
                          {rojoStatus.installed
                            ? (rojoStatus.version ?? "Yes")
                            : "Not found on PATH"}
                        </p>
                      </div>
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${rojoStatus.installed ? "bg-green-400" : "bg-red-400"}`}
                      />
                    </div>

                    {rojoStatus.installed ? (
                      <div className="flex items-center justify-between rounded-xl bg-gray-800/50 px-4 py-3.5">
                        <div>
                          <p className="text-[13px] font-semibold text-gray-200">
                            {rojoStatus.serving ? "Serving" : "Not serving"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {rojoStatus.serving
                              ? `Port ${rojoStatus.serve_port ?? "34872"} — open Studio with Rojo plugin`
                              : "Start to sync changes to Studio"}
                          </p>
                        </div>
                        <button
                          onClick={
                            rojoStatus.serving
                              ? handleStopServe
                              : handleStartServe
                          }
                          disabled={rojoLoading}
                          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold ${
                            rojoStatus.serving
                              ? "bg-red-950/30 text-red-300 hover:bg-red-950/50"
                              : "bg-indigo-600 text-white hover:bg-indigo-500"
                          } disabled:opacity-50`}
                        >
                          {rojoLoading ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : rojoStatus.serving ? (
                            <Square size={14} />
                          ) : (
                            <Play size={14} />
                          )}
                          {rojoStatus.serving ? "Stop" : "Start Sync to Studio"}
                        </button>
                      </div>
                    ) : (
                      <div
                        className="rounded-xl border border-gray-800 bg-gray-950/40 px-4 py-3 text-[13px] text-gray-400"
                        role="status"
                      >
                        <p>
                          Rojo is not installed. That is fine unless you choose
                          live Studio sync.
                        </p>
                        <pre className="mt-2 text-xs text-gray-400 whitespace-pre-wrap">
                          {rojoStatus.install_instructions}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="mt-4 flex items-center gap-2 text-[13px] text-gray-500"
                    role="status"
                  >
                    <Loader2 size={14} className="animate-spin" /> Checking
                    Rojo...
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Appearance */}
          <div className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-6">
            <div className="flex items-center gap-2.5">
              <Palette size={20} className="text-indigo-400" />
              <h3 className="text-[15px] font-bold text-white">Look & Feel</h3>
            </div>
            <p className="mt-2 text-[13px] text-gray-400">
              Choose how the app looks.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button className="rounded-xl border border-indigo-500 bg-indigo-950/40 p-3 text-[13px] font-bold text-white ring-1 ring-indigo-500/30">
                Dark
              </button>
              <button
                disabled
                className="rounded-xl border border-gray-800/60 bg-gray-800/40 p-3 text-[13px] text-gray-500"
              >
                Light (soon)
              </button>
              <button
                disabled
                className="rounded-xl border border-gray-800/60 bg-gray-800/40 p-3 text-[13px] text-gray-500"
              >
                Auto (soon)
              </button>
            </div>
          </div>

          {/* Safety */}
          <div className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-6">
            <div className="flex items-center gap-2.5">
              <Shield size={20} className="text-indigo-400" />
              <h3 className="text-[15px] font-bold text-white">Safety</h3>
            </div>
            <p className="mt-2 text-[13px] text-gray-400">
              Everything the AI creates follows Roblox rules. Content is
              automatically checked to make sure it's safe.
            </p>
            <div className="mt-3 rounded-xl bg-green-950/20 border border-green-900/40 px-4 py-3 text-[13px] text-green-300">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} />
                Safety checks are always on
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-2xl border border-red-900/40 bg-red-950/10 p-6">
            <div className="flex items-center gap-2.5">
              <RotateCcw size={20} className="text-red-400" />
              <h3 className="text-[15px] font-bold text-red-300">Start Over</h3>
            </div>
            <p className="mt-2 text-[13px] text-gray-400">
              This resets your profile and takes you back to the intro screens.
              Don't worry — your games won't be deleted!
            </p>
            {showResetConfirm ? (
              <div className="mt-4 flex items-center gap-3">
                <p className="text-[13px] font-medium text-red-300">
                  Are you sure?
                </p>
                <button
                  onClick={handleReset}
                  className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-500"
                >
                  Yes, Reset
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="rounded-xl bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600"
                >
                  Never mind
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="mt-4 rounded-xl border border-red-800/50 bg-red-950/30 px-5 py-2.5 text-sm font-medium text-red-300 hover:bg-red-950/50"
              >
                Reset Profile
              </button>
            )}
          </div>

          {/* About */}
          <div className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-6">
            <div className="flex items-center gap-2.5">
              <Info size={20} className="text-indigo-400" />
              <h3 className="text-[15px] font-bold text-white">About</h3>
            </div>
            <div className="mt-3 space-y-1.5 text-[13px] text-gray-400">
              <p>
                Version:{" "}
                <span className="font-medium text-gray-300">
                  0.1.0 (Early Access)
                </span>
              </p>
              <p>
                AI:{" "}
                <span className="font-medium text-gray-300">
                  Claude Sonnet 4
                </span>
              </p>
              <p>
                Powered by:{" "}
                <span className="font-medium text-gray-300">
                  Rojo + Roblox Open Cloud
                </span>
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1.5 rounded-xl border border-gray-700/50 bg-gray-800/60 px-3.5 py-2 text-xs text-gray-300 hover:border-gray-600"
              >
                <HelpCircle size={14} /> Help
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1.5 rounded-xl border border-gray-700/50 bg-gray-800/60 px-3.5 py-2 text-xs text-gray-300 hover:border-gray-600"
              >
                <ExternalLink size={14} /> GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
