/**
 * Converts real Roblox project state (InstanceNodes from the backend)
 * into CanvasElements for the 3D preview.
 *
 * This makes the 3D canvas a READ view of the actual project files,
 * rather than a disconnected parallel state.
 */

import type { InstanceNode } from "../types/project";
import type { CanvasElement, ElementCategory } from "../stores/canvasStore";
import { getDefaultLogic } from "./gameLogic";

let idCounter = 0;
function nextId(): string {
  return `proj_${++idCounter}_${Date.now()}`;
}

/** Map Roblox class names to canvas element types. */
function classToElementType(className: string, name: string, tags: string[]): { type: string; category: ElementCategory } {
  // Check tags first (more specific)
  if (tags.includes("KillBrick")) return { type: "killbrick", category: "obstacle" };
  if (tags.includes("MovingPlatform")) return { type: "moving-platform", category: "platform" };
  if (tags.includes("DisappearPlatform")) return { type: "disappearing", category: "platform" };
  if (tags.includes("BouncyPlatform")) return { type: "bouncy", category: "platform" };
  if (tags.includes("Spinner")) return { type: "spinner", category: "obstacle" };
  if (tags.includes("Conveyor")) return { type: "conveyor", category: "platform" };
  if (tags.includes("Enemy")) return { type: "enemy", category: "character" };
  if (tags.includes("ClaimButton")) return { type: "checkpoint", category: "mechanic" };
  if (tags.includes("Dropper")) return { type: "machine", category: "structure" };
  if (tags.includes("Collector")) return { type: "collector", category: "structure" };
  if (tags.includes("UpgradeButton")) return { type: "upgrade-button", category: "structure" };
  if (tags.includes("EggHatchPad")) return { type: "teleporter", category: "mechanic" };
  if (tags.includes("VehicleSpawn")) return { type: "spawn", category: "mechanic" };

  // Check name patterns
  const lowerName = name.toLowerCase();
  if (lowerName.includes("spawn") || lowerName.includes("checkpoint")) return { type: "checkpoint", category: "mechanic" };
  if (lowerName.includes("coin")) return { type: "coin", category: "mechanic" };
  if (lowerName.includes("gem")) return { type: "gem", category: "mechanic" };
  if (lowerName.includes("tree")) return { type: "tree", category: "decoration" };
  if (lowerName.includes("rock")) return { type: "rock", category: "decoration" };
  if (lowerName.includes("water")) return { type: "water", category: "terrain" };
  if (lowerName.includes("lava")) return { type: "lava", category: "terrain" };
  if (lowerName.includes("grass")) return { type: "grass", category: "terrain" };
  if (lowerName.includes("sand")) return { type: "sand", category: "terrain" };
  if (lowerName.includes("ice")) return { type: "ice", category: "terrain" };
  if (lowerName.includes("npc")) return { type: "npc", category: "character" };

  // By class name
  if (className === "SpawnLocation") return { type: "spawn", category: "mechanic" };

  // Default: generic platform/part
  return { type: "platform", category: "platform" };
}

/** Extract position from Roblox CFrame property. */
function extractPosition(properties: Record<string, unknown>): { x: number; y: number; z: number } {
  const cframe = properties.CFrame as { CFrame?: { position?: number[] } } | undefined;
  if (cframe?.CFrame?.position && Array.isArray(cframe.CFrame.position)) {
    const [x, y, z] = cframe.CFrame.position;
    return { x: x ?? 0, y: y ?? 0, z: z ?? 0 };
  }
  return { x: 0, y: 0, z: 0 };
}

/** Extract size from Vector3 property. */
function extractSize(properties: Record<string, unknown>): { w: number; h: number; d: number } {
  const size = properties.Size as { Vector3?: number[] } | undefined;
  if (size?.Vector3 && Array.isArray(size.Vector3)) {
    const [w, h, d] = size.Vector3;
    return { w: w ?? 4, h: h ?? 1, d: d ?? 4 };
  }
  return { w: 4, h: 1, d: 4 };
}

/** Extract color from Color3uint8 property. */
function extractColor(properties: Record<string, unknown>): string {
  const color = properties.Color3uint8 as { Color3uint8?: number[] } | undefined;
  if (color?.Color3uint8 && Array.isArray(color.Color3uint8)) {
    const [r, g, b] = color.Color3uint8;
    return `#${(r ?? 128).toString(16).padStart(2, "0")}${(g ?? 128).toString(16).padStart(2, "0")}${(b ?? 128).toString(16).padStart(2, "0")}`;
  }
  return "#808080";
}

/** Scale factor: Roblox studs → canvas pixels (inverse of serializer). */
const INVERSE_SCALE = 1 / 0.5; // = 2

/**
 * Convert a project's InstanceNode hierarchy into CanvasElements.
 * Only converts Part-like instances (Part, SpawnLocation, etc.)
 */
export function projectStateToCanvasElements(
  hierarchy: InstanceNode,
  template: string,
): CanvasElement[] {
  const elements: CanvasElement[] = [];
  idCounter = 0;

  function walk(node: InstanceNode) {
    // Only convert Part-like instances
    const partClasses = ["Part", "SpawnLocation", "WedgePart", "MeshPart", "UnionOperation"];
    if (partClasses.includes(node.className)) {
      const tags = node.tags ?? [];
      const { type, category } = classToElementType(node.className, node.name, tags);
      const pos = extractPosition(node.properties);
      const size = extractSize(node.properties);
      const color = extractColor(node.properties);

      elements.push({
        id: nextId(),
        type,
        category,
        label: node.name,
        icon: "square",
        x: pos.x * INVERSE_SCALE,
        y: pos.z * INVERSE_SCALE, // Roblox Z → canvas Y
        width: size.w * INVERSE_SCALE,
        height: size.d * INVERSE_SCALE,
        color,
        rotation: 0,
        locked: true, // Read-only from project
        visible: true,
        properties: {},
        logic: getDefaultLogic(type, template),
      });
    }

    // Recurse into children
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(hierarchy);
  return elements;
}
