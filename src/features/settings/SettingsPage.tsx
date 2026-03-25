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
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-800 px-8 py-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-gray-400">
          Manage your profile, API keys, and app preferences.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-xl space-y-6">
          {/* Profile section */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <div className="flex items-center gap-3">
              <User size={20} className="text-indigo-400" />
              <h3 className="text-lg font-semibold">Profile</h3>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Display Name
                </label>
                <input
                  type="text"
                  value={profile.displayName}
                  onChange={(e) =>
                    updateProfile({ displayName: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Experience Level
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
                      className={`rounded-lg border p-3 text-left transition-all ${
                        profile.experienceLevel === key
                          ? "border-indigo-500 bg-indigo-950/50"
                          : "border-gray-700 bg-gray-800 hover:border-gray-600"
                      }`}
                    >
                      <p className="text-sm font-semibold">{desc.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {desc.subtitle}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-gray-800 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-300">
                    Guided Wizard Mode
                  </p>
                  <p className="text-xs text-gray-500">
                    Show step-by-step wizard when building
                  </p>
                </div>
                <button
                  onClick={() =>
                    updateProfile({
                      preferGuidedMode: !profile.preferGuidedMode,
                    })
                  }
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    profile.preferGuidedMode ? "bg-indigo-600" : "bg-gray-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      profile.preferGuidedMode
                        ? "translate-x-5.5"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-gray-800 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-300">
                    Show Tooltips
                  </p>
                  <p className="text-xs text-gray-500">
                    Display helpful hints throughout the app
                  </p>
                </div>
                <button
                  onClick={() =>
                    updateProfile({ showTooltips: !profile.showTooltips })
                  }
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    profile.showTooltips ? "bg-indigo-600" : "bg-gray-600"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
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
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <div className="flex items-center gap-3">
              <Key size={20} className="text-indigo-400" />
              <h3 className="text-lg font-semibold">Claude API Key</h3>
            </div>
            <p className="mt-2 text-sm text-gray-400">
              Required for AI-powered game building. Get your key from{" "}
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
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 pr-10 text-white outline-none focus:border-indigo-500"
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
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saved ? (
                  <>
                    <CheckCircle size={16} /> Saved
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
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <div className="flex items-center gap-3">
              <Palette size={20} className="text-indigo-400" />
              <h3 className="text-lg font-semibold">Appearance</h3>
            </div>
            <p className="mt-2 text-sm text-gray-400">
              Theme and display preferences.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button className="rounded-lg border border-indigo-500 bg-indigo-950/50 p-3 text-sm font-medium">
                Dark
              </button>
              <button
                disabled
                className="rounded-lg border border-gray-700 bg-gray-800 p-3 text-sm text-gray-500"
              >
                Light (soon)
              </button>
              <button
                disabled
                className="rounded-lg border border-gray-700 bg-gray-800 p-3 text-sm text-gray-500"
              >
                System (soon)
              </button>
            </div>
          </div>

          {/* Safety */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <div className="flex items-center gap-3">
              <Shield size={20} className="text-indigo-400" />
              <h3 className="text-lg font-semibold">Safety & Content</h3>
            </div>
            <p className="mt-2 text-sm text-gray-400">
              RobloxForge follows Roblox Community Standards. All AI-generated
              content is automatically checked for appropriateness before
              publishing.
            </p>
            <div className="mt-3 rounded-lg bg-green-950/30 border border-green-900/50 px-4 py-3 text-sm text-green-300">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} />
                Content moderation is always active
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6">
            <div className="flex items-center gap-3">
              <RotateCcw size={20} className="text-red-400" />
              <h3 className="text-lg font-semibold text-red-300">
                Reset
              </h3>
            </div>
            <p className="mt-2 text-sm text-gray-400">
              Reset your profile and go through onboarding again. This won't
              delete any projects you've created.
            </p>
            {showResetConfirm ? (
              <div className="mt-4 flex items-center gap-3">
                <p className="text-sm text-red-300">Are you sure?</p>
                <button
                  onClick={handleReset}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500"
                >
                  Yes, Reset
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="rounded-lg bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300 hover:bg-red-950"
              >
                Reset Profile
              </button>
            )}
          </div>

          {/* About */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <div className="flex items-center gap-3">
              <Info size={20} className="text-indigo-400" />
              <h3 className="text-lg font-semibold">About RobloxForge</h3>
            </div>
            <div className="mt-3 space-y-1 text-sm text-gray-400">
              <p>
                Version:{" "}
                <span className="text-gray-300">0.1.0 (Early Access)</span>
              </p>
              <p>
                AI Model:{" "}
                <span className="text-gray-300">Claude Sonnet 4</span>
              </p>
              <p>
                Build System:{" "}
                <span className="text-gray-300">Rojo + Open Cloud API</span>
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:border-gray-600"
              >
                <HelpCircle size={14} /> Help & Docs
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener"
                className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:border-gray-600"
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
