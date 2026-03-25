import { useState } from "react";
import {
  Palette,
  Flame,
  Snowflake,
  Star,
  TreePine,
  Zap,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useChatStore } from "../../stores/chatStore";

interface GuidedWizardProps {
  projectPath: string;
  onComplete: () => void;
}

type Theme = {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  prompt: string;
};

const themes: Theme[] = [
  { id: "space", name: "Space", icon: Star, color: "bg-indigo-600", prompt: "space-themed with floating asteroids, neon platforms, and starry backgrounds" },
  { id: "lava", name: "Lava", icon: Flame, color: "bg-red-600", prompt: "lava-themed with red hot platforms, lava pools below, and volcanic rocks" },
  { id: "ice", name: "Ice", icon: Snowflake, color: "bg-cyan-600", prompt: "ice-themed with slippery glass platforms, snow effects, and frozen paths" },
  { id: "forest", name: "Forest", icon: TreePine, color: "bg-green-600", prompt: "forest-themed with natural wood platforms, grass, and earthy colors" },
  { id: "neon", name: "Neon City", icon: Zap, color: "bg-purple-600", prompt: "neon city-themed with glowing neon platforms, cyber colors, and futuristic materials" },
  { id: "rainbow", name: "Rainbow", icon: Palette, color: "bg-pink-600", prompt: "rainbow-themed with colorful platforms that cycle through all colors" },
];

const difficulties = [
  { id: "easy", name: "Easy", stages: 3, desc: "Wide platforms, few obstacles — perfect for beginners" },
  { id: "medium", name: "Medium", stages: 5, desc: "Narrower platforms, more kill bricks, moving parts" },
  { id: "hard", name: "Hard", stages: 8, desc: "Tight jumps, spinning obstacles, disappearing blocks" },
  { id: "extreme", name: "Extreme", stages: 12, desc: "One-stud jumps, invisible platforms, everything moves" },
];

const features = [
  { id: "killbricks", name: "Kill Bricks", desc: "Red lava bricks that reset you" },
  { id: "moving", name: "Moving Platforms", desc: "Platforms that slide back and forth" },
  { id: "spinning", name: "Spinning Obstacles", desc: "Rotating bars you have to dodge" },
  { id: "disappearing", name: "Disappearing Blocks", desc: "Platforms that vanish and reappear" },
  { id: "speed", name: "Speed Boosts", desc: "Pads that launch you forward" },
  { id: "trampolines", name: "Trampolines", desc: "Bounce pads for big jumps" },
  { id: "conveyors", name: "Conveyor Belts", desc: "Moving floors that push you" },
  { id: "narrow", name: "Narrow Bridges", desc: "Thin paths over deadly drops" },
];

