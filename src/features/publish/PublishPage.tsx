import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FolderCheck,
  Loader2,
  Rocket,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { isTauriRuntime } from "../../lib/isTauriRuntime";
import {
  isOperationUnavailableError,
  robloxAuthorityCommands,
} from "../../services/tauriCommands";
import { useProjectStore } from "../../stores/projectStore";
import type { RobloxPublishReceipt } from "../../types/robloxAuthority";
import type {
  RobloxAuthorityState,
  VerifiedRobloxTarget,
} from "../../types/robloxAuthority";
import { ValidationPanel } from "../validation/ValidationPanel";

const DESKTOP_REQUIRED =
  "Publishing requires RobloxForge Desktop. Browser preview never uploads, authenticates, or reports a publish success.";

type AuthorityStatus = "loading" | "ready" | "unavailable" | "error";
type PublishOutcome =
  | { readonly kind: "succeeded"; readonly receipt: RobloxPublishReceipt }
  | { readonly kind: "partial_success"; readonly receipt: RobloxPublishReceipt }
  | { readonly kind: "outcome_unknown"; readonly receipt?: RobloxPublishReceipt }
  | { readonly kind: "failed"; readonly message: string };

function safeText(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  const normalized = trimmed.toLowerCase();
  const unsafe =
    !trimmed ||
    trimmed.length > 280 ||
    [
      ".roblosecurity",
      "authorization",
      "bearer ",
      "x-api-key",
      "api_key",
      "api key",
      "password",
      "secret",
      "token",
      "response body",
    ].some((marker) => normalized.includes(marker)) ||
    /[a-z]:[\\/]/i.test(trimmed) ||
    trimmed.includes("\\\\");
  return unsafe ? fallback : trimmed;
}

function hasVerifiedPublishKey(authority: RobloxAuthorityState | null): boolean {
  return Boolean(
    authority?.publishCredential.configured &&
      authority.publishCredential.verifiedAt &&
      authority.capabilities.publishExistingPlace.ready,
  );
}

function expectedGameUrl(target: VerifiedRobloxTarget): string {
  return `https://www.roblox.com/games/${target.rootPlaceId}`;
}

function receiptMatchesTarget(
  receipt: RobloxPublishReceipt,
  target: VerifiedRobloxTarget,
): boolean {
  return Boolean(
    receipt.value &&
      receipt.value.targetId === target.id &&
      receipt.value.universeId === target.universeId &&
      receipt.value.rootPlaceId === target.rootPlaceId,
  );
}

