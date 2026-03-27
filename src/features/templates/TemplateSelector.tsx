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
    available: true,
    color: "bg-gray-600",
  },
  {
    id: "racing",
    name: "Racing",
    description: "High-speed vehicle racing with tracks, upgrades, and multiplayer.",
    icon: Car,
    available: true,
    color: "bg-orange-600",
  },
  {
    id: "minigames",
    name: "Minigames",
    description: "A hub of fun mini-games that rotate every round.",
    icon: Dice1,
    available: true,
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

// ── Mini scene illustrations for each template ──

function TemplateScene({ id }: { id: string }) {
  switch (id) {
    case "obby":
      return (
        <div className="absolute inset-0">
          {/* Sky */}
          <div className="absolute inset-0 bg-gradient-to-b from-sky-400 to-green-400/30" />
          {/* Platforms */}
          <div className="absolute bottom-4 left-3 h-3 w-12 rounded bg-indigo-400 shadow-md" />
          <div className="absolute bottom-8 left-16 h-3 w-10 rounded bg-cyan-400 shadow-md" />
          <div className="absolute bottom-14 left-8 h-3 w-14 rounded bg-pink-400 shadow-md" />
          <div className="absolute bottom-10 right-10 h-3 w-10 rounded bg-yellow-400 shadow-md" />
          <div className="absolute bottom-18 right-6 h-3 w-12 rounded bg-purple-400 shadow-md" />
          {/* Kill brick */}
          <div className="absolute bottom-6 left-[45%] h-2 w-6 rounded-sm bg-red-500 shadow" />
          {/* Checkpoint flag */}
          <div className="absolute bottom-3 right-8">
            <div className="h-16 w-0.5 bg-gray-300" />
            <div className="absolute top-0 left-0.5 h-4 w-6 bg-green-400" style={{ clipPath: "polygon(0 0, 100% 20%, 100% 80%, 0 100%)" }} />
          </div>
          {/* Coins */}
          {[20, 40, 55, 70].map((l, i) => (
            <div key={i} className="absolute rounded-full bg-yellow-300 shadow" style={{ width: "6px", height: "6px", bottom: `${16 + i * 6}px`, left: `${l}%` }} />
          ))}
          {/* Character silhouette */}
          <div className="absolute bottom-7 left-4">
            <div className="h-3 w-2 rounded-sm bg-blue-600" />
            <div className="mx-auto -mt-0.5 h-2 w-2 rounded-full bg-yellow-300" />
          </div>
        </div>
      );
    case "tycoon":
      return (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-300/40 to-amber-800/30" />
          {/* Factory building */}
          <div className="absolute bottom-3 left-4 h-14 w-16 rounded-t bg-gray-500/80">
            <div className="absolute -top-3 left-2 h-6 w-3 rounded-t bg-gray-400" />
            <div className="absolute -top-5 left-7 h-8 w-3 rounded-t bg-gray-400" />
            {/* Windows */}
            <div className="absolute bottom-3 left-1.5 grid grid-cols-3 gap-1">
              {[0,1,2,3,4,5].map(i => <div key={i} className="h-2 w-2 rounded-sm bg-yellow-300/70" />)}
            </div>
          </div>
          {/* Machine */}
          <div className="absolute bottom-3 right-8 h-8 w-8 rounded bg-gray-400/80">
            <div className="absolute -top-2 left-2 h-3 w-4 rounded bg-yellow-500" />
          </div>
          {/* Conveyor belt */}
          <div className="absolute bottom-3 left-24 h-1.5 w-20 rounded bg-gray-600">
            {[0,5,10,15].map(i => <div key={i} className="absolute top-0 h-1.5 w-1 bg-gray-500" style={{ left: `${i * 5 + 2}px` }} />)}
          </div>
          {/* Coins falling */}
          {[30, 50, 65, 80].map((l, i) => (
            <div key={i} className="absolute rounded-full bg-yellow-400 shadow-sm" style={{ width: "8px", height: "8px", top: `${20 + i * 12}px`, left: `${l}%` }} />
          ))}
          {/* Dollar signs */}
          <div className="absolute top-3 right-4 text-lg font-bold text-yellow-300/50">$$$</div>
        </div>
      );
    case "simulator":
      return (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-purple-500/40 to-indigo-700/30" />
          {/* Pets */}
          <div className="absolute bottom-6 left-6 h-5 w-5 rounded-full bg-pink-400 shadow">
            <div className="absolute top-1 left-1 h-1 w-1 rounded-full bg-black" />
            <div className="absolute top-1 right-1 h-1 w-1 rounded-full bg-black" />
          </div>
          <div className="absolute bottom-4 left-16 h-6 w-6 rounded-full bg-cyan-400 shadow">
            <div className="absolute top-1.5 left-1 h-1 w-1 rounded-full bg-black" />
            <div className="absolute top-1.5 right-1 h-1 w-1 rounded-full bg-black" />
          </div>
          <div className="absolute bottom-8 right-12 h-7 w-7 rounded-full bg-yellow-400 shadow">
            <div className="absolute top-2 left-1.5 h-1 w-1 rounded-full bg-black" />
            <div className="absolute top-2 right-1.5 h-1 w-1 rounded-full bg-black" />
          </div>
          {/* Coins + gems scattered */}
          {[15, 30, 45, 60, 75, 85].map((l, i) => (
            <div key={i} className={`absolute rounded-full shadow ${i % 3 === 0 ? "bg-purple-400" : "bg-yellow-400"}`}
              style={{ width: i % 3 === 0 ? "7px" : "5px", height: i % 3 === 0 ? "7px" : "5px", top: `${15 + (i * 11) % 40}px`, left: `${l}%` }} />
          ))}
          {/* Sparkle effects */}
          <div className="absolute top-4 left-8 text-white/40 text-xs">✨</div>
          <div className="absolute top-6 right-10 text-white/30 text-sm">✨</div>
          <div className="absolute bottom-12 left-[50%] text-white/40 text-xs">⭐</div>
          {/* Progress bar */}
          <div className="absolute top-3 left-4 right-4 h-2 rounded-full bg-white/10">
            <div className="h-2 w-3/5 rounded-full bg-gradient-to-r from-purple-400 to-pink-400" />
          </div>
        </div>
      );
    case "battlegrounds":
      return (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-red-900/60 to-red-950/40" />
          {/* Arena floor */}
          <div className="absolute bottom-0 inset-x-0 h-10 bg-red-800/40 rounded-t" />
          {/* Arena walls */}
          <div className="absolute bottom-3 left-3 h-12 w-1.5 bg-red-400/60 rounded" />
          <div className="absolute bottom-3 right-3 h-12 w-1.5 bg-red-400/60 rounded" />
          {/* Crossed swords */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-3xl opacity-40">⚔️</div>
          {/* Fighters */}
          <div className="absolute bottom-6 left-8">
            <div className="h-5 w-3 rounded-sm bg-blue-500" />
            <div className="mx-auto -mt-0.5 h-3 w-3 rounded-full bg-blue-300" />
          </div>
          <div className="absolute bottom-6 right-8">
            <div className="h-5 w-3 rounded-sm bg-red-500" />
            <div className="mx-auto -mt-0.5 h-3 w-3 rounded-full bg-red-300" />
          </div>
          {/* Health bars */}
          <div className="absolute top-3 left-4 h-1.5 w-12 rounded bg-gray-800"><div className="h-1.5 w-8 rounded bg-green-500" /></div>
          <div className="absolute top-3 right-4 h-1.5 w-12 rounded bg-gray-800"><div className="h-1.5 w-6 rounded bg-green-500" /></div>
          {/* Impact flash */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-yellow-400/30" />
        </div>
      );
    case "rpg":
      return (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-600/40 to-green-800/30" />
          {/* Castle */}
          <div className="absolute bottom-3 left-4">
            <div className="h-14 w-12 bg-gray-400/80 rounded-t">
              {/* Battlements */}
              <div className="flex gap-1 -mt-1.5">
                <div className="h-2 w-2 bg-gray-400/80" /><div className="h-2 w-2 bg-gray-400/80" /><div className="h-2 w-2 bg-gray-400/80" />
              </div>
            </div>
            {/* Door */}
            <div className="absolute bottom-0 left-3 h-4 w-5 rounded-t-full bg-gray-700" />
          </div>
          {/* Tower */}
          <div className="absolute bottom-3 left-14 h-18 w-5 bg-gray-500/80 rounded-t">
            <div className="absolute -top-2 left-0.5 h-3 w-4 bg-gray-400" style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }} />
          </div>
          {/* Trees */}
          <div className="absolute bottom-3 right-6">
            <div className="mx-auto h-5 w-1 bg-amber-800" />
            <div className="-mt-3 h-5 w-6 rounded-full bg-green-600" />
          </div>
          <div className="absolute bottom-3 right-14">
            <div className="mx-auto h-4 w-1 bg-amber-800" />
            <div className="-mt-2 h-4 w-5 rounded-full bg-green-700" />
          </div>
          {/* Sword icon */}
          <div className="absolute top-3 right-5 text-xl opacity-40">⚔️</div>
          {/* Path */}
          <div className="absolute bottom-0 left-[40%] right-6 h-2 bg-amber-700/30 rounded-t" />
          {/* Stars */}
          <div className="absolute top-2 left-[30%] text-yellow-300/30 text-xs">★</div>
          <div className="absolute top-5 left-[60%] text-yellow-300/20 text-[10px]">★</div>
        </div>
      );
    case "horror":
      return (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-gray-800" />
          {/* Moon */}
          <div className="absolute top-3 right-6 h-8 w-8 rounded-full bg-gray-300/30" />
          {/* Haunted house */}
          <div className="absolute bottom-3 left-6">
            <div className="h-14 w-14 bg-gray-700/80">
              {/* Roof */}
              <div className="-mt-4 h-5 w-16 -ml-1 bg-gray-600" style={{ clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }} />
              {/* Windows (glowing) */}
              <div className="absolute bottom-5 left-2 h-3 w-3 bg-yellow-500/40 rounded-sm" />
              <div className="absolute bottom-5 right-2 h-3 w-3 bg-red-500/30 rounded-sm" />
            </div>
          </div>
          {/* Dead tree */}
          <div className="absolute bottom-3 right-8">
            <div className="h-10 w-1 bg-gray-600" />
            <div className="absolute top-1 -left-3 h-0.5 w-4 bg-gray-600 rotate-[-30deg]" />
            <div className="absolute top-3 left-0 h-0.5 w-3 bg-gray-600 rotate-[25deg]" />
          </div>
          {/* Fog */}
          <div className="absolute bottom-0 inset-x-0 h-6 bg-gradient-to-t from-gray-500/20 to-transparent" />
          {/* Bats */}
          <div className="absolute top-6 left-[35%] text-[10px] text-gray-500/50">🦇</div>
          <div className="absolute top-10 left-[55%] text-[8px] text-gray-500/40">🦇</div>
        </div>
      );
    case "racing":
      return (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-sky-500/30 to-green-700/30" />
          {/* Road */}
          <div className="absolute bottom-2 inset-x-0 h-8 bg-gray-700/80">
            {/* Dashed center line */}
            <div className="absolute top-3.5 inset-x-0 flex gap-2 px-2">
              {[0,1,2,3,4,5,6,7].map(i => <div key={i} className="h-0.5 w-4 bg-yellow-400/60" />)}
            </div>
            {/* Edge lines */}
            <div className="absolute top-0 inset-x-0 h-0.5 bg-white/40" />
            <div className="absolute bottom-0 inset-x-0 h-0.5 bg-white/40" />
          </div>
          {/* Car 1 */}
          <div className="absolute bottom-5 left-[30%]">
            <div className="h-3 w-7 rounded bg-red-500 shadow" />
            <div className="absolute -top-1 left-1 h-2 w-4 rounded-t bg-red-400" />
          </div>
          {/* Car 2 */}
          <div className="absolute bottom-3 left-[55%]">
            <div className="h-3 w-7 rounded bg-blue-500 shadow" />
            <div className="absolute -top-1 left-1 h-2 w-4 rounded-t bg-blue-400" />
          </div>
          {/* Speed lines */}
          <div className="absolute top-[40%] left-2 h-0.5 w-8 bg-white/20" />
          <div className="absolute top-[50%] left-4 h-0.5 w-6 bg-white/15" />
          <div className="absolute top-[60%] left-1 h-0.5 w-10 bg-white/10" />
          {/* Checkered flag */}
          <div className="absolute top-3 right-4 text-lg opacity-50">🏁</div>
          {/* Trees on roadside */}
          <div className="absolute bottom-10 left-4 h-4 w-4 rounded-full bg-green-600/60" />
          <div className="absolute bottom-10 right-6 h-3 w-3 rounded-full bg-green-600/50" />
        </div>
      );
    case "minigames":
      return (
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/30 via-purple-500/20 to-cyan-500/30" />
          {/* Dice */}
          <div className="absolute top-4 left-6 h-8 w-8 rounded bg-white/80 shadow rotate-12">
            <div className="absolute top-1 left-1 h-1.5 w-1.5 rounded-full bg-gray-800" />
            <div className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-gray-800" />
            <div className="absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full bg-gray-800" />
            <div className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-gray-800" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-gray-800" />
          </div>
          {/* Star */}
          <div className="absolute top-3 right-8 text-2xl text-yellow-400/60">⭐</div>
          {/* Trophy */}
          <div className="absolute bottom-4 right-6 text-xl opacity-50">🏆</div>
          {/* Confetti dots */}
          {[10,25,40,55,70,85].map((l,i) => (
            <div key={i} className={`absolute rounded-full ${["bg-pink-400","bg-cyan-400","bg-yellow-400","bg-green-400","bg-purple-400","bg-red-400"][i]}`}
              style={{ width: "4px", height: "4px", top: `${10 + (i*13)%50}px`, left: `${l}%`, opacity: 0.5 }} />
          ))}
          {/* Mini game icons */}
          <div className="absolute bottom-5 left-4 text-sm opacity-40">🎯</div>
          <div className="absolute bottom-8 left-[45%] text-sm opacity-40">🎮</div>
          {/* Party popper */}
          <div className="absolute top-6 left-[50%] text-lg opacity-30">🎉</div>
        </div>
      );
    default:
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-4xl opacity-30">🎮</div>
        </div>
      );
  }
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
      <div className="px-8 pt-8 pb-2">
        <h1 className="text-2xl font-bold text-white">
          {profile.displayName ? `What should we make, ${profile.displayName}?` : "What do you want to build?"}
        </h1>
        <p className="mt-1.5 text-sm text-gray-400">
          Pick a game and tell the AI what you want. It handles the code!
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {/* Continue current project */}
        {hasOpenProject && (
          <div className="mb-6">
            <button
              onClick={() => navigate("/build")}
              className="group flex w-full items-center gap-4 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 to-purple-950/40 p-5 text-left transition-all hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10"
            >
              <div className={`flex h-14 w-14 items-center justify-center rounded-xl shadow-lg ${TEMPLATE_COLOR_MAP[project!.template] || "bg-indigo-600"}`}>
                {(() => { const Icon = TEMPLATE_ICON_MAP[project!.template] || Mountain; return <Icon size={26} className="text-white" />; })()}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">{project!.name}</h3>
                <p className="text-sm text-indigo-300/70">Keep building your {project!.template}</p>
              </div>
              <span className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 group-hover:bg-indigo-500">
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
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Start Something New</h2>
        )}

        {/* Template grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {templates.map((template) => {
            const Icon = template.icon;
            const isSelected = selectedTemplate === template.id;
            return (
              <button
                key={template.id}
                onClick={() => handleTemplateClick(template)}
                disabled={!template.available}
                className={`group relative flex flex-col rounded-2xl border p-0 text-left transition-all overflow-hidden ${
                  isSelected
                    ? "border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg shadow-indigo-500/10"
                    : template.available
                      ? "border-gray-800/60 hover:border-gray-700 hover:shadow-md hover:shadow-black/20"
                      : "cursor-not-allowed border-gray-800/30 opacity-40"
                }`}
              >
                {/* Scene illustration banner */}
                <div className={`relative h-28 overflow-hidden ${template.color}`}>
                  <TemplateScene id={template.id} />
                  {/* Gradient fade to bottom */}
                  <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-gray-900/90 to-transparent" />
                </div>

                {/* Info */}
                <div className="bg-gray-900/90 p-4">
                  <h3 className="text-base font-bold text-white">{template.name}</h3>
                  <p className="mt-1 text-[13px] leading-snug text-gray-400">
                    {template.description}
                  </p>
                </div>

                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute right-3 top-3 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow">
                    Selected
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Name input + create */}
      {showNameInput && (
        <div className="border-t border-gray-800/50 bg-gray-900/80 px-8 py-5 backdrop-blur">
          <div className="mx-auto flex max-w-xl items-end gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-semibold text-white">
                Name your game
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={
                  selectedTemplate === "tycoon" ? "My Factory Empire"
                    : selectedTemplate === "rpg" ? "Dragon Quest Adventure"
                    : selectedTemplate === "horror" ? "The Haunted Mansion"
                    : selectedTemplate === "racing" ? "Speed Legends"
                    : selectedTemplate === "minigames" ? "Party Games Hub"
                    : selectedTemplate === "battlegrounds" ? "Epic Battles"
                    : selectedTemplate === "simulator" ? "Pet Simulator X"
                    : "My Awesome Obby"
                }
                autoFocus
                className="w-full rounded-xl border border-gray-700/50 bg-gray-800/60 px-4 py-3 text-[15px] text-white placeholder-gray-500 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={!projectName.trim() || isLoading}
              className="rounded-xl bg-indigo-600 px-6 py-3 text-[15px] font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-500 hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {isLoading ? "Creating..." : "Let's Go!"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
