import { useState } from "react";
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
} from "lucide-react";
import { aiCommands } from "../../services/tauriCommands";
import { useUserStore } from "../../stores/userStore";
import { EXPERIENCE_DESCRIPTIONS } from "../../types/user";
import type { ExperienceLevel } from "../../types/user";

export function SettingsPage() {
  const { profile, updateProfile, resetProfile } = useUserStore();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleSaveKey = async () => {
    if (!apiKey.trim()) return;
    try {
      await aiCommands.setApiKey(apiKey.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error("Failed to save API key:", e);
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
            <p className="text-sm text-gray-400">Customize how RobloxForge works for you</p>
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
                      <p className="text-[13px] font-bold text-white">{desc.title}</p>
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
            <p className="mt-2 text-[13px] text-gray-400">
              Needed to use the AI builder. Get yours from{" "}
              <a
                href="https://console.anthropic.com"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
              >
                console.anthropic.com <ExternalLink size={12} />
              </a>
            </p>
            <div className="mt-4 flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full rounded-xl border border-gray-700/50 bg-gray-800/60 px-4 py-3 pr-10 text-white outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                onClick={handleSaveKey}
                disabled={!apiKey.trim()}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saved ? (
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
              <h3 className="text-[15px] font-bold text-red-300">
                Start Over
              </h3>
            </div>
            <p className="mt-2 text-[13px] text-gray-400">
              This resets your profile and takes you back to the intro screens.
              Don't worry — your games won't be deleted!
            </p>
            {showResetConfirm ? (
              <div className="mt-4 flex items-center gap-3">
                <p className="text-[13px] font-medium text-red-300">Are you sure?</p>
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
                <span className="font-medium text-gray-300">0.1.0 (Early Access)</span>
              </p>
              <p>
                AI:{" "}
                <span className="font-medium text-gray-300">Claude Sonnet 4</span>
              </p>
              <p>
                Powered by:{" "}
                <span className="font-medium text-gray-300">Rojo + Roblox Open Cloud</span>
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
