import { useMemo, useState } from "react";
import { useProjectStore } from "../../stores/projectStore";
import type { InstanceNode } from "../../types/project";
import {
  Flag,
  Skull,
  Zap,
  TreePine,
  Mountain,
  Eye,
  EyeOff,
  Gamepad2,
  Sparkles,
} from "lucide-react";

// ── Types ──

interface ScenePart {
  name: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  color: string;
  isCheckpoint: boolean;
  isHazard: boolean;
  isMoving: boolean;
  opacity: number;
  stage: string;
}

interface SceneStage {
  name: string;
  index: number;
  parts: ScenePart[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// ── Data extraction ──

function extractVec3(node: InstanceNode, key: string): [number, number, number] {
  const v = node.properties?.[key];
  if (v && typeof v === "object" && "Vector3" in v) {
    return v.Vector3 as [number, number, number];
  }
  return [4, 1, 4];
}

function extractPos(node: InstanceNode): [number, number, number] {
  const cf = node.properties?.CFrame;
  if (cf && typeof cf === "object" && "CFrame" in cf) {
    const cframe = cf.CFrame as { position?: number[] };
    if (cframe.position) return cframe.position as [number, number, number];
  }
  return [0, 0, 0];
}

function extractColor(node: InstanceNode): string {
  const c = node.properties?.Color3uint8;
  if (c && typeof c === "object" && "Color3uint8" in c) {
    const [r, g, b] = c.Color3uint8 as [number, number, number];
    return `rgb(${r},${g},${b})`;
  }
  if (node.tags?.includes("KillBrick")) return "rgb(220, 50, 50)";
  if (node.className === "SpawnLocation") return "rgb(60, 200, 100)";
  return "rgb(100, 110, 200)";
}

function collectSceneParts(node: InstanceNode, stageName: string): ScenePart[] {
  if (node.className === "Part" || node.className === "SpawnLocation") {
    const [x, y, z] = extractPos(node);
    const [w, h, d] = extractVec3(node, "Size");
    const trans = (node.properties?.Transparency as { Float32: number })?.Float32 ?? 0;
    return [{
      name: node.name,
      x, y, z,
      width: w, height: h, depth: d,
      color: extractColor(node),
      isCheckpoint: node.className === "SpawnLocation",
      isHazard: !!node.tags?.includes("KillBrick") || !!node.tags?.includes("Hazard"),
      isMoving: node.name.toLowerCase().includes("moving") || node.name.toLowerCase().includes("spinner"),
      opacity: 1 - trans,
      stage: stageName,
    }];
  }
  const parts: ScenePart[] = [];
  for (const child of node.children) {
    parts.push(...collectSceneParts(child, stageName));
  }
  return parts;
}

function buildScene(hierarchy: InstanceNode): SceneStage[] {
  const stages: SceneStage[] = [];
  const workspace = hierarchy.children.find(c => c.className === "Workspace" || c.name === "Workspace");
  if (!workspace) return stages;

  const processFolder = (folder: InstanceNode, name: string, index: number) => {
    const parts = collectSceneParts(folder, name);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of parts) {
      minX = Math.min(minX, p.x - p.width / 2);
      maxX = Math.max(maxX, p.x + p.width / 2);
      minY = Math.min(minY, p.y - p.height / 2);
      maxY = Math.max(maxY, p.y + p.height / 2);
    }
    stages.push({ name, index, parts, minX, maxX, minY, maxY });
  };

  const lobby = workspace.children.find(c => c.name === "Lobby");
  if (lobby) processFolder(lobby, "Lobby", 0);

  const stagesFolder = workspace.children.find(c => c.name === "Stages" || c.name === "Plots");
  if (stagesFolder) {
    const sorted = [...stagesFolder.children].sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, "")) || 0;
      const numB = parseInt(b.name.replace(/\D/g, "")) || 0;
      return numA - numB;
    });
    sorted.forEach((s, i) => processFolder(s, s.name, i + 1));
  }

  return stages;
}

// ── Visual Part Renderer ──

