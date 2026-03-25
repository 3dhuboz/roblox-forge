import { useMemo, useState } from "react";
import { useProjectStore } from "../../stores/projectStore";
import type { InstanceNode } from "../../types/project";
import { Flag, Skull, Box, ArrowDown } from "lucide-react";

interface PartVisual {
  name: string;
  className: string;
  x: number;
  z: number;
  sizeX: number;
  sizeZ: number;
  color: string;
  opacity: number;
  tags: string[];
  isCheckpoint: boolean;
  isHazard: boolean;
}

interface StageVisual {
  name: string;
  parts: PartVisual[];
  index: number;
}

function extractRawColor(node: InstanceNode): [number, number, number] {
  const c = node.properties?.Color3uint8;
  if (c && typeof c === "object" && "Color3uint8" in c) {
    return c.Color3uint8 as [number, number, number];
  }
  if (node.tags?.includes("KillBrick")) return [220, 50, 50];
  if (node.className === "SpawnLocation") return [60, 200, 100];
  return [100, 110, 200];
}

function rgbToMuted([r, g, b]: [number, number, number]): string {
  const mr = Math.round(r * 0.7 + 40);
  const mg = Math.round(g * 0.7 + 40);
  const mb = Math.round(b * 0.7 + 40);
  return `rgb(${mr},${mg},${mb})`;
}

function extractSize(node: InstanceNode): { x: number; z: number } {
  const s = node.properties?.Size;
  if (s && typeof s === "object" && "Vector3" in s) {
    const [sx, , sz] = s.Vector3 as number[];
    return { x: sx, z: sz };
  }
  return { x: 4, z: 4 };
}

function extractPosition(node: InstanceNode): { x: number; z: number } {
  const cf = node.properties?.CFrame;
  if (cf && typeof cf === "object" && "CFrame" in cf) {
    const cframe = cf.CFrame as { position?: number[] };
    if (cframe.position) {
      return { x: cframe.position[0], z: cframe.position[2] };
    }
  }
  return { x: 0, z: 0 };
}

function collectParts(node: InstanceNode): PartVisual[] {
  const pos = extractPosition(node);
  const size = extractSize(node);
  const rawColor = extractRawColor(node);
  const isHazard = node.tags?.includes("KillBrick") || node.tags?.includes("Hazard") || false;
  return [{
    name: node.name,
    className: node.className,
    x: pos.x,
    z: pos.z,
    sizeX: size.x,
    sizeZ: size.z,
    color: rgbToMuted(rawColor),
    opacity: 1 - ((node.properties?.Transparency as { Float32: number })?.Float32 ?? 0),
    tags: node.tags || [],
    isCheckpoint: node.className === "SpawnLocation",
    isHazard,
  }];
}

function buildStageVisuals(hierarchy: InstanceNode): StageVisual[] {
  const stages: StageVisual[] = [];
  const workspace = hierarchy.children.find((c) => c.className === "Workspace" || c.name === "Workspace");
  if (!workspace) return stages;

  const lobby = workspace.children.find((c) => c.name === "Lobby");
  if (lobby) {
    const parts: PartVisual[] = [];
    for (const child of lobby.children) parts.push(...collectParts(child));
    stages.push({ name: "Lobby", index: 0, parts });
  }

  const stagesFolder = workspace.children.find((c) => c.name === "Stages" || c.name === "Plots");
  if (stagesFolder) {
    const sorted = [...stagesFolder.children].sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, "")) || 0;
      const numB = parseInt(b.name.replace(/\D/g, "")) || 0;
      return numA - numB;
    });
    sorted.forEach((stage, i) => {
      const parts: PartVisual[] = [];
      for (const child of stage.children) parts.push(...collectParts(child));
      stages.push({ name: stage.name, index: i + 1, parts });
    });
  }

  return stages;
}

