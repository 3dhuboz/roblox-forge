import { useState } from "react";
import {
  Sparkles,
  Users,
  Coins,
  BookOpen,
  Briefcase,
  TrendingUp,
  ChevronRight,
  ChevronLeft,
  Rocket,
  Gamepad2,
  Code,
  Wand2,
} from "lucide-react";
import { useUserStore } from "../../stores/userStore";
import type { ExperienceLevel, AgeRange } from "../../types/user";
import { EXPERIENCE_DESCRIPTIONS, GOAL_OPTIONS } from "../../types/user";

const goalIcons: Record<string, React.ElementType> = {
  sparkles: Sparkles,
  users: Users,
  coins: Coins,
  book: BookOpen,
  briefcase: Briefcase,
  trending: TrendingUp,
};

export function OnboardingFlow() {
  const { updateProfile, completeOnboarding } = useUserStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<ExperienceLevel>("beginner");
  const [age, setAge] = useState<AgeRange>("14-17");
  const [goals, setGoals] = useState<string[]>([]);

  const steps = [
    { title: "Welcome", subtitle: "Let's get to know you" },
    { title: "Experience", subtitle: "How much do you know?" },
    { title: "Goals", subtitle: "What do you want to achieve?" },
    { title: "Ready!", subtitle: "Let's build something amazing" },
  ];

  const canProceed = () => {
    if (step === 0) return name.trim().length > 0;
    return true;
  };

  const handleFinish = () => {
    updateProfile({
      displayName: name.trim(),
      experienceLevel: level,
      ageRange: age,
      goals,
      hasCompletedOnboarding: true,
      preferGuidedMode: level === "beginner",
      showTooltips: level !== "advanced",
    });
    completeOnboarding();
  };

  const toggleGoal = (id: string) => {
    setGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  return (
    <div className="relative z-50 flex h-full w-full items-center justify-center bg-gray-950">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-purple-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-xl px-6">
        {/* Progress dots */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i === step
                  ? "w-10 bg-indigo-500"
                  : i < step
                    ? "w-2 bg-indigo-400"
                    : "w-2 bg-gray-700"
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="rounded-2xl border border-gray-800/60 bg-gray-900/80 p-8">
          {/* Step 0: Welcome + Name */}
          {step === 0 && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-indigo-600/20">
                <Rocket size={36} className="text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white">Welcome to RobloxForge</h1>
              <p className="mt-3 text-[15px] text-gray-400">
                Build awesome Roblox games with AI. Let's get you set up!
              </p>
              <div className="mt-8">
                <label className="mb-2 block text-left text-[13px] font-semibold text-gray-300">
                  What's your name?
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name or username"
                  autoFocus
                  className="w-full rounded-xl border border-gray-700/50 bg-gray-800/60 px-5 py-3.5 text-lg text-white placeholder-gray-500 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canProceed()) setStep(1);
                  }}
                />
              </div>
              <div className="mt-6">
                <label className="mb-2 block text-left text-[13px] font-semibold text-gray-300">
                  How old are you?
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(["14-17", "18-25", "26-40", "40+"] as AgeRange[]).map(
                    (range) => (
                      <button
                        key={range}
                        onClick={() => setAge(range)}
                        className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                          age === range
                            ? "border-indigo-500 bg-indigo-950/40 text-indigo-300 ring-1 ring-indigo-500/30"
                            : "border-gray-800/60 bg-gray-800/40 text-gray-400 hover:border-gray-700"
                        }`}
                      >
                        {range}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Experience Level */}
          {step === 1 && (
            <div>
              <h2 className="text-center text-2xl font-bold text-white">
                How much do you know?
              </h2>
              <p className="mt-2 text-center text-[15px] text-gray-400">
                Pick the one that fits you best!
              </p>
              <div className="mt-8 space-y-3">
                {(
                  Object.entries(EXPERIENCE_DESCRIPTIONS) as [
                    ExperienceLevel,
                    (typeof EXPERIENCE_DESCRIPTIONS)[ExperienceLevel],
                  ][]
                ).map(([key, desc]) => {
                  const icons: Record<ExperienceLevel, React.ElementType> = {
                    beginner: Gamepad2,
                    intermediate: Wand2,
                    advanced: Code,
                  };
                  const iconColors: Record<ExperienceLevel, string> = {
                    beginner: "from-green-500 to-emerald-600",
                    intermediate: "from-indigo-500 to-purple-600",
                    advanced: "from-orange-500 to-red-600",
                  };
                  const Icon = icons[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setLevel(key)}
                      className={`flex w-full items-start gap-4 rounded-xl border p-5 text-left transition-all ${
                        level === key
                          ? "border-indigo-500 bg-indigo-950/40 ring-2 ring-indigo-500/30"
                          : "border-gray-800/60 bg-gray-800/40 hover:border-gray-700"
                      }`}
                    >
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${iconColors[key]} shadow-sm`}
                      >
                        <Icon size={22} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{desc.title}</h3>
                        <p className="text-[13px] text-gray-400">{desc.subtitle}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {desc.detail}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Goals */}
          {step === 2 && (
            <div>
              <h2 className="text-center text-2xl font-bold text-white">
                What do you want to do?
              </h2>
              <p className="mt-2 text-center text-[15px] text-gray-400">
                Tap as many as you want!
              </p>
              <div className="mt-8 grid grid-cols-2 gap-3">
                {GOAL_OPTIONS.map((goal) => {
                  const Icon = goalIcons[goal.icon] || Sparkles;
                  const selected = goals.includes(goal.id);
                  return (
                    <button
                      key={goal.id}
                      onClick={() => toggleGoal(goal.id)}
                      className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                        selected
                          ? "border-indigo-500 bg-indigo-950/40 text-white ring-1 ring-indigo-500/30"
                          : "border-gray-800/60 bg-gray-800/40 text-gray-400 hover:border-gray-700 hover:text-gray-300"
                      }`}
                    >
                      <Icon size={20} className={selected ? "text-indigo-400" : ""} />
                      <span className="text-[13px] font-semibold">{goal.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Ready */}
          {step === 3 && (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-xl shadow-green-600/20">
                <Sparkles size={36} className="text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white">You're all set, {name}!</h2>
              <p className="mt-3 text-[15px] text-gray-400">
                {level === "beginner"
                  ? "We'll walk you through everything. Just tell the AI what you want and we'll build it together!"
                  : level === "intermediate"
                    ? "You'll get helpful suggestions while having the freedom to customize. Ask the AI anything!"
                    : "Full power mode! You'll have access to scripts, properties, and the AI as your co-pilot."}
              </p>
              <div className="mt-6 rounded-xl bg-gray-800/50 p-4 text-left">
                <h4 className="text-[13px] font-bold text-gray-300">
                  Here's your setup:
                </h4>
                <div className="mt-2 space-y-1.5 text-[13px] text-gray-400">
                  <p>
                    Skill:{" "}
                    <span className="font-medium text-indigo-300">
                      {EXPERIENCE_DESCRIPTIONS[level].title}
                    </span>
                  </p>
                  <p>
                    Mode:{" "}
                    <span className="font-medium text-indigo-300">
                      {level === "beginner"
                        ? "Step-by-step builder"
                        : level === "intermediate"
                          ? "Guided with suggestions"
                          : "Full control"}
                    </span>
                  </p>
                  {goals.length > 0 && (
                    <p>
                      Goals:{" "}
                      <span className="font-medium text-indigo-300">
                        {goals
                          .map(
                            (g) =>
                              GOAL_OPTIONS.find((o) => o.id === g)?.label,
                          )
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                <ChevronLeft size={16} /> Back
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="flex items-center gap-1 rounded-xl bg-indigo-600 px-6 py-2.5 font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-3 text-lg font-bold text-white shadow-lg shadow-green-600/20 hover:from-green-500 hover:to-emerald-500"
              >
                <Rocket size={20} /> Let's Go!
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
