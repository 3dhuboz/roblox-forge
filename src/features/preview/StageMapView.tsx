import { useMemo } from "react";
import { useProjectStore } from "../../stores/projectStore";
import type { InstanceNode } from "../../types/project";

interface PartVisual {
  name: string;
  className: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
  tags: string[];
  isCheckpoint: boolean;
}

interface StageVisual {
  name: string;
  parts: PartVisual[];
  index: number;
}

function extractColor(node: InstanceNode): string {
  const c = node.properties?.Color3uint8;
  if (c && typeof c === "object" && "Color3uint8" in c) {
    const [r, g, b] = c.Color3uint8 as number[];
    return `rgb(${r},${g},${b})`;
  }
  if (node.tags?.includes("KillBrick")) return "#ef4444";
  if (node.className === "SpawnLocation") return "#22c55e";
  return "#6366f1";
}

function extractSize(node: InstanceNode): { w: number; h: number } {
  const s = node.properties?.Size;
  if (s && typeof s === "object" && "Vector3" in s) {
    const [x, _y, z] = s.Vector3 as number[];
    return { w: Math.max(x * 4, 8), h: Math.max(z * 4, 8) };
  }
  return { w: 32, h: 32 };
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

function buildStageVisuals(hierarchy: InstanceNode): StageVisual[] {
  const stages: StageVisual[] = [];

  const workspace = hierarchy.children.find((c) => c.className === "Workspace" || c.name === "Workspace");
  if (!workspace) return stages;

  // Find Lobby
  const lobby = workspace.children.find((c) => c.name === "Lobby");
  if (lobby) {
    stages.push({
      name: "Lobby",
      index: 0,
      parts: lobby.children.map((child) => {
        const size = extractSize(child);
        const pos = extractPosition(child);
        return {
          name: child.name,
          className: child.className,
          x: pos.x * 4 + 100,
          y: pos.z * 2 + 40,
          width: size.w,
          height: size.h,
          color: extractColor(child),
          opacity: 1 - (child.properties?.Transparency as number || 0),
          tags: child.tags || [],
          isCheckpoint: child.className === "SpawnLocation",
        };
      }),
    });
  }

  // Find Stages folder
  const stagesFolder = workspace.children.find((c) => c.name === "Stages");
  if (stagesFolder) {
    const sorted = [...stagesFolder.children].sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, "")) || 0;
      const numB = parseInt(b.name.replace(/\D/g, "")) || 0;
      return numA - numB;
    });

    sorted.forEach((stage, i) => {
      stages.push({
        name: stage.name,
        index: i + 1,
        parts: stage.children.map((child) => {
          const size = extractSize(child);
          const pos = extractPosition(child);
          return {
            name: child.name,
            className: child.className,
            x: pos.x * 4 + 100,
            y: pos.z * 2 + 40,
            width: size.w,
            height: size.h,
            color: extractColor(child),
            opacity: 1 - (child.properties?.Transparency as number || 0),
            tags: child.tags || [],
            isCheckpoint: child.className === "SpawnLocation",
          };
        }),
      });
    });
  }

  return stages;
}

const STAGE_COLORS = [
  "from-indigo-900/40 to-indigo-950/20",
  "from-green-900/40 to-green-950/20",
  "from-amber-900/40 to-amber-950/20",
  "from-red-900/40 to-red-950/20",
  "from-purple-900/40 to-purple-950/20",
  "from-cyan-900/40 to-cyan-950/20",
  "from-pink-900/40 to-pink-950/20",
  "from-orange-900/40 to-orange-950/20",
  "from-teal-900/40 to-teal-950/20",
  "from-blue-900/40 to-blue-950/20",
  "from-rose-900/40 to-rose-950/20",
  "from-lime-900/40 to-lime-950/20",
  "from-yellow-900/40 to-yellow-950/20",
];

