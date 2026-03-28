import { useState, useEffect } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useAuthStore } from "../../stores/authStore";
import { publishCommands } from "../../services/tauriCommands";
import {
  LogIn,
  LogOut,
  CheckCircle,
  Rocket,
  Loader2,
  ExternalLink,
  Settings,
  ShieldCheck,
  PartyPopper,
  Upload,
  Copy,
  Check,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { ValidationPanel } from "../validation/ValidationPanel";

type PublishStep = "auth" | "settings" | "validate" | "publish" | "success";
type PublishPhase = "idle" | "building" | "uploading" | "metadata" | "done" | "error";

const PHASE_LABELS: Record<PublishPhase, string> = {
  idle: "Ready",
  building: "Building .rbxl...",
  uploading: "Uploading to Roblox...",
  metadata: "Setting game info...",
  done: "Published!",
  error: "Failed",
};

const PHASE_PROGRESS: Record<PublishPhase, number> = {
  idle: 0,
  building: 1,
  uploading: 2,
  metadata: 3,
  done: 3,
  error: 0,
};

function isNumericId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export function PublishPage() {
  const { project, validationIssues, validateProject } = useProjectStore();
  const { auth, isConnecting, startLogin, logout, checkAuth } = useAuthStore();
  const [step, setStep] = useState<PublishStep>("auth");
  const [gameName, setGameName] = useState("");
  const [gameDescription, setGameDescription] = useState("");
  const [universeId, setUniverseId] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishPhase, setPublishPhase] = useState<PublishPhase>("idle");
  const [publishResult, setPublishResult] = useState<{
    gameUrl?: string;
    versionNumber?: number;
    error?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Auto-skip auth if already connected
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (auth && step === "auth") {
      setStep("settings");
    }
  }, [auth, step]);

  const stepConfig = [
    { key: "auth" as const, label: "Log In", icon: LogIn },
    { key: "settings" as const, label: "Details", icon: Settings },
    { key: "validate" as const, label: "Check", icon: ShieldCheck },
    { key: "publish" as const, label: "Go Live", icon: Rocket },
  ];

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-gray-400">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-800/60">
          <Upload size={28} className="text-gray-600" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-300">Nothing to share yet</p>
          <p className="mt-1 text-sm text-gray-500">Build a game first, then come back here to publish it!</p>
        </div>
      </div>
    );
  }

  const universeIdValid = universeId.trim() === "" || isNumericId(universeId);
  const placeIdValid = placeId.trim() === "" || isNumericId(placeId);
  const canProceedToValidate =
    universeId.trim().length > 0 &&
    placeId.trim().length > 0 &&
    isNumericId(universeId) &&
    isNumericId(placeId);

  const handlePublish = async () => {
    if (!universeId || !placeId) return;
    setIsPublishing(true);
    setPublishResult(null);
    setPublishPhase("building");

    try {
      // Simulate phase progression (the backend does all 3 steps in one call)
      const phaseTimer1 = setTimeout(() => setPublishPhase("uploading"), 800);
      const phaseTimer2 = setTimeout(() => setPublishPhase("metadata"), 2000);

      const result = await publishCommands.publishGame(
        project.path,
        gameName || project.name,
        gameDescription,
        universeId.trim(),
        placeId.trim(),
      );

      clearTimeout(phaseTimer1);
      clearTimeout(phaseTimer2);

      setPublishResult({
        gameUrl: result.gameUrl,
        versionNumber: result.versionNumber,
        error: result.error,
      });

      if (result.success) {
        setPublishPhase("done");
        setStep("success");
      } else {
        setPublishPhase("error");
      }
    } catch (e) {
      setPublishResult({ error: String(e) });
      setPublishPhase("error");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopyUrl = () => {
    if (publishResult?.gameUrl) {
      navigator.clipboard.writeText(publishResult.gameUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePublishAgain = () => {
    setPublishResult(null);
    setPublishPhase("idle");
    setStep("settings");
  };

  return (
    <div className="flex h-full flex-col bg-gray-950">
      <div className="border-b border-gray-800/40 px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-600/20">
            <Rocket size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Share Your Game</h1>
            <p className="text-sm text-gray-400">Publish to Roblox so everyone can play!</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1">
            {stepConfig.map((s, i) => {
              const Icon = s.icon;
              const isActive = step === s.key;
              const stepIndex = stepConfig.findIndex((sc) => sc.key === step);
              const isDone = i < stepIndex || step === "success";
              return (
                <div key={s.key} className="flex items-center gap-1">
                  {i > 0 && (
                    <div className={`h-px w-6 ${isDone ? "bg-indigo-500" : "bg-gray-800"}`} />
                  )}
                  <div
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-medium transition-all ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                        : isDone
                          ? "bg-indigo-900/30 text-indigo-300"
                          : "bg-gray-800/60 text-gray-500"
                    }`}
                  >
                    {isDone ? <CheckCircle size={14} /> : <Icon size={14} />}
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Auth step */}
          {step === "auth" && (
            <div className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-6">
              <h3 className="text-lg font-bold text-white">Log In to Roblox</h3>
              <p className="mt-1 text-sm text-gray-400">
                Connect your Roblox account so we can publish your game.
              </p>
              {auth ? (
                <div className="mt-4 flex items-center justify-between rounded-xl bg-gray-800/60 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600/20">
                      <CheckCircle size={20} className="text-green-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{auth.displayName}</p>
                      <p className="text-sm text-gray-400">@{auth.username}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={logout}
                      className="rounded-xl bg-gray-700 px-3 py-2 text-sm hover:bg-gray-600"
                    >
                      <LogOut size={14} />
                    </button>
                    <button
                      onClick={() => setStep("settings")}
                      className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={startLogin}
                  disabled={isConnecting}
                  className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isConnecting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <LogIn size={18} />
                  )}
                  {isConnecting ? "Connecting..." : "Log In with Roblox"}
                </button>
              )}
            </div>
          )}

          {/* Settings step */}
          {step === "settings" && (
            <div className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-6">
              <h3 className="text-lg font-bold text-white">Game Details</h3>
              <p className="mt-1 text-sm text-gray-400">Tell players what your game is about!</p>
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-gray-300">
                    Game Name
                  </label>
                  <input
                    type="text"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    placeholder={project.name}
                    className="w-full rounded-xl border border-gray-700/50 bg-gray-800/60 px-4 py-3 text-white outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-gray-300">
                    Description
                  </label>
                  <textarea
                    value={gameDescription}
                    onChange={(e) => setGameDescription(e.target.value)}
                    placeholder="An awesome game built with RobloxForge!"
                    rows={3}
                    className="w-full rounded-xl border border-gray-700/50 bg-gray-800/60 px-4 py-3 text-white outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-gray-300">
                    Universe ID
                  </label>
                  <input
                    type="text"
                    value={universeId}
                    onChange={(e) => setUniverseId(e.target.value)}
                    placeholder="e.g. 1234567890"
                    className={`w-full rounded-xl border px-4 py-3 text-white outline-none focus:ring-2 ${
                      !universeIdValid
                        ? "border-red-500/50 bg-red-950/20 focus:border-red-500/50 focus:ring-red-500/20"
                        : "border-gray-700/50 bg-gray-800/60 focus:border-indigo-500/50 focus:ring-indigo-500/20"
                    }`}
                  />
                  {!universeIdValid && (
                    <p className="mt-1 text-xs text-red-400">Universe ID must be a number</p>
                  )}
                  <p className="mt-1.5 text-xs text-gray-500">
                    Go to{" "}
                    <a
                      href="https://create.roblox.com/dashboard/creations"
                      target="_blank"
                      rel="noopener"
                      className="text-indigo-400 hover:text-indigo-300"
                    >
                      create.roblox.com/dashboard/creations
                    </a>
                    {" "}→ click your experience → copy the number from the URL.
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-gray-300">
                    Place ID
                  </label>
                  <input
                    type="text"
                    value={placeId}
                    onChange={(e) => setPlaceId(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className={`w-full rounded-xl border px-4 py-3 text-white outline-none focus:ring-2 ${
                      !placeIdValid
                        ? "border-red-500/50 bg-red-950/20 focus:border-red-500/50 focus:ring-red-500/20"
                        : "border-gray-700/50 bg-gray-800/60 focus:border-indigo-500/50 focus:ring-indigo-500/20"
                    }`}
                  />
                  {!placeIdValid && (
                    <p className="mt-1 text-xs text-red-400">Place ID must be a number</p>
                  )}
                  <p className="mt-1.5 text-xs text-gray-500">
                    Found under your experience → Places → Start Place.
                  </p>
                </div>
                <div className="flex justify-between pt-2">
                  <button
                    onClick={() => setStep("auth")}
                    className="rounded-xl bg-gray-800 px-5 py-2.5 text-sm text-gray-300 hover:bg-gray-700"
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      await validateProject();
                      setStep("validate");
                    }}
                    disabled={!canProceedToValidate}
                    className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Check My Game
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Validate step */}
          {step === "validate" && (
            <div className="space-y-4">
              <ValidationPanel issues={validationIssues} />

              {/* Publish progress bar */}
              {isPublishing && (
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-indigo-300">
                    <Loader2 size={14} className="animate-spin" />
                    {PHASE_LABELS[publishPhase]}
                  </div>
                  <div className="mt-3 flex gap-1">
                    {[1, 2, 3].map((seg) => (
                      <div
                        key={seg}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${
                          seg <= PHASE_PROGRESS[publishPhase]
                            ? "bg-indigo-500"
                            : "bg-gray-800"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Error inline */}
              {publishResult?.error && !isPublishing && (
                <div className="flex items-start gap-3 rounded-xl border border-red-900/40 bg-red-950/20 p-4">
                  <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-300">Publish failed</p>
                    <p className="mt-1 text-xs text-red-400/80">{publishResult.error}</p>
                  </div>
                  <button
                    onClick={handlePublish}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-red-600/20 px-3 py-1.5 text-[11px] font-semibold text-red-300 hover:bg-red-600/30"
                  >
                    <RotateCcw size={12} /> Retry
                  </button>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep("settings")}
                  className="rounded-xl bg-gray-800 px-5 py-2.5 text-sm text-gray-300 hover:bg-gray-700"
                >
                  Back
                </button>
                {!isPublishing && !publishResult?.error && (
                  <button
                    onClick={handlePublish}
                    disabled={
                      isPublishing ||
                      validationIssues.some((i) => i.severity === "error")
                    }
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-7 py-3 text-[15px] font-bold text-white shadow-lg shadow-green-600/20 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50"
                  >
                    <Rocket size={18} />
                    Publish to Roblox!
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Success step */}
          {step === "success" && (
            <div className="rounded-2xl border border-green-900/40 bg-green-950/20 p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-xl shadow-green-600/20">
                <PartyPopper size={28} className="text-white" />
              </div>
              <h3 className="mt-5 text-2xl font-bold text-white">Your Game is Live!</h3>
              <p className="mt-2 text-gray-400">
                Awesome! Players can now find and play your game on Roblox.
              </p>
              {publishResult?.versionNumber && (
                <p className="mt-1 text-sm text-gray-500">
                  Version {publishResult.versionNumber}
                </p>
              )}

              {publishResult?.gameUrl && (
                <div className="mt-5 flex items-center justify-center gap-2">
                  <a
                    href={publishResult.gameUrl}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-7 py-3 font-semibold shadow-lg shadow-indigo-600/20 hover:bg-indigo-500"
                  >
                    Open on Roblox <ExternalLink size={16} />
                  </a>
                  <button
                    onClick={handleCopyUrl}
                    className="flex items-center gap-1.5 rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-gray-300 hover:bg-gray-700"
                  >
                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    {copied ? "Copied!" : "Copy Link"}
                  </button>
                </div>
              )}

              <button
                onClick={handlePublishAgain}
                className="mt-6 inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-800/60 px-5 py-2.5 text-sm text-gray-300 hover:bg-gray-700"
              >
                <RotateCcw size={14} /> Publish Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
