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

// ── Roblox-style R6 character (blocky, used in thumbnails) ──

function RobloxChar({ color, x, bottom, size = 1, flip = false }: { color: string; x: string; bottom: string; size?: number; flip?: boolean }) {
  const s = size;
  return (
    <div className="absolute" style={{ left: x, bottom, transform: flip ? "scaleX(-1)" : "none" }}>
      {/* Head */}
      <div style={{ width: `${10*s}px`, height: `${10*s}px`, background: "#f5c076", borderRadius: "2px", marginLeft: `${2*s}px` }} />
      {/* Eyes */}
      <div className="absolute" style={{ width: `${2*s}px`, height: `${2*s}px`, background: "#222", borderRadius: "50%", top: `${3*s}px`, left: `${4*s}px` }} />
      <div className="absolute" style={{ width: `${2*s}px`, height: `${2*s}px`, background: "#222", borderRadius: "50%", top: `${3*s}px`, left: `${8*s}px` }} />
      {/* Torso */}
      <div style={{ width: `${14*s}px`, height: `${12*s}px`, background: color, borderRadius: "2px" }} />
      {/* Arms */}
      <div className="absolute" style={{ width: `${4*s}px`, height: `${12*s}px`, background: color, left: `${-4*s}px`, top: `${10*s}px`, borderRadius: "2px" }} />
      <div className="absolute" style={{ width: `${4*s}px`, height: `${12*s}px`, background: color, right: `${-4*s}px`, top: `${10*s}px`, borderRadius: "2px" }} />
      {/* Legs */}
      <div style={{ display: "flex", gap: `${1*s}px` }}>
        <div style={{ width: `${6*s}px`, height: `${10*s}px`, background: color, filter: "brightness(0.75)", borderRadius: "2px" }} />
        <div style={{ width: `${6*s}px`, height: `${10*s}px`, background: color, filter: "brightness(0.75)", borderRadius: "2px" }} />
      </div>
    </div>
  );
}

// ── Roblox-style scene illustrations for template cards ──

