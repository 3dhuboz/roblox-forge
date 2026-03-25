import { useState } from "react";
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
} from "lucide-react";
import { ValidationPanel } from "../validation/ValidationPanel";

type PublishStep = "auth" | "settings" | "validate" | "publish" | "success";

export function PublishPage() {
  const { project, validationIssues, validateProject } = useProjectStore();
  const { auth, isConnecting, startLogin, logout } = useAuthStore();
  const [step, setStep] = useState<PublishStep>("auth");
  const [gameName, setGameName] = useState("");
  const [gameDescription, setGameDescription] = useState("");
  const [universeId, setUniverseId] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{
    gameUrl?: string;
    error?: string;
  } | null>(null);

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

  const handlePublish = async () => {
    if (!universeId || !placeId) return;
    setIsPublishing(true);
    try {
      const result = await publishCommands.publishGame(
        project.path,
        gameName || project.name,
        gameDescription,
        universeId,
        placeId,
      );
      setPublishResult({
        gameUrl: result.gameUrl,
        error: result.error,
      });
      if (result.success) setStep("success");
    } catch (e) {
      setPublishResult({ error: String(e) });
    } finally {
      setIsPublishing(false);
    }
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
              const stepIndex = stepConfig.findIndex(sc => sc.key === step);
              const isDone = i < stepIndex || step === "success";
              return (
                <div key={s.key} className="flex items-center gap-1">
                  {i > 0 && <div className={`h-px w-6 ${isDone ? "bg-indigo-500" : "bg-gray-800"}`} />}
                  <div className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-medium transition-all ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : isDone
                        ? "bg-indigo-900/30 text-indigo-300"
                        : "bg-gray-800/60 text-gray-500"
                  }`}>
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
                    placeholder="Paste from create.roblox.com"
                    className="w-full rounded-xl border border-gray-700/50 bg-gray-800/60 px-4 py-3 text-white outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <p className="mt-1.5 text-xs text-gray-500">
                    Go to create.roblox.com, make a new experience, and copy the Universe ID from the URL.
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
                    placeholder="Paste from create.roblox.com"
                    className="w-full rounded-xl border border-gray-700/50 bg-gray-800/60 px-4 py-3 text-white outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                  />
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
                    className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold shadow-lg shadow-indigo-600/20 hover:bg-indigo-500"
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
              <div className="flex justify-between pt-2">
                <button
                  onClick={() => setStep("settings")}
                  className="rounded-xl bg-gray-800 px-5 py-2.5 text-sm text-gray-300 hover:bg-gray-700"
                >
                  Back
                </button>
                <button
                  onClick={handlePublish}
                  disabled={
                    isPublishing ||
                    validationIssues.some((i) => i.severity === "error")
                  }
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-7 py-3 text-[15px] font-bold text-white shadow-lg shadow-green-600/20 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50"
                >
                  {isPublishing ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Rocket size={18} />
                  )}
                  {isPublishing ? "Publishing..." : "Publish to Roblox!"}
                </button>
              </div>
            </div>
          )}

          {/* Success step */}
          {step === "success" && publishResult?.gameUrl && (
            <div className="rounded-2xl border border-green-900/40 bg-green-950/20 p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-xl shadow-green-600/20">
                <PartyPopper size={28} className="text-white" />
              </div>
              <h3 className="mt-5 text-2xl font-bold text-white">Your Game is Live!</h3>
              <p className="mt-2 text-gray-400">
                Awesome! Players can now find and play your game on Roblox.
              </p>
              <a
                href={publishResult.gameUrl}
                target="_blank"
                rel="noopener"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-7 py-3 font-semibold shadow-lg shadow-indigo-600/20 hover:bg-indigo-500"
              >
                Open on Roblox <ExternalLink size={16} />
              </a>
            </div>
          )}

          {publishResult?.error && (
            <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-4 text-sm text-red-300">
              Something went wrong: {publishResult.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