const STAGE_BORDERS = [
  "border-indigo-800/60",
  "border-green-800/60",
  "border-amber-800/60",
  "border-red-800/60",
  "border-purple-800/60",
  "border-cyan-800/60",
  "border-pink-800/60",
  "border-orange-800/60",
  "border-teal-800/60",
  "border-blue-800/60",
  "border-rose-800/60",
  "border-lime-800/60",
  "border-yellow-800/60",
];

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
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <h3 className="font-semibold text-gray-300">Stage Map</h3>
        <span className="text-xs text-gray-500">
          {stageVisuals.length} sections
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-3">
          {stageVisuals.map((stage) => {
            const colorIdx = stage.index % STAGE_COLORS.length;
            const partCount = stage.parts.length;
            const checkpoints = stage.parts.filter((p) => p.isCheckpoint).length;
            const hazards = stage.parts.filter(
              (p) => p.tags.includes("KillBrick") || p.tags.includes("Hazard"),
            ).length;

            return (
              <div
                key={stage.name}
                className={`rounded-xl border bg-gradient-to-b p-4 ${STAGE_BORDERS[colorIdx]} ${STAGE_COLORS[colorIdx]}`}
              >
                {/* Stage header */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gray-800 text-xs font-bold">
                      {stage.index === 0 ? "L" : stage.index}
                    </span>
                    <span className="text-sm font-semibold">{stage.name}</span>
                  </div>
                  <div className="flex gap-2 text-xs text-gray-400">
                    <span>{partCount} parts</span>
                    {checkpoints > 0 && (
                      <span className="text-green-400">
                        {checkpoints} checkpoint{checkpoints > 1 ? "s" : ""}
                      </span>
                    )}
                    {hazards > 0 && (
                      <span className="text-red-400">
                        {hazards} hazard{hazards > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Visual part layout */}
                <div className="relative h-24 overflow-hidden rounded-lg bg-gray-950/60">
                  {/* Grid lines */}
                  <div className="absolute inset-0 opacity-10">
                    {[...Array(10)].map((_, i) => (
                      <div
                        key={`v-${i}`}
                        className="absolute top-0 h-full border-l border-gray-500"
                        style={{ left: `${i * 10}%` }}
                      />
                    ))}
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={`h-${i}`}
                        className="absolute left-0 w-full border-t border-gray-500"
                        style={{ top: `${i * 33}%` }}
                      />
                    ))}
                  </div>

                  {/* Parts */}
                  {stage.parts.length > 0 ? (
                    stage.parts.map((part, i) => {
                      // Normalize positions to fit within the view
                      const allX = stage.parts.map((p) => p.x);
                      const allY = stage.parts.map((p) => p.y);
                      const minX = Math.min(...allX) - 20;
                      const maxX = Math.max(...allX) + 60;
                      const minY = Math.min(...allY) - 10;
                      const maxY = Math.max(...allY) + 40;
                      const rangeX = Math.max(maxX - minX, 1);
                      const rangeY = Math.max(maxY - minY, 1);

                      const normX = ((part.x - minX) / rangeX) * 90 + 2;
                      const normY = ((part.y - minY) / rangeY) * 70 + 5;
                      const normW = Math.min((part.width / rangeX) * 90, 40);
                      const normH = Math.min((part.height / rangeY) * 70, 30);

                      return (
                        <div
                          key={`${part.name}-${i}`}
                          className="group absolute rounded-sm border border-white/10 transition-all hover:z-10 hover:scale-110 hover:border-white/40"
                          style={{
                            left: `${normX}%`,
                            top: `${normY}%`,
                            width: `${Math.max(normW, 3)}%`,
                            height: `${Math.max(normH, 12)}%`,
                            backgroundColor: part.color,
                            opacity: Math.max(part.opacity, 0.4),
                          }}
                          title={`${part.name} (${part.className})${part.tags.length > 0 ? ` [${part.tags.join(", ")}]` : ""}`}
                        >
                          {/* Checkpoint marker */}
                          {part.isCheckpoint && (
                            <div className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-gray-900 bg-green-400" />
                          )}
                          {/* Kill brick marker */}
                          {part.tags.includes("KillBrick") && (
                            <div className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-gray-900 bg-red-400" />
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-600">
                      Empty stage
                    </div>
                  )}
                </div>

                {/* Part legend row */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {stage.parts.map((part, i) => (
                    <span
                      key={`legend-${i}`}
                      className="flex items-center gap-1 rounded-full bg-gray-800/80 px-2 py-0.5 text-[10px] text-gray-400"
                    >
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: part.color }}
                      />
                      {part.name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Flow connector */}
          {stageVisuals.length > 1 && (
            <div className="flex items-center justify-center py-1">
              <span className="text-xs text-gray-600">
                {stageVisuals.length - 1} stage
                {stageVisuals.length - 1 > 1 ? "s" : ""} total
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