function TemplateScene({ id }: { id: string }) {
  switch (id) {
    case "obby":
      return (
        <div className="absolute inset-0">
          {/* Radial light burst */}
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 80%, #00ff8840, transparent 60%)" }} />
          {/* Neon platforms staircase */}
          <div className="absolute bottom-2 left-[5%] h-4 w-[25%] rounded" style={{ background: "linear-gradient(90deg, #00ff88, #00cc66)", boxShadow: "0 0 12px #00ff8866" }} />
          <div className="absolute bottom-8 left-[20%] h-4 w-[22%] rounded" style={{ background: "linear-gradient(90deg, #00bbff, #0088ff)", boxShadow: "0 0 12px #00bbff66" }} />
          <div className="absolute bottom-14 left-[10%] h-4 w-[20%] rounded" style={{ background: "linear-gradient(90deg, #ff44cc, #ff0088)", boxShadow: "0 0 12px #ff44cc66" }} />
          <div className="absolute bottom-20 right-[15%] h-4 w-[22%] rounded" style={{ background: "linear-gradient(90deg, #ffaa00, #ff8800)", boxShadow: "0 0 12px #ffaa0066" }} />
          {/* Kill brick (red glow) */}
          <div className="absolute bottom-5 left-[48%] h-3 w-[12%] rounded-sm" style={{ background: "#ff0000", boxShadow: "0 0 10px #ff000088" }} />
          {/* Character jumping */}
          <RobloxChar color="#3b82f6" x="30%" bottom="26px" size={1.8} />
          {/* Coins trail */}
          {[35, 50, 62, 74].map((l, i) => (
            <div key={i} className="absolute rounded-full" style={{ width: "8px", height: "8px", background: "#ffd700", boxShadow: "0 0 6px #ffd70088", bottom: `${20 + i * 10}px`, left: `${l}%` }} />
          ))}
          {/* Checkpoint flag */}
          <div className="absolute bottom-2 right-[10%]">
            <div style={{ width: "2px", height: "28px", background: "#ccc" }} />
            <div className="absolute top-0 left-0.5" style={{ width: "16px", height: "10px", background: "#00ff00", boxShadow: "0 0 8px #00ff0066", clipPath: "polygon(0 0, 100% 20%, 100% 80%, 0 100%)" }} />
          </div>
        </div>
      );
    case "tycoon":
      return (
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 70%, #ffd70040, transparent 60%)" }} />
          {/* Factory silhouette */}
          <div className="absolute bottom-0 left-[5%] h-[55%] w-[35%] rounded-t" style={{ background: "linear-gradient(180deg, #666, #444)" }}>
            <div className="absolute -top-4 left-2 h-8 w-4 rounded-t bg-gray-500" />
            <div className="absolute -top-6 left-8 h-10 w-4 rounded-t bg-gray-500" />
            <div className="absolute -top-3 right-2 h-7 w-3 rounded-t bg-gray-500" />
            {/* Smoke */}
            <div className="absolute -top-8 left-3 h-3 w-3 rounded-full bg-gray-400/30" />
            <div className="absolute -top-10 left-9 h-4 w-4 rounded-full bg-gray-400/20" />
          </div>
          {/* Money rain */}
          {[25, 40, 55, 68, 80, 90].map((l, i) => (
            <div key={i} className="absolute rounded-full" style={{ width: "10px", height: "10px", background: "#ffd700", boxShadow: "0 0 8px #ffd70088", top: `${8 + i * 14}px`, left: `${l}%` }}>
              <span className="flex items-center justify-center text-[6px] font-bold text-amber-800">$</span>
            </div>
          ))}
          {/* Character with money */}
          <RobloxChar color="#22c55e" x="60%" bottom="4px" size={2} />
          {/* Upgrade arrow */}
          <div className="absolute top-3 right-4 text-xl" style={{ color: "#00ff88", textShadow: "0 0 10px #00ff8888" }}>⬆</div>
        </div>
      );
    case "simulator":
      return (
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 60%, #aa55ff40, transparent 50%), radial-gradient(ellipse at 70% 40%, #ff55aa30, transparent 50%)" }} />
          {/* Big pet (golden) */}
          <div className="absolute bottom-3 right-[15%]" style={{ width: "32px", height: "32px", background: "radial-gradient(circle at 40% 35%, #ffd700, #ff8c00)", borderRadius: "40%", boxShadow: "0 0 15px #ffd70066" }}>
            <div className="absolute" style={{ top: "8px", left: "6px", width: "5px", height: "5px", background: "#222", borderRadius: "50%" }} />
            <div className="absolute" style={{ top: "8px", right: "6px", width: "5px", height: "5px", background: "#222", borderRadius: "50%" }} />
            <div className="absolute" style={{ bottom: "6px", left: "50%", transform: "translateX(-50%)", width: "8px", height: "3px", background: "#222", borderRadius: "0 0 4px 4px" }} />
          </div>
          {/* Small pets */}
          <div className="absolute bottom-6 left-[15%] h-5 w-5 rounded-full shadow" style={{ background: "#ff69b4", boxShadow: "0 0 8px #ff69b466" }} />
          <div className="absolute bottom-4 left-[30%] h-4 w-4 rounded-full shadow" style={{ background: "#00ddff", boxShadow: "0 0 8px #00ddff66" }} />
          {/* Character */}
          <RobloxChar color="#8b5cf6" x="42%" bottom="4px" size={1.8} />
          {/* Floating gems + coins */}
          {[10, 25, 60, 82].map((l, i) => (
            <div key={i} className="absolute" style={{
              width: i % 2 === 0 ? "8px" : "10px", height: i % 2 === 0 ? "8px" : "10px",
              background: i % 2 === 0 ? "#ffd700" : "#aa55ff",
              borderRadius: i % 2 === 0 ? "50%" : "2px",
              transform: i % 2 === 1 ? "rotate(45deg)" : "none",
              boxShadow: `0 0 8px ${i % 2 === 0 ? "#ffd70088" : "#aa55ff88"}`,
              top: `${12 + (i * 18) % 40}px`, left: `${l}%`,
            }} />
          ))}
          {/* Sparkles */}
          <div className="absolute top-2 left-[20%] text-sm" style={{ textShadow: "0 0 8px #fff" }}>✨</div>
          <div className="absolute top-4 right-[25%] text-lg" style={{ textShadow: "0 0 8px #fff" }}>✨</div>
        </div>
      );
    case "battlegrounds":
      return (
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, #ff440030, transparent 50%)" }} />
          {/* Arena ground */}
          <div className="absolute bottom-0 inset-x-0 h-[30%]" style={{ background: "linear-gradient(180deg, #4a2020, #2a1010)" }} />
          {/* Blue fighter */}
          <RobloxChar color="#3b82f6" x="15%" bottom="14px" size={2.2} />
          {/* Red fighter */}
          <RobloxChar color="#ef4444" x="60%" bottom="14px" size={2.2} flip />
          {/* Clash effect center */}
          <div className="absolute top-[35%] left-1/2 -translate-x-1/2" style={{ width: "20px", height: "20px", background: "radial-gradient(circle, #ffff00, #ff8800, transparent)", borderRadius: "50%", boxShadow: "0 0 20px #ffaa0088" }} />
          {/* VS text */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 text-lg font-black" style={{ color: "#ff4444", textShadow: "0 0 10px #ff000088, 2px 2px 0 #000" }}>VS</div>
          {/* Health bars */}
          <div className="absolute top-3 left-3 h-2 w-[30%] rounded-full bg-gray-800"><div className="h-2 w-[75%] rounded-full" style={{ background: "linear-gradient(90deg, #00ff00, #88ff00)", boxShadow: "0 0 6px #00ff0066" }} /></div>
          <div className="absolute top-3 right-3 h-2 w-[30%] rounded-full bg-gray-800"><div className="h-2 w-[55%] rounded-full float-right" style={{ background: "linear-gradient(90deg, #ff8800, #ff0000)", boxShadow: "0 0 6px #ff000066" }} /></div>
        </div>
      );
    case "rpg":
      return (
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 30%, #4488ff30, transparent 50%), radial-gradient(ellipse at 70% 70%, #44ff4420, transparent 50%)" }} />
          {/* Green ground */}
          <div className="absolute bottom-0 inset-x-0 h-[25%]" style={{ background: "linear-gradient(180deg, #2d6a2d, #1a4a1a)" }} />
          {/* Castle */}
          <div className="absolute bottom-[20%] left-[5%]">
            <div style={{ width: "40px", height: "50px", background: "linear-gradient(180deg, #888, #666)", borderRadius: "2px 2px 0 0" }}>
              <div className="flex gap-0.5 -mt-1" style={{ padding: "0 2px" }}>
                {[0,1,2,3].map(i => <div key={i} style={{ width: "7px", height: "6px", background: "#888" }} />)}
              </div>
            </div>
          </div>
          {/* Hero character with sword */}
          <RobloxChar color="#ffd700" x="45%" bottom="14px" size={2} />
          {/* Sword next to character */}
          <div className="absolute bottom-[22%] left-[62%]" style={{ width: "3px", height: "24px", background: "linear-gradient(180deg, #ccc, #888)", transform: "rotate(-30deg)", boxShadow: "0 0 6px #ffffff44" }}>
            <div style={{ width: "10px", height: "3px", background: "#8B4513", marginLeft: "-3.5px", marginTop: "18px" }} />
          </div>
          {/* Dragon/monster */}
          <div className="absolute bottom-[20%] right-[8%]" style={{ width: "28px", height: "24px", background: "#ff4444", borderRadius: "8px 8px 4px 4px", boxShadow: "0 0 10px #ff000044" }}>
            <div className="absolute" style={{ top: "5px", left: "5px", width: "4px", height: "4px", background: "#ffff00", borderRadius: "50%" }} />
            <div className="absolute" style={{ top: "5px", right: "5px", width: "4px", height: "4px", background: "#ffff00", borderRadius: "50%" }} />
          </div>
          {/* XP orb */}
          <div className="absolute top-5 right-[20%]" style={{ width: "10px", height: "10px", background: "radial-gradient(circle, #00ff88, #00aa44)", borderRadius: "50%", boxShadow: "0 0 8px #00ff8866" }} />
        </div>
      );
    case "horror":
      return (
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #0a0a15, #1a1020)" }} />
          {/* Moon */}
          <div className="absolute top-3 right-[20%]" style={{ width: "24px", height: "24px", background: "radial-gradient(circle at 40% 40%, #eee, #aaa)", borderRadius: "50%", boxShadow: "0 0 20px #ffffff30" }} />
          {/* Haunted building */}
          <div className="absolute bottom-0 left-[10%]" style={{ width: "50px", height: "60px", background: "#222" }}>
            <div className="-mt-3 -ml-1" style={{ width: "52px", height: "18px", background: "#1a1a1a", clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" }} />
            <div className="absolute" style={{ bottom: "18px", left: "8px", width: "8px", height: "10px", background: "#ff440020", borderRadius: "1px", boxShadow: "0 0 8px #ff440030" }} />
            <div className="absolute" style={{ bottom: "18px", right: "8px", width: "8px", height: "10px", background: "#ff000015", borderRadius: "1px", boxShadow: "0 0 8px #ff000020" }} />
          </div>
          {/* Scared character (running) */}
          <RobloxChar color="#4488ff" x="55%" bottom="4px" size={1.8} />
          {/* Monster shadow */}
          <div className="absolute bottom-1 right-[8%]" style={{ width: "20px", height: "30px", background: "linear-gradient(180deg, #ff000015, #33003310)", borderRadius: "6px 6px 0 0", boxShadow: "0 0 15px #ff000020" }}>
            <div className="absolute" style={{ top: "6px", left: "3px", width: "4px", height: "3px", background: "#ff0000", borderRadius: "50%", boxShadow: "0 0 6px #ff0000" }} />
            <div className="absolute" style={{ top: "6px", right: "3px", width: "4px", height: "3px", background: "#ff0000", borderRadius: "50%", boxShadow: "0 0 6px #ff0000" }} />
          </div>
          {/* Fog */}
          <div className="absolute bottom-0 inset-x-0 h-[20%]" style={{ background: "linear-gradient(180deg, transparent, #ffffff08)" }} />
        </div>
      );
    case "racing":
      return (
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 90%, #ff880030, transparent 50%)" }} />
          {/* Sky */}
          <div className="absolute inset-x-0 top-0 h-[50%]" style={{ background: "linear-gradient(180deg, #1a3a6a, #3a6a9a)" }} />
          {/* Road with perspective */}
          <div className="absolute bottom-0 inset-x-0 h-[50%]" style={{ background: "#444" }}>
            <div className="absolute top-[45%] inset-x-0 flex justify-center gap-3">
              {[0,1,2,3,4,5].map(i => <div key={i} style={{ width: "12px", height: "3px", background: "#ffcc00" }} />)}
            </div>
          </div>
          {/* Red car (bigger) */}
          <div className="absolute bottom-[18%] left-[25%]">
            <div style={{ width: "32px", height: "14px", background: "linear-gradient(180deg, #ff2200, #cc0000)", borderRadius: "4px", boxShadow: "0 0 10px #ff220066" }} />
            <div className="absolute" style={{ width: "20px", height: "8px", background: "#ff4444", borderRadius: "3px 3px 0 0", top: "-5px", left: "6px" }} />
            {/* Wheels */}
            <div className="absolute" style={{ width: "6px", height: "6px", background: "#222", borderRadius: "50%", bottom: "-2px", left: "2px" }} />
            <div className="absolute" style={{ width: "6px", height: "6px", background: "#222", borderRadius: "50%", bottom: "-2px", right: "2px" }} />
          </div>
          {/* Blue car */}
          <div className="absolute bottom-[30%] right-[20%]">
            <div style={{ width: "28px", height: "12px", background: "linear-gradient(180deg, #0088ff, #0044cc)", borderRadius: "3px", boxShadow: "0 0 10px #0088ff44" }} />
            <div className="absolute" style={{ width: "16px", height: "7px", background: "#2299ff", borderRadius: "3px 3px 0 0", top: "-4px", left: "6px" }} />
          </div>
          {/* Speed boost effect */}
          <div className="absolute bottom-[20%] left-[15%] flex gap-0.5">
            {[0,1,2].map(i => <div key={i} style={{ width: `${10-i*3}px`, height: "2px", background: `rgba(255,200,0,${0.6-i*0.15})` }} />)}
          </div>
          {/* Checkered flag */}
          <div className="absolute top-2 right-3 text-lg">🏁</div>
        </div>
      );
    case "minigames":
      return (
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, #ff55aa25, transparent 50%), radial-gradient(ellipse at 30% 30%, #55aaff20, transparent 40%), radial-gradient(ellipse at 70% 70%, #ffaa5520, transparent 40%)" }} />
          {/* Party characters */}
          <RobloxChar color="#ff4488" x="20%" bottom="4px" size={1.6} />
          <RobloxChar color="#44aaff" x="50%" bottom="4px" size={1.6} />
          <RobloxChar color="#ffaa00" x="72%" bottom="4px" size={1.6} />
          {/* Confetti burst */}
          {[8,18,30,42,55,65,78,88].map((l,i) => (
            <div key={i} style={{
              position: "absolute", width: "5px", height: "5px",
              background: ["#ff4488","#44aaff","#ffaa00","#44ff88","#ff44ff","#ffff44","#44ffff","#ff8844"][i],
              borderRadius: i % 2 === 0 ? "50%" : "1px",
              transform: `rotate(${i * 45}deg)`,
              top: `${6 + (i * 11) % 40}px`, left: `${l}%`,
              boxShadow: `0 0 4px ${["#ff4488","#44aaff","#ffaa00","#44ff88","#ff44ff","#ffff44","#44ffff","#ff8844"][i]}66`,
            }} />
          ))}
          {/* Trophy */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 text-2xl" style={{ filter: "drop-shadow(0 0 6px #ffd70088)" }}>🏆</div>
          {/* "PARTY" vibe */}
          <div className="absolute top-2 right-3 text-[10px] font-black tracking-wide" style={{ color: "#ffaa00", textShadow: "0 0 8px #ffaa0088" }}>PLAY!</div>
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