function StageCard({ stage }: { stage: StageVisual }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const partCount = stage.parts.length;
  const checkpoints = stage.parts.filter((p) => p.isCheckpoint).length;
  const hazards = stage.parts.filter((p) => p.isHazard).length;

  // Compute bounding box for this stage
  const PADDING = 4;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of stage.parts) {
    minX = Math.min(minX, p.x - p.sizeX / 2);
    maxX = Math.max(maxX, p.x + p.sizeX / 2);
    minZ = Math.min(minZ, p.z - p.sizeZ / 2);
    maxZ = Math.max(maxZ, p.z + p.sizeZ / 2);
  }
  minX -= PADDING; maxX += PADDING; minZ -= PADDING; maxZ += PADDING;
  const rangeX = Math.max(maxX - minX, 1);
  const rangeZ = Math.max(maxZ - minZ, 1);

  // Keep aspect ratio, fit into a fixed-height canvas
  const CANVAS_W = 100; // percentage
  const CANVAS_H = 180; // px
  const scale = Math.min(CANVAS_W / rangeX, CANVAS_H / rangeZ) * 0.85;

  const isLobby = stage.index === 0;

  return (
    <div className="rounded-xl border border-gray-800/80 bg-gray-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/50">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${isLobby ? "bg-emerald-600/30 text-emerald-300" : "bg-indigo-600/30 text-indigo-300"}`}>
            {isLobby ? "L" : stage.index}
          </span>
          <span className="text-sm font-semibold text-gray-200">{stage.name}</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="flex items-center gap-1 text-gray-500">
            <Box size={11} /> {partCount}
          </span>
          {checkpoints > 0 && (
            <span className="flex items-center gap-1 text-emerald-400/80">
              <Flag size={11} /> {checkpoints}
            </span>
          )}
          {hazards > 0 && (
            <span className="flex items-center gap-1 text-red-400/80">
              <Skull size={11} /> {hazards}
            </span>
          )}
        </div>
      </div>

      {/* Top-down canvas */}
      <div
        className="relative mx-3 my-3 rounded-lg bg-gray-950/80 border border-gray-800/40 overflow-hidden"
        style={{ height: `${CANVAS_H}px` }}
      >
        {/* Subtle dot grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id={`dots-${stage.name}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="10" cy="10" r="0.8" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#dots-${stage.name})`} />
        </svg>

        {/* Render parts as top-down rectangles */}
        {stage.parts.map((part, i) => {
          const cx = ((part.x - minX) / rangeX) * 100;
          const cy = ((part.z - minZ) / rangeZ) * 100;
          const pw = Math.max(part.sizeX * scale, 6);
          const ph = Math.max(part.sizeZ * scale, 6);
          const isActive = hovered === part.name;

          return (
            <div
              key={`${part.name}-${i}`}
              className={`absolute transition-all duration-150 ${isActive ? "z-20 ring-2 ring-white/30" : "z-10"}`}
              style={{
                left: `calc(${cx}% - ${pw / 2}px)`,
                top: `calc(${cy}% - ${ph / 2}px)`,
                width: `${pw}px`,
                height: `${ph}px`,
                backgroundColor: part.color,
                opacity: isActive ? 1 : Math.max(part.opacity * 0.85, 0.5),
                borderRadius: part.isCheckpoint ? "50%" : part.isHazard ? "2px" : "3px",
                border: part.isCheckpoint
                  ? "2px solid rgba(74,222,128,0.6)"
                  : part.isHazard
                    ? "2px solid rgba(248,113,113,0.5)"
                    : "1px solid rgba(255,255,255,0.08)",
                boxShadow: isActive
                  ? `0 0 12px ${part.color}66`
                  : part.isHazard
                    ? "0 0 6px rgba(220,50,50,0.25)"
                    : part.isCheckpoint
                      ? "0 0 6px rgba(60,200,100,0.2)"
                      : "none",
                transform: isActive ? "scale(1.15)" : "scale(1)",
              }}
              onMouseEnter={() => setHovered(part.name)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Tooltip */}
              {isActive && (
                <div className="absolute left-1/2 -translate-x-1/2 -top-8 whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-[10px] font-medium text-white shadow-lg border border-gray-700 pointer-events-none z-30">
                  {part.name}
                  {part.isCheckpoint && <span className="ml-1 text-emerald-400">checkpoint</span>}
                  {part.isHazard && <span className="ml-1 text-red-400">hazard</span>}
                </div>
              )}
            </div>
          );
        })}

        {stage.parts.length === 0 && (
          <div className="flex h-full items-center justify-center text-xs text-gray-600">
            Empty — ask AI to add parts
          </div>
        )}
      </div>

      {/* Part list */}
      <div className="flex flex-wrap gap-1 px-3 pb-3">
        {stage.parts.map((part, i) => (
          <button
            key={`pill-${i}`}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] transition-colors ${
              hovered === part.name
                ? "bg-gray-700 text-white"
                : "bg-gray-800/60 text-gray-500 hover:text-gray-300"
            }`}
            onMouseEnter={() => setHovered(part.name)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{
                backgroundColor: part.color,
                border: part.isCheckpoint
                  ? "1px solid rgba(74,222,128,0.6)"
                  : part.isHazard
                    ? "1px solid rgba(248,113,113,0.5)"
                    : "1px solid rgba(255,255,255,0.1)",
                borderRadius: part.isCheckpoint ? "50%" : "2px",
              }}
            />
            {part.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StageMapView() {
  const { projectState } = useProjectStore();

  const stageVisuals = useMemo(() => {
    if (!projectState) return [];
    return buildStageVisuals(projectState.hierarchy);
  }, [projectState]);

  if (!projectState || stageVisuals.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        <p>No stages to display yet.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-2">
          {stageVisuals.map((stage, i) => (
            <div key={stage.name}>
              <StageCard stage={stage} />
              {i < stageVisuals.length - 1 && (
                <div className="flex justify-center py-1">
                  <ArrowDown size={14} className="text-gray-700" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