export function PublishPage() {
  const {
    project,
    validationIssues,
    validationState,
    validationError,
    fixingIssueId,
    validateProject,
  } = useProjectStore();
  const desktopAtRender = isTauriRuntime();
  const [authorityStatus, setAuthorityStatus] = useState<AuthorityStatus>(
    desktopAtRender ? "loading" : "unavailable",
  );
  const [authority, setAuthority] = useState<RobloxAuthorityState | null>(null);
  const [authorityError, setAuthorityError] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [gameName, setGameName] = useState(project?.name ?? "");
  const [gameDescription, setGameDescription] = useState("");
  const [validatedProjectPath, setValidatedProjectPath] = useState<string | null>(
    null,
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [outcome, setOutcome] = useState<PublishOutcome | null>(null);
  const mountedRef = useRef(true);
  const authorityAttemptRef = useRef(0);
  const validationAttemptRef = useRef(0);
  const publishAttemptRef = useRef(0);
  const latestProjectPathRef = useRef(project?.path ?? null);
  const latestTargetIdRef = useRef(selectedTargetId);

  latestProjectPathRef.current = project?.path ?? null;
  latestTargetIdRef.current = selectedTargetId;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      authorityAttemptRef.current += 1;
      validationAttemptRef.current += 1;
      publishAttemptRef.current += 1;
    };
  }, []);

  const loadAuthority = useCallback(async () => {
    if (!isTauriRuntime()) {
      setAuthority(null);
      setAuthorityStatus("unavailable");
      setAuthorityError(null);
      return;
    }

    const attempt = ++authorityAttemptRef.current;
    setAuthorityStatus("loading");
    setAuthorityError(null);
    try {
      const next = await robloxAuthorityCommands.getState();
      if (
        !mountedRef.current ||
        authorityAttemptRef.current !== attempt ||
        !isTauriRuntime()
      ) {
        return;
      }
      setAuthority(next);
      setSelectedTargetId((current) =>
        next.targets.some((target) => target.id === current)
          ? current
          : (next.targets[0]?.id ?? ""),
      );
      setAuthorityStatus("ready");
    } catch (caught) {
      if (!mountedRef.current || authorityAttemptRef.current !== attempt) return;
      if (isOperationUnavailableError(caught) || !isTauriRuntime()) {
        setAuthorityStatus("unavailable");
        setAuthorityError(null);
      } else {
        setAuthorityStatus("error");
        setAuthorityError(
          safeText(
            caught instanceof Error ? caught.message : undefined,
            "RobloxForge Desktop could not read verified Roblox targets.",
          ),
        );
      }
      setAuthority(null);
    }
  }, []);

  useEffect(() => {
    if (desktopAtRender) void loadAuthority();
  }, [desktopAtRender, loadAuthority]);

  const projectPath = project?.path ?? null;
  useEffect(() => {
    validationAttemptRef.current += 1;
    publishAttemptRef.current += 1;
    setValidatedProjectPath(null);
    setIsPublishing(false);
    setOutcome(null);
    setGameName(project?.name ?? "");
    setGameDescription("");
  }, [projectPath, project?.name]);

  const selectedTarget =
    authority?.targets.find((target) => target.id === selectedTargetId) ?? null;
  const setupReady =
    authorityStatus === "ready" &&
    hasVerifiedPublishKey(authority) &&
    selectedTarget !== null;
  const validationPassedForExactProject =
    project !== null &&
    validatedProjectPath === project.path &&
    validationState === "passed" &&
    fixingIssueId === null &&
    !validationIssues.some((issue) => issue.severity === "error");
  const requiresReconciliation =
    outcome?.kind === "partial_success" || outcome?.kind === "outcome_unknown";

  const checkExactProject = async () => {
    if (
      !project ||
      !setupReady ||
      validationState === "running" ||
      requiresReconciliation
    ) {
      return;
    }
    const ownedPath = project.path;
    const attempt = ++validationAttemptRef.current;
    setValidatedProjectPath(null);
    setOutcome(null);
    const passed = await validateProject();
    if (
      !mountedRef.current ||
      validationAttemptRef.current !== attempt ||
      latestProjectPathRef.current !== ownedPath ||
      !passed
    ) {
      return;
    }

    const current = useProjectStore.getState();
    if (
      current.project?.path === ownedPath &&
      current.validationState === "passed" &&
      current.fixingIssueId === null &&
      !current.validationIssues.some((issue) => issue.severity === "error")
    ) {
      setValidatedProjectPath(ownedPath);
    }
  };

  const handleTargetChange = (targetId: string) => {
    publishAttemptRef.current += 1;
    setSelectedTargetId(targetId);
    setOutcome(null);
  };

  const classifyReceipt = (
    receipt: RobloxPublishReceipt,
    ownedTarget: VerifiedRobloxTarget,
  ): PublishOutcome => {
    if (!receipt.authoritative) {
      return {
        kind: "failed",
        message:
          "RobloxForge Desktop did not return an authoritative publish receipt.",
      };
    }

    if (receipt.state === "succeeded") {
      if (
        !receiptMatchesTarget(receipt, ownedTarget) ||
        receipt.value?.uploadCompleted !== true ||
        receipt.value.metadataCompleted !== true
      ) {
        return {
          kind: "failed",
          message:
            "The Desktop publish receipt did not match the selected verified target.",
        };
      }
      return { kind: "succeeded", receipt };
    }

    if (receipt.state === "partial_success") {
      if (
        !receiptMatchesTarget(receipt, ownedTarget) ||
        receipt.value?.uploadCompleted !== true ||
        receipt.value.metadataCompleted !== false
      ) {
        return {
          kind: "failed",
          message:
            "The Desktop partial-success receipt was incomplete or mismatched.",
        };
      }
      return { kind: "partial_success", receipt };
    }

    if (receipt.state === "outcome_unknown") {
      return { kind: "outcome_unknown", receipt };
    }

    return {
      kind: "failed",
      message: safeText(
        receipt.message,
        "RobloxForge Desktop did not publish this project.",
      ),
    };
  };

  const publishExactProject = async () => {
    const current = useProjectStore.getState();
    if (
      !isTauriRuntime() ||
      !project ||
      !selectedTarget ||
      !setupReady ||
      !validationPassedForExactProject ||
      current.project?.path !== project.path ||
      current.validationState !== "passed" ||
      current.fixingIssueId !== null ||
      current.validationIssues.some((issue) => issue.severity === "error") ||
      isPublishing ||
      requiresReconciliation
    ) {
      return;
    }

    const attempt = ++publishAttemptRef.current;
    const ownedPath = project.path;
    const ownedTarget = selectedTarget;
    setIsPublishing(true);
    setOutcome(null);
    try {
      const receipt = await robloxAuthorityCommands.publishProject({
        projectPath: ownedPath,
        targetId: ownedTarget.id,
        name: gameName.trim() || project.name,
        description: gameDescription.trim(),
      });
      if (
        !mountedRef.current ||
        publishAttemptRef.current !== attempt ||
        latestProjectPathRef.current !== ownedPath ||
        latestTargetIdRef.current !== ownedTarget.id ||
        !isTauriRuntime()
      ) {
        return;
      }
      setOutcome(classifyReceipt(receipt, ownedTarget));
    } catch (caught) {
      if (
        !mountedRef.current ||
        publishAttemptRef.current !== attempt ||
        latestProjectPathRef.current !== ownedPath ||
        latestTargetIdRef.current !== ownedTarget.id
      ) {
        return;
      }
      if (isOperationUnavailableError(caught) || !isTauriRuntime()) {
        setAuthorityStatus("unavailable");
        setOutcome(null);
      } else {
        setOutcome({ kind: "outcome_unknown" });
      }
    } finally {
      if (mountedRef.current && publishAttemptRef.current === attempt) {
        setIsPublishing(false);
      }
    }
  };

  const recoveryAction =
    outcome?.kind === "partial_success" || outcome?.kind === "outcome_unknown"
      ? safeText(
          outcome.receipt?.recoveryAction,
          "Reconcile the target in Creator Dashboard before another publish.",
        )
      : null;

  return (
    <div className="flex h-full flex-col bg-gray-950">
      <div className="border-b border-gray-800/40 px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-600/20">
            <Rocket size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Publish to Roblox</h1>
            <p className="text-sm text-gray-400">
              Validate this project, then publish it to one verified owned game.
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-3xl space-y-5">
          {authorityStatus === "unavailable" ? (
            <div role="alert" className="rounded-2xl border border-amber-800/50 bg-amber-950/25 p-5 text-sm text-amber-200">
              <div className="flex items-start gap-3">
                <AlertTriangle size={19} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Desktop required</p>
                  <p className="mt-1 text-amber-200/80">{DESKTOP_REQUIRED}</p>
                </div>
              </div>
            </div>
          ) : authorityStatus === "loading" ? (
            <div role="status" className="flex items-center gap-2 rounded-2xl border border-gray-800 bg-gray-900/70 p-5 text-sm text-gray-400">
              <Loader2 size={17} className="animate-spin" /> Reading verified targets from Desktop…
            </div>
          ) : authorityStatus === "error" ? (
            <div role="alert" className="rounded-2xl border border-red-900/50 bg-red-950/25 p-5 text-sm text-red-200">
              {authorityError}
            </div>
          ) : null}

          {!project ? (
            <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-8 text-center">
              <FolderCheck size={30} className="mx-auto text-gray-600" />
              <h2 className="mt-3 text-lg font-semibold text-white">No project is open</h2>
              <p className="mt-1 text-sm text-gray-500">
                Create or open a game before publishing.
              </p>
            </div>
          ) : null}

          {project && authorityStatus === "ready" && !setupReady ? (
            <div className="rounded-2xl border border-amber-800/50 bg-amber-950/20 p-5">
              <div className="flex items-start gap-3">
                <Settings size={19} className="mt-0.5 shrink-0 text-amber-300" />
                <div>
                  <h2 className="font-semibold text-amber-100">
                    A verified publish key and target are required
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-amber-200/75">
                    In Settings, save the one-shot publish key and register an
                    existing Roblox universe/root-place pair. Open Cloud cannot
                    create the universe for you.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {project && setupReady && selectedTarget ? (
            <>
              <section className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-400" />
                  <h2 className="font-semibold text-white">1. Verified destination</h2>
                </div>
                <label className="mt-4 block text-xs font-semibold text-gray-300">
                  Verified Roblox target
                  <select
                    aria-label="Verified Roblox target"
                    value={selectedTargetId}
                    onChange={(event) => handleTargetChange(event.target.value)}
                    disabled={isPublishing}
                    className="mt-1.5 w-full rounded-xl border border-gray-700/60 bg-gray-950/60 px-3 py-3 text-sm text-white outline-none focus:border-indigo-500 disabled:opacity-50"
                  >
                    {authority?.targets.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-gray-950/50 px-4 py-3 text-xs text-gray-400">
                  <span>Universe {selectedTarget.universeId}</span>
                  <span>Root place {selectedTarget.rootPlaceId}</span>
                  <span>Credential {selectedTarget.publishCredentialAlias}</span>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-6">
                <div className="flex items-center gap-2">
                  <FolderCheck size={18} className="text-indigo-400" />
                  <h2 className="font-semibold text-white">2. Exact local project</h2>
                </div>
                <p className="mt-3 text-xs text-gray-500">Desktop will build and validate this exact path:</p>
                <code className="mt-1 block overflow-x-auto rounded-xl border border-gray-800 bg-gray-950/70 px-4 py-3 text-xs text-indigo-200">
                  {project.path}
                </code>
                <div className="mt-4 grid gap-3">
                  <label className="text-xs font-semibold text-gray-300">
                    Roblox game name
                    <input
                      aria-label="Roblox game name"
                      value={gameName}
                      onChange={(event) => setGameName(event.target.value)}
                      disabled={isPublishing}
                      maxLength={50}
                      className="mt-1.5 w-full rounded-xl border border-gray-700/60 bg-gray-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                  </label>
                  <label className="text-xs font-semibold text-gray-300">
                    Roblox description
                    <textarea
                      aria-label="Roblox description"
                      value={gameDescription}
                      onChange={(event) => setGameDescription(event.target.value)}
                      disabled={isPublishing}
                      maxLength={1_000}
                      rows={3}
                      className="mt-1.5 w-full resize-none rounded-xl border border-gray-700/60 bg-gray-950/60 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => void checkExactProject()}
                  disabled={
                    validationState === "running" ||
                    fixingIssueId !== null ||
                    isPublishing ||
                    requiresReconciliation
                  }
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {validationState === "running" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={16} />
                  )}
                  Check this exact project
                </button>
              </section>

              {validationState !== "not_run" ? (
                <ValidationPanel
                  issues={validationIssues}
                  state={validationState}
                  error={validationError}
                />
              ) : null}

              <section className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-white">3. Publish with Desktop authority</h2>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      No automatic retry occurs. Rust owns validation, target lookup,
                      upload, metadata, and the final receipt.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void publishExactProject()}
                    disabled={
                      !validationPassedForExactProject ||
                      isPublishing ||
                      requiresReconciliation
                    }
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/20 hover:from-emerald-500 hover:to-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPublishing ? <Loader2 size={17} className="animate-spin" /> : <Rocket size={17} />}
                    {requiresReconciliation
                      ? "Reconciliation required"
                      : isPublishing
                        ? "Publishing…"
                        : "Publish verified target"}
                  </button>
                </div>
              </section>
            </>
          ) : null}

          {outcome?.kind === "succeeded" && selectedTarget ? (
            <div role="status" className="rounded-2xl border border-emerald-800/50 bg-emerald-950/25 p-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={21} className="mt-0.5 shrink-0 text-emerald-300" />
                <div>
                  <h2 className="font-semibold text-emerald-100">Published with Desktop authority</h2>
                  <p className="mt-1 text-sm text-emerald-200/75">
                    Upload and metadata both completed for {selectedTarget.label}.
                  </p>
                  <a
                    href={expectedGameUrl(selectedTarget)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
                  >
                    Open on Roblox <ExternalLink size={15} />
                  </a>
                </div>
              </div>
            </div>
          ) : null}

          {outcome?.kind === "partial_success" ? (
            <div role="alert" className="rounded-2xl border border-amber-700/60 bg-amber-950/30 p-6 text-amber-100">
              <h2 className="font-semibold">Upload complete — metadata needs attention</h2>
              <p className="mt-2 text-sm text-amber-200/80">
                The place upload is known to have completed, but metadata did not.
                Do not publish again until you reconcile this target.
              </p>
              <p className="mt-2 text-sm font-medium">{recoveryAction}</p>
            </div>
          ) : null}

          {outcome?.kind === "outcome_unknown" ? (
            <div role="alert" className="rounded-2xl border border-red-800/60 bg-red-950/30 p-6 text-red-100">
              <h2 className="font-semibold">Publish outcome is unknown</h2>
              <p className="mt-2 text-sm text-red-200/80">
                Do not publish again yet. A transport interruption, rate limit, or
                server failure can leave the external upload outcome ambiguous.
              </p>
              <p className="mt-2 text-sm font-medium">{recoveryAction}</p>
            </div>
          ) : null}

          {outcome?.kind === "failed" ? (
            <div role="alert" className="rounded-2xl border border-red-800/60 bg-red-950/30 p-6 text-red-100">
              <h2 className="font-semibold">Publish was not completed</h2>
              <p className="mt-2 text-sm text-red-200/80">{outcome.message}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
