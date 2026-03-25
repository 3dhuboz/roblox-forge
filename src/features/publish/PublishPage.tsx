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

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <p>Create a game first before publishing.</p>
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
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-800 px-8 py-6">
        <h1 className="text-2xl font-bold">Publish to Roblox</h1>
        <p className="mt-1 text-gray-400">
          Connect your account, validate, and go live.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-sm">
            {(["auth", "settings", "validate", "publish"] as const).map(
              (s, i) => (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className="h-px w-8 bg-gray-700" />}
                  <span
                    className={`rounded-full px-3 py-1 ${
                      step === s
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
                  </span>
                </div>
              ),
            )}
          </div>

          {/* Auth step */}
          {step === "auth" && (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <h3 className="text-lg font-semibold">Connect Roblox Account</h3>
              <p className="mt-1 text-sm text-gray-400">
                Sign in with your Roblox account to publish games.
              </p>
              {auth ? (
                <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-800 p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle size={20} className="text-green-400" />
                    <div>
                      <p className="font-medium">{auth.displayName}</p>
                      <p className="text-sm text-gray-400">@{auth.username}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={logout}
                      className="rounded-lg bg-gray-700 px-3 py-1.5 text-sm hover:bg-gray-600"
                    >
                      <LogOut size={14} />
                    </button>
                    <button
                      onClick={() => setStep("settings")}
                      className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium hover:bg-indigo-500"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={startLogin}
                  disabled={isConnecting}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-medium hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isConnecting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <LogIn size={18} />
                  )}
                  {isConnecting ? "Waiting for login..." : "Connect Roblox Account"}
                </button>
              )}
            </div>
          )}

          {/* Settings step */}
          {step === "settings" && (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <h3 className="text-lg font-semibold">Game Settings</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-300">
                    Game Name
                  </label>
                  <input
                    type="text"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    placeholder={project.name}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-300">
                    Description
                  </label>
                  <textarea
                    value={gameDescription}
                    onChange={(e) => setGameDescription(e.target.value)}
                    placeholder="An awesome obby built with RobloxForge!"
                    rows={3}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-300">
                    Universe ID
                  </label>
                  <input
                    type="text"
                    value={universeId}
                    onChange={(e) => setUniverseId(e.target.value)}
                    placeholder="From Roblox Creator Dashboard"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-indigo-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Create an empty experience at create.roblox.com and paste the Universe ID here.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-300">
                    Place ID
                  </label>
                  <input
                    type="text"
                    value={placeId}
                    onChange={(e) => setPlaceId(e.target.value)}
                    placeholder="From Roblox Creator Dashboard"
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex justify-between">
                  <button
                    onClick={() => setStep("auth")}
                    className="rounded-lg bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600"
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      await validateProject();
                      setStep("validate");
                    }}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
                  >
                    Validate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Validate step */}
          {step === "validate" && (
            <div className="space-y-4">
              <ValidationPanel issues={validationIssues} />
              <div className="flex justify-between">
                <button
                  onClick={() => setStep("settings")}
                  className="rounded-lg bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600"
                >
                  Back
                </button>
                <button
                  onClick={handlePublish}
                  disabled={
                    isPublishing ||
                    validationIssues.some((i) => i.severity === "error")
                  }
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-sm font-medium hover:bg-green-500 disabled:opacity-50"
                >
                  {isPublishing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Rocket size={16} />
                  )}
                  {isPublishing ? "Publishing..." : "Publish to Roblox"}
                </button>
              </div>
            </div>
          )}

          {/* Success step */}
          {step === "success" && publishResult?.gameUrl && (
            <div className="rounded-xl border border-green-900/50 bg-green-950/30 p-8 text-center">
              <CheckCircle size={48} className="mx-auto text-green-400" />
              <h3 className="mt-4 text-2xl font-bold">Game Published!</h3>
              <p className="mt-2 text-gray-400">
                Your game is now live on Roblox.
              </p>
              <a
                href={publishResult.gameUrl}
                target="_blank"
                rel="noopener"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 font-medium hover:bg-indigo-500"
              >
                Open on Roblox <ExternalLink size={16} />
              </a>
            </div>
          )}

          {publishResult?.error && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-400">
              {publishResult.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
