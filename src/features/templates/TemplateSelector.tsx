import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mountain, Factory, Zap, Swords, Map, Ghost, Car, Dice1 } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  available: boolean;
  color: string;
}

const templates: Template[] = [
  {
    id: "obby",
    name: "Obby",
    description: "Obstacle course with stages, checkpoints, and kill bricks. Jump your way to victory!",
    icon: Mountain,
    available: true,
    color: "bg-green-600",
  },
  {
    id: "tycoon",
    name: "Tycoon",
    description: "Build your empire! Collect resources, buy upgrades, and grow your business.",
    icon: Factory,
    available: true,
    color: "bg-yellow-600",
  },
  {
    id: "simulator",
    name: "Simulator",
    description: "Click, collect, and upgrade! With pets, rebirths, and endless progression.",
    icon: Zap,
    available: false,
    color: "bg-purple-600",
  },
  {
    id: "battlegrounds",
    name: "Battlegrounds",
    description: "PvP combat with abilities, classes, and epic battles.",
    icon: Swords,
    available: false,
    color: "bg-red-600",
  },
  {
    id: "rpg",
    name: "RPG",
    description: "Adventure with quests, leveling, gear, and a world to explore.",
    icon: Map,
    available: false,
    color: "bg-blue-600",
  },
  {
    id: "horror",
    name: "Horror",
    description: "Scary adventures with puzzles, jumpscares, and dark atmospheres.",
    icon: Ghost,
    available: false,
    color: "bg-gray-600",
  },
  {
    id: "racing",
    name: "Racing",
    description: "High-speed vehicle racing with tracks, upgrades, and multiplayer.",
    icon: Car,
    available: false,
    color: "bg-orange-600",
  },
  {
    id: "minigames",
    name: "Minigames",
    description: "A hub of fun mini-games that rotate every round.",
    icon: Dice1,
    available: false,
    color: "bg-pink-600",
  },
];

export function TemplateSelector() {
  const navigate = useNavigate();
  const { createProject, isLoading } = useProjectStore();
  const [projectName, setProjectName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showNameInput, setShowNameInput] = useState(false);

  const handleTemplateClick = (template: Template) => {
    if (!template.available) return;
    setSelectedTemplate(template.id);
    setShowNameInput(true);
  };

  const handleCreate = async () => {
    if (!selectedTemplate || !projectName.trim()) return;
    await createProject(selectedTemplate, projectName.trim());
    navigate("/build");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-8 py-6">
        <h1 className="text-3xl font-bold">
          What do you want to build?
        </h1>
        <p className="mt-2 text-gray-400">
          Pick a game type and AI will help you build it from scratch.
        </p>
      </div>

      {/* Template grid */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {templates.map((template) => {
            const Icon = template.icon;
            const isSelected = selectedTemplate === template.id;
            return (
              <button
                key={template.id}
                onClick={() => handleTemplateClick(template)}
                disabled={!template.available}
                className={`group relative flex flex-col items-start rounded-xl border p-5 text-left transition-all ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-950/50 ring-2 ring-indigo-500"
                    : template.available
                      ? "border-gray-800 bg-gray-900 hover:border-gray-700 hover:bg-gray-850"
                      : "cursor-not-allowed border-gray-800/50 bg-gray-900/50 opacity-50"
                }`}
              >
                {!template.available && (
                  <span className="absolute right-3 top-3 rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
                    Coming Soon
                  </span>
                )}
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-lg ${template.color}`}
                >
                  <Icon size={24} className="text-white" />
                </div>
                <h3 className="mt-3 text-lg font-semibold">{template.name}</h3>
                <p className="mt-1 text-sm text-gray-400 leading-relaxed">
                  {template.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Name input + create button (slides up when template selected) */}
      {showNameInput && (
        <div className="border-t border-gray-800 bg-gray-900 px-8 py-5">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-300">
                Game Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Awesome Obby"
                autoFocus
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={!projectName.trim() || isLoading}
              className="mt-6 rounded-lg bg-indigo-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Start Building"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