function PartVisual({ part, sceneMinX, sceneMaxX, sceneMinY, sceneMaxY, canvasW, canvasH }: {
  part: ScenePart;
  sceneMinX: number;
  sceneMaxX: number;
  sceneMinY: number;
  sceneMaxY: number;
  canvasW: number;
  canvasH: number;
}) {
  const [hovered, setHovered] = useState(false);

  const rangeX = Math.max(sceneMaxX - sceneMinX, 1);
  const rangeY = Math.max(sceneMaxY - sceneMinY, 1);

  // Map world coords to canvas pixels (side view: X horizontal, Y vertical)
  const px = ((part.x - sceneMinX) / rangeX) * canvasW;
  // Invert Y so higher Y = higher on screen
  const py = canvasH - ((part.y - sceneMinY) / rangeY) * canvasH;
  const pw = Math.max((part.width / rangeX) * canvasW, 8);
  const ph = Math.max((part.height / rangeY) * canvasH, 4);

  // Determine visual style
  const isLava = part.isHazard;
  const isSpawn = part.isCheckpoint;
  const isMoving = part.isMoving;

  let borderStyle = "1px solid rgba(255,255,255,0.1)";
  let shadow = "none";
  let extraClass = "";

  if (isLava) {
    borderStyle = "2px solid rgba(255,80,40,0.7)";
    shadow = "0 0 12px rgba(255,50,20,0.4), 0 2px 4px rgba(0,0,0,0.3)";
  } else if (isSpawn) {
    borderStyle = "2px solid rgba(74,222,128,0.7)";
    shadow = "0 0 12px rgba(74,222,128,0.3), 0 2px 4px rgba(0,0,0,0.3)";
  } else if (isMoving) {
    extraClass = "animate-pulse";
    shadow = "0 0 8px rgba(100,200,255,0.3)";
  } else {
    shadow = "0 2px 6px rgba(0,0,0,0.3)";
  }

  if (hovered) {
    shadow = `0 0 20px ${part.color}88, 0 4px 12px rgba(0,0,0,0.5)`;
  }

  return (
    <div
      className={`absolute transition-all duration-200 cursor-pointer ${extraClass}`}
      style={{
        left: `${px - pw / 2}px`,
        top: `${py - ph}px`,
        width: `${pw}px`,
        height: `${ph}px`,
        backgroundColor: part.color,
        opacity: hovered ? 1 : Math.max(part.opacity * 0.9, 0.6),
        border: borderStyle,
        borderRadius: isSpawn ? "50% 50% 4px 4px" : isLava ? "2px" : "4px",
        boxShadow: shadow,
        transform: hovered ? "scale(1.1) translateY(-2px)" : "scale(1)",
        zIndex: hovered ? 50 : Math.round(py),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Part icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        {isSpawn && <Flag size={Math.min(pw * 0.5, 14)} className="text-white/80" />}
        {isLava && <Skull size={Math.min(pw * 0.5, 12)} className="text-white/60" />}
        {isMoving && !isLava && <Zap size={Math.min(pw * 0.5, 12)} className="text-white/60" />}
      </div>

      {/* Tooltip */}
      {hovered && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-10 whitespace-nowrap rounded-lg bg-gray-900/95 px-3 py-1.5 text-[11px] font-medium text-white shadow-xl border border-gray-700/50 pointer-events-none z-[100]">
          <span className="font-bold">{part.name}</span>
          {isSpawn && <span className="ml-1.5 text-emerald-400">Checkpoint</span>}
          {isLava && <span className="ml-1.5 text-red-400">Danger!</span>}
          {isMoving && <span className="ml-1.5 text-blue-400">Moving</span>}
          <div className="text-[10px] text-gray-400 mt-0.5">
            {part.width.toFixed(0)}x{part.height.toFixed(0)}x{part.depth.toFixed(0)} studs
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stage Label ──

function StageLabel({ stage, x, y }: { stage: SceneStage; x: number; y: number }) {
  const isLobby = stage.index === 0;
  return (
    <div
      className="absolute flex items-center gap-1.5 pointer-events-none"
      style={{ left: `${x}px`, top: `${y + 8}px`, zIndex: 100 }}
    >
      <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-bold shadow ${
        isLobby
          ? "bg-gradient-to-br from-emerald-500 to-green-600 text-white"
          : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
      }`}>
        {isLobby ? "L" : stage.index}
      </span>
      <span className="text-[11px] font-bold text-white/70 drop-shadow-md">{stage.name}</span>
    </div>
  );
}

// ── Ground / Terrain layer ──

function TerrainLayer({ canvasW, canvasH, template }: { canvasW: number; canvasH: number; template: string }) {
  // Generate decorative elements based on template
  const decorations = useMemo(() => {
    const items: { type: string; x: number; y: number; size: number }[] = [];
    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    // Add trees, mountains, water decorations
    for (let i = 0; i < 8; i++) {
      items.push({ type: "tree", x: rand(5, canvasW - 20), y: rand(canvasH * 0.5, canvasH - 30), size: rand(12, 24) });
    }
    for (let i = 0; i < 3; i++) {
      items.push({ type: "mountain", x: rand(0, canvasW), y: rand(20, canvasH * 0.3), size: rand(30, 60) });
    }
    if (template !== "horror") {
      for (let i = 0; i < 4; i++) {
        items.push({ type: "cloud", x: rand(10, canvasW - 30), y: rand(10, canvasH * 0.2), size: rand(20, 40) });
      }
    }

    return items;
  }, [canvasW, canvasH, template]);

  return (
    <>
      {decorations.map((d, i) => (
        <div
          key={`deco-${i}`}
          className="absolute pointer-events-none"
          style={{ left: `${d.x}px`, top: `${d.y}px`, zIndex: 1 }}
        >
          {d.type === "tree" && (
            <TreePine size={d.size} className="text-green-900/30" />
          )}
          {d.type === "mountain" && (
            <Mountain size={d.size} className="text-gray-700/20" />
          )}
          {d.type === "cloud" && (
            <div
              className="rounded-full bg-white/5"
              style={{ width: `${d.size}px`, height: `${d.size * 0.4}px` }}
            />
          )}
        </div>
      ))}
    </>
  );
}

// ── Sky Gradient per template ──

function getSkyGradient(template: string): string {
  switch (template) {
    case "obby": return "from-indigo-950 via-blue-950 to-slate-900";
    case "tycoon": return "from-sky-950 via-blue-950 to-slate-900";
    case "simulator": return "from-purple-950 via-indigo-950 to-slate-900";
    case "horror": return "from-gray-950 via-red-950/30 to-gray-950";
    case "racing": return "from-orange-950 via-amber-950/30 to-slate-900";
    case "rpg": return "from-emerald-950 via-teal-950 to-slate-900";
    case "battlegrounds": return "from-red-950 via-orange-950/30 to-slate-900";
    case "minigames": return "from-pink-950 via-purple-950 to-slate-900";
    default: return "from-indigo-950 via-blue-950 to-slate-900";
  }
}

function getGroundGradient(template: string): string {
  switch (template) {
    case "obby": return "from-slate-800 to-slate-900";
    case "tycoon": return "from-green-900/50 to-slate-900";
    case "simulator": return "from-purple-900/40 to-slate-900";
    case "horror": return "from-red-950/40 to-gray-950";
    case "racing": return "from-gray-800 to-slate-900";
    case "rpg": return "from-emerald-900/40 to-slate-900";
    default: return "from-slate-800 to-slate-900";
  }
}

// ── Build Progress Overlay ──

function BuildProgressOverlay({ stageCount, scriptCount }: { stageCount: number; scriptCount: number }) {
  const steps = [
    { label: "Terrain Created", icon: Mountain, done: true },
    { label: `${stageCount} Stages Built`, icon: Flag, done: stageCount > 0 },
    { label: `${scriptCount} Scripts Written`, icon: Zap, done: scriptCount > 0 },
    { label: "Game Logic Active", icon: Sparkles, done: scriptCount > 1 },
  ];

  return (
    <div className="absolute top-3 left-3 z-50">
      <div className="rounded-xl bg-gray-900/90 backdrop-blur-sm border border-gray-700/50 p-3 shadow-xl">
        <p className="text-[11px] font-bold text-gray-300 mb-2">Build Progress</p>
        <div className="space-y-1.5">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex items-center gap-2">
                <div className={`flex h-5 w-5 items-center justify-center rounded ${
                  s.done ? "bg-green-600/30" : "bg-gray-800"
                }`}>
                  <Icon size={11} className={s.done ? "text-green-400" : "text-gray-600"} />
                </div>
                <span className={`text-[11px] ${s.done ? "text-gray-200" : "text-gray-600"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Legend ──

function SceneLegend() {
  const items = [
    { color: "bg-blue-500", label: "Platform" },
    { color: "bg-green-500", label: "Checkpoint" },
    { color: "bg-red-500", label: "Danger" },
    { color: "bg-cyan-400", label: "Moving" },
  ];
  return (
    <div className="absolute bottom-3 right-3 z-50 flex items-center gap-3 rounded-lg bg-gray-900/80 backdrop-blur-sm border border-gray-700/50 px-3 py-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className={`h-2.5 w-2.5 rounded-sm ${item.color}`} />
          <span className="text-[10px] text-gray-400">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──

export function VisualScenePreview() {
  const { projectState, project } = useProjectStore();
  const [showLabels, setShowLabels] = useState(true);

  const scene = useMemo(() => {
    if (!projectState) return [];
    return buildScene(projectState.hierarchy);
  }, [projectState]);

  const template = project?.template || "obby";

  // Compute global bounds across all stages
  const allParts = scene.flatMap(s => s.parts);
  let gMinX = Infinity, gMaxX = -Infinity, gMinY = Infinity, gMaxY = -Infinity;
  for (const p of allParts) {
    gMinX = Math.min(gMinX, p.x - p.width / 2);
    gMaxX = Math.max(gMaxX, p.x + p.width / 2);
    gMinY = Math.min(gMinY, p.y - p.height / 2);
    gMaxY = Math.max(gMaxY, p.y + p.height / 2);
  }
  // Add padding
  const PAD = 15;
  gMinX -= PAD; gMaxX += PAD; gMinY -= PAD; gMaxY += PAD;

  const CANVAS_W = 800;
  const CANVAS_H = 400;

  const rangeX = Math.max(gMaxX - gMinX, 1);

  if (!projectState || allParts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20">
          <Gamepad2 size={36} className="text-gray-600" />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-gray-300">Your Game World</p>
          <p className="mt-1 text-sm text-gray-500">
            Start building and watch your game come to life here!
          </p>
          <p className="mt-3 text-xs text-gray-600">
            Tell the AI what you want and the world will appear
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-800/40 px-4 py-2">
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-gray-500" />
          <span className="text-[12px] font-semibold text-gray-400">Game World</span>
          <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
            {allParts.length} parts
          </span>
          <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
            {scene.length} stages
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowLabels(!showLabels)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white"
            title={showLabels ? "Hide labels" : "Show labels"}
          >
            {showLabels ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
        </div>
      </div>

      {/* Scene canvas */}
      <div className="flex-1 overflow-auto">
        <div
          className={`relative bg-gradient-to-b ${getSkyGradient(template)} overflow-hidden`}
          style={{ width: `${CANVAS_W}px`, height: `${CANVAS_H}px`, minWidth: "100%" }}
        >
          {/* Stars */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={`star-${i}`}
                className="absolute rounded-full bg-white/20"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 40}%`,
                  width: `${1 + Math.random() * 2}px`,
                  height: `${1 + Math.random() * 2}px`,
                }}
              />
            ))}
          </div>

          {/* Ground gradient */}
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${getGroundGradient(template)}`}
            style={{ height: "30%" }}
          />

          {/* Ground line */}
          <div className="absolute bottom-[29%] left-0 right-0 h-px bg-gray-600/30" />

          {/* Terrain decorations */}
          <TerrainLayer canvasW={CANVAS_W} canvasH={CANVAS_H} template={template} />

          {/* Render all parts */}
          {allParts.map((part, i) => (
            <PartVisual
              key={`${part.name}-${i}`}
              part={part}
              sceneMinX={gMinX}
              sceneMaxX={gMaxX}
              sceneMinY={gMinY}
              sceneMaxY={gMaxY}
              canvasW={CANVAS_W}
              canvasH={CANVAS_H}
            />
          ))}

          {/* Stage labels */}
          {showLabels && scene.map((stage) => {
            const centerX = ((((stage.minX + stage.maxX) / 2) - gMinX) / rangeX) * CANVAS_W;
            return (
              <StageLabel key={stage.name} stage={stage} x={centerX - 30} y={6} />
            );
          })}

          {/* Build progress overlay */}
          <BuildProgressOverlay
            stageCount={scene.length}
            scriptCount={projectState.scripts.length}
          />

          {/* Legend */}
          <SceneLegend />
        </div>
      </div>
    </div>
  );
}
