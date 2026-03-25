import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mountain, Factory, Zap, Swords, Map, Ghost, Car, Dice1, Clock, Trash2 } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { useUserStore } from "../../stores/userStore";

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  available: boolean;
  color: string;
}

interface RecentProject {
  name: string;
  template: string;
  path: string;
  createdAt: string;
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
    available: true,
    color: "bg-purple-600",
  },
  {
    id: "battlegrounds",
    name: "Battlegrounds",
    description: "PvP combat with abilities, classes, and epic battles.",
    icon: Swords,
    available: true,
    color: "bg-red-600",
  },
  {
    id: "rpg",
    name: "RPG",
    description: "Adventure with quests, leveling, gear, and a world to explore.",
    icon: Map,
    available: true,
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

const TEMPLATE_ICON_MAP: Record<string, React.ElementType> = {
  obby: Mountain,
  tycoon: Factory,
  simulator: Zap,
  battlegrounds: Swords,
  rpg: Map,
  horror: Ghost,
  racing: Car,
  minigames: Dice1,
};

const TEMPLATE_COLOR_MAP: Record<string, string> = {
  obby: "bg-green-600",
  tycoon: "bg-yellow-600",
  simulator: "bg-purple-600",
  battlegrounds: "bg-red-600",
  rpg: "bg-blue-600",
  horror: "bg-gray-600",
  racing: "bg-orange-600",
  minigames: "bg-pink-600",
};

function getRecentProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem("roblox-forge-recent");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentProject(project: RecentProject) {
  const existing = getRecentProjects().filter((p) => p.path !== project.path);
  const updated = [project, ...existing].slice(0, 8);
  localStorage.setItem("roblox-forge-recent", JSON.stringify(updated));
}

function removeRecentProject(path: string) {
  const updated = getRecentProjects().filter((p) => p.path !== path);
  localStorage.setItem("roblox-forge-recent", JSON.stringify(updated));
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime() || parseInt(dateStr) * 1000;
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function TemplateSelector() {
  const navigate = useNavigate();
  const { project, createProject, isLoading } = useProjectStore();
  const { profile } = useUserStore();
  const [projectName, setProjectName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [showNameInput, setShowNameInput] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>(getRecentProjects);

  const handleTemplateClick = (template: Template) => {
    if (!template.available) return;
    setSelectedTemplate(template.id);
    setShowNameInput(true);
  };

  const handleCreate = async () => {
    if (!selectedTemplate || !projectName.trim()) return;
    await createProject(selectedTemplate, projectName.trim());
    saveRecentProject({
      name: projectName.trim(),
      template: selectedTemplate,
      path: `browser-dev://${projectName.trim().replace(/[^a-zA-Z0-9_-]/g, "_")}`,
      createdAt: new Date().toISOString(),
    });
    setRecentProjects(getRecentProjects());
    navigate("/build");
  };

  const handleOpenRecent = async (recent: RecentProject) => {
    await createProject(recent.template, recent.name);
    navigate("/build");
  };

  const handleRemoveRecent = (path: string) => {
    removeRecentProject(path);
    setRecentProjects(getRecentProjects());
  };

  // If there's already an open project, show a "Continue" card
  const hasOpenProject = !!project;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-800 px-8 py-6">
        <h1 className="text-3xl font-bold">
          {profile.displayName ? `Hey ${profile.displayName}!` : "What do you want to build?"}
        </h1>
        <p className="mt-2 text-gray-400">
          Pick a game type and AI will help you build it from scratch.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {/* Continue current project */}
        {hasOpenProject && (
          <div className="mb-8">
            <button
              onClick={() => navigate("/build")}
              className="flex w-full items-center gap-4 rounded-xl border border-indigo-800/60 bg-indigo-950/30 p-5 text-left transition-all hover:bg-indigo-950/50"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${TEMPLATE_COLOR_MAP[project!.template] || "bg-indigo-600"}`}>
                {(() => { const Icon = TEMPLATE_ICON_MAP[project!.template] || Mountain; return <Icon size={24} className="text-white" />; })()}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{project!.name}</h3>
                <p className="text-sm text-gray-400">Continue building your {project!.template}</p>
              </div>
              <span className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
                Continue
              </span>
            </button>
          </div>
        )}

        {/* Recent projects */}
        {recentProjects.length > 0 && !hasOpenProject && (
          <div className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-400">
              <Clock size={14} /> Recent Projects
            </h2>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4">
              {recentProjects.map((recent) => {
                const Icon = TEMPLATE_ICON_MAP[recent.template] || Mountain;
                const color = TEMPLATE_COLOR_MAP[recent.template] || "bg-gray-600";
                return (
                  <div
                    key={recent.path}
                    className="group relative flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-900/80 p-3 transition-all hover:border-gray-700"
                  >
                    <button
                      onClick={() => handleOpenRecent(recent)}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
                        <Icon size={16} className="text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-200">{recent.name}</p>
                        <p className="text-[11px] text-gray-500">{recent.template} &middot; {timeAgo(recent.createdAt)}</p>
                      </div>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveRecent(recent.path); }}
                      className="rounded p-1 text-gray-600 opacity-0 transition-opacity hover:bg-gray-800 hover:text-gray-400 group-hover:opacity-100"
                      title="Remove from recents"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* New game heading */}
        {(recentProjects.length > 0 || hasOpenProject) && (
          <h2 className="mb-3 text-sm font-semibold text-gray-400">New Game</h2>
        )}

        {/* Template grid */}
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

      {/* Name input + create button */}
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
                placeholder={selectedTemplate === "tycoon" ? "My Factory Empire" : "My Awesome Obby"}
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