export function GuidedWizard({ projectPath, onComplete }: GuidedWizardProps) {
  const { sendMessage, isThinking } = useChatStore();
  const [wizardStep, setWizardStep] = useState(0);
  const [theme, setTheme] = useState<string>("space");
  const [difficulty, setDifficulty] = useState<string>("easy");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(["killbricks"]);
  const [gameName, setGameName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleFeature = (id: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    const selectedTheme = themes.find((t) => t.id === theme);
    const selectedDiff = difficulties.find((d) => d.id === difficulty);
    const featureNames = selectedFeatures
      .map((id) => features.find((f) => f.id === id)?.name)
      .filter(Boolean)
      .join(", ");

    const prompt = `Create a ${selectedDiff?.name.toLowerCase()} difficulty obby called "${gameName || "My Obby"}" with ${selectedDiff?.stages} stages. Make it ${selectedTheme?.prompt}. Include these obstacles: ${featureNames}. Make each stage progressively harder and more visually impressive. Add checkpoints at each stage.`;

    await sendMessage(projectPath, prompt);
    setIsGenerating(false);
    onComplete();
  };

  const wizardSteps = [
    { title: "Theme", subtitle: "Pick a vibe for your obby" },
    { title: "Difficulty", subtitle: "How challenging should it be?" },
    { title: "Obstacles", subtitle: "What should players face?" },
    { title: "Generate", subtitle: "Name it and let AI build it!" },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Progress bar */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <Sparkles size={20} className="text-indigo-400" />
          <h3 className="font-semibold">Game Builder Wizard</h3>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {wizardSteps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-6 bg-gray-700" />}
              <div className="flex items-center gap-1.5">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    i === wizardStep
                      ? "bg-indigo-600 text-white"
                      : i < wizardStep
                        ? "bg-green-600 text-white"
                        : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {i < wizardStep ? "\u2713" : i + 1}
                </div>
                <span
                  className={`text-xs ${i === wizardStep ? "text-white" : "text-gray-500"}`}
                >
                  {s.title}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Theme selection */}
        {wizardStep === 0 && (
          <div>
            <h3 className="text-xl font-bold">{wizardSteps[0].subtitle}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {themes.map((t) => {
                const Icon = t.icon;
                const selected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                      selected
                        ? "border-indigo-500 bg-indigo-950/50 ring-2 ring-indigo-500/30"
                        : "border-gray-700 bg-gray-800 hover:border-gray-600"
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${t.color}`}>
                      <Icon size={20} />
                    </div>
                    <span className="font-medium">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Difficulty selection */}
        {wizardStep === 1 && (
          <div>
            <h3 className="text-xl font-bold">{wizardSteps[1].subtitle}</h3>
            <div className="mt-4 space-y-3">
              {difficulties.map((d) => {
                const selected = difficulty === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setDifficulty(d.id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${
                      selected
                        ? "border-indigo-500 bg-indigo-950/50 ring-2 ring-indigo-500/30"
                        : "border-gray-700 bg-gray-800 hover:border-gray-600"
                    }`}
                  >
                    <div>
                      <h4 className="font-semibold">{d.name}</h4>
                      <p className="text-sm text-gray-400">{d.desc}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-gray-700 px-2.5 py-1 text-xs text-gray-300">
                      {d.stages} stages
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Feature selection */}
        {wizardStep === 2 && (
          <div>
            <h3 className="text-xl font-bold">{wizardSteps[2].subtitle}</h3>
            <p className="mt-1 text-sm text-gray-400">Pick as many as you want.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {features.map((f) => {
                const selected = selectedFeatures.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleFeature(f.id)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      selected
                        ? "border-indigo-500 bg-indigo-950/50 text-white"
                        : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <h4 className="text-sm font-semibold">{f.name}</h4>
                    <p className="mt-0.5 text-xs text-gray-500">{f.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Generate */}
        {wizardStep === 3 && (
          <div>
            <h3 className="text-xl font-bold">Name your game</h3>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="My Epic Space Obby"
              autoFocus
              className="mt-4 w-full rounded-xl border border-gray-700 bg-gray-800 px-5 py-3 text-lg text-white placeholder-gray-500 outline-none focus:border-indigo-500"
            />
            <div className="mt-6 rounded-xl bg-gray-800 p-4">
              <h4 className="text-sm font-semibold text-gray-300">Summary</h4>
              <div className="mt-2 space-y-1 text-sm text-gray-400">
                <p>Theme: <span className="text-indigo-300">{themes.find((t) => t.id === theme)?.name}</span></p>
                <p>Difficulty: <span className="text-indigo-300">{difficulties.find((d) => d.id === difficulty)?.name}</span></p>
                <p>Stages: <span className="text-indigo-300">{difficulties.find((d) => d.id === difficulty)?.stages}</span></p>
                <p>Obstacles: <span className="text-indigo-300">{selectedFeatures.map((id) => features.find((f) => f.id === id)?.name).join(", ")}</span></p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-gray-800 px-6 py-4">
        {wizardStep > 0 ? (
          <button
            onClick={() => setWizardStep(wizardStep - 1)}
            className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white"
          >
            <ChevronLeft size={16} /> Back
          </button>
        ) : (
          <button
            onClick={onComplete}
            className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-300"
          >
            Skip wizard
          </button>
        )}

        {wizardStep < 3 ? (
          <button
            onClick={() => setWizardStep(wizardStep + 1)}
            className="flex items-center gap-1 rounded-xl bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-500"
          >
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={isGenerating || isThinking}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 font-semibold text-white hover:bg-green-500 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles size={18} /> Generate My Game
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
