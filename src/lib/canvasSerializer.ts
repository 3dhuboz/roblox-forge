import type { CanvasElement } from "../stores/canvasStore";

/**
 * Maps canvas element types to Roblox instance class names and visual properties.
 * Canvas uses a 2D coordinate system (x horizontal, y depth).
 * Roblox uses 3D: X = left/right, Y = up/down, Z = forward/back.
 *
 * Mapping: canvas.x → Roblox X, canvas ground level → Roblox Y, random Z scatter.
 */

interface RobloxModelNode {
  className: string;
  properties: Record<string, unknown>;
  children?: RobloxModelNode[];
}

function hexToColor3uint8(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

// Roblox Material Enum values
const MATERIALS = {
  plastic: 256,
  smoothPlastic: 272,
  neon: 288,
  glass: 1568,
  wood: 512,
  grass: 1284,
  sand: 1360,
  ice: 1536,
  slate: 800,
  concrete: 816,
  metal: 1040,
  brick: 848,
} as const;

function getMaterialForType(type: string): number {
  const map: Record<string, number> = {
    ground: MATERIALS.concrete,
    grass: MATERIALS.grass,
    water: MATERIALS.glass,
    lava: MATERIALS.neon,
    sand: MATERIALS.sand,
    ice: MATERIALS.ice,
    platform: MATERIALS.smoothPlastic,
    "moving-platform": MATERIALS.smoothPlastic,
    disappearing: MATERIALS.smoothPlastic,
    bouncy: MATERIALS.neon,
    conveyor: MATERIALS.metal,
    killbrick: MATERIALS.neon,
    spinner: MATERIALS.metal,
    laser: MATERIALS.neon,
    spikes: MATERIALS.metal,
    tree: MATERIALS.wood,
    rock: MATERIALS.slate,
    fence: MATERIALS.wood,
    house: MATERIALS.brick,
    "shop-building": MATERIALS.brick,
    wall: MATERIALS.concrete,
    bridge: MATERIALS.wood,
  };
  return map[type] ?? MATERIALS.smoothPlastic;
}

/** Scale factor: canvas pixels → Roblox studs */
const SCALE = 0.5;

function elementToInstance(el: CanvasElement): RobloxModelNode {
  const sizeX = el.width * SCALE;
  const sizeZ = el.height * SCALE;
  const sizeY = getSizeY(el.type);

  const posX = el.x * SCALE;
  const posY = sizeY / 2; // sit on ground
  const posZ = el.y * SCALE;

  // Convert rotation (degrees around Y-axis) to Rojo CFrame orientation matrix
  const theta = (el.rotation * Math.PI) / 180;
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  // Rotation matrix rows for Y-axis rotation:
  // [cosθ, 0, sinθ, 0, 1, 0, -sinθ, 0, cosθ]
  const orientation = [cosT, 0, sinT, 0, 1, 0, -sinT, 0, cosT];

  const className = getClassName(el.type);
  const node: RobloxModelNode = {
    className,
    properties: {
      Name: { String: el.label || el.type },
      Size: { Vector3: [sizeX, sizeY, sizeZ] },
      CFrame: {
        CFrame: {
          position: [posX, posY, posZ],
          orientation,
        },
      },
      Color3uint8: { Color3uint8: hexToColor3uint8(el.color) },
      Material: { Enum: getMaterialForType(el.type) },
      Anchored: { Bool: true },
    },
  };

  // Special types get extra children or properties
  if (el.type === "checkpoint" || el.type === "spawn") {
    node.className = "SpawnLocation";
    (node.properties as Record<string, unknown>).Neutral = { Bool: true };
  }

  if (el.type === "coin" || el.type === "gem") {
    node.properties.Size = { Vector3: [2, 2, 0.5] };
    node.properties.Material = { Enum: MATERIALS.neon };
    (node.properties as Record<string, unknown>).Shape = { Enum: 2 };
  }

  // Emit CollectionService Tags for behavior scripts
  const tagMap: Record<string, string> = {
    "moving-platform": "MovingPlatform",
    "disappearing": "DisappearPlatform",
    "bouncy": "BouncyPlatform",
    "spinner": "Spinner",
    "conveyor": "Conveyor",
    "killbrick": "KillBrick",
  };
  const tag = tagMap[el.type];
  if (tag) {
    (node.properties as Record<string, unknown>).Tags = { Tags: [tag] };
  }

  // Emit Attributes for behavior parameters from game logic
  const attrs: Record<string, unknown> = {};
  const logic = el.logic;
  if (logic) {
    if ("moveSpeed" in logic && logic.moveSpeed) attrs.MoveSpeed = { Float64: logic.moveSpeed };
    if ("moveDistance" in logic && logic.moveDistance) attrs.MoveDistance = { Float64: logic.moveDistance };
    if ("moveDirection" in logic && logic.moveDirection) attrs.MoveDirection = { String: logic.moveDirection };
    if ("disappearDelay" in logic && logic.disappearDelay) attrs.DisappearDelay = { Float64: logic.disappearDelay };
    if ("reappearDelay" in logic && logic.reappearDelay) attrs.ReappearDelay = { Float64: logic.reappearDelay };
    if ("bounceForce" in logic && logic.bounceForce) attrs.BounceForce = { Float64: logic.bounceForce };
    if ("spinSpeed" in logic && logic.spinSpeed) attrs.SpinSpeed = { Float64: logic.spinSpeed };
    if ("conveyorSpeed" in logic && logic.conveyorSpeed) attrs.ConveyorSpeed = { Float64: logic.conveyorSpeed };
    if ("conveyorDirection" in logic && logic.conveyorDirection) attrs.ConveyorDirection = { String: logic.conveyorDirection };
  }
  if (Object.keys(attrs).length > 0) {
    (node.properties as Record<string, unknown>).Attributes = { Attributes: attrs };
  }

  return node;
}

function getClassName(type: string): string {
  if (type === "checkpoint" || type === "spawn") return "SpawnLocation";
  return "Part";
}

function getSizeY(type: string): number {
  const heights: Record<string, number> = {
    ground: 3,
    grass: 3,
    water: 2,
    lava: 1,
    sand: 3,
    ice: 2,
    platform: 2,
    "moving-platform": 2,
    disappearing: 2,
    bouncy: 1,
    conveyor: 1,
    killbrick: 1,
    spinner: 1.5,
    laser: 0.5,
    spikes: 2,
    tree: 10,
    rock: 4,
    bush: 2,
    lamp: 8,
    fence: 4,
    checkpoint: 1,
    spawn: 1,
    coin: 2,
    gem: 2,
    house: 12,
    "shop-building": 10,
    cave: 8,
    tower: 20,
    bridge: 2,
    wall: 8,
    tunnel: 8,
    arena: 1,
    "tycoon-plot": 1,
    machine: 6,
    dropper: 8,
    "conveyor-belt": 1,
    collector: 3,
    "upgrade-button": 1,
    "race-track": 0.5,
    portal: 8,
    "market-stall": 6,
    teleporter: 6,
    "boost-pad": 0.5,
    enemy: 5,
    pet: 3,
    npc: 5,
    boss: 8,
    shopkeeper: 5,
  };
  return heights[type] ?? 4;
}

/**
 * Serialize all canvas elements into a Roblox model.json string.
 * This produces a Folder containing all placed parts.
 */
// Roblox Terrain material names for FillBlock()
const TERRAIN_MATERIALS: Record<string, string> = {
  grass: "Grass",
  water: "Water",
  sand: "Sand",
  ice: "Ice",
  ground: "Ground",
  lava: "CrackedLava",
};

/**
 * Generate a Luau startup script that fills terrain blocks for terrain-type elements.
 * Returns null if no terrain elements exist.
 */
export function generateTerrainScript(elements: CanvasElement[]): string | null {
  const terrainElements = elements.filter(
    (el) => el.visible && TERRAIN_MATERIALS[el.type],
  );

  if (terrainElements.length === 0) return null;

  const lines: string[] = [
    "-- TerrainFill: auto-generated from canvas terrain elements",
    "-- Fills terrain blocks on server startup, then deletes itself from workspace",
    "",
    "local Terrain = workspace.Terrain",
    "",
  ];

  for (const el of terrainElements) {
    const material = TERRAIN_MATERIALS[el.type];
    // Convert canvas coords to Roblox world coords
    const rx = ((el.x - 700) / 50) * 4; // studs
    const rz = ((el.y - 350) / 50) * 4;
    const sx = (el.width / 50) * 4;
    const sy = el.type === "water" ? 8 : 4; // water is deeper
    const sz = (el.height / 50) * 4;
    const yOffset = el.type === "water" ? -4 : -2; // water sits lower

    lines.push(
      `Terrain:FillBlock(CFrame.new(${rx}, ${yOffset}, ${rz}), Vector3.new(${sx}, ${sy}, ${sz}), Enum.Material.${material})`,
    );
  }

  lines.push("");
  lines.push("print(\"Terrain generated: \" .. tostring(" + terrainElements.length + ") .. \" blocks\")");

  return lines.join("\n");
}

export function serializeCanvasToModelJson(elements: CanvasElement[]): string {
  const children = elements
    .filter((el) => el.visible)
    .map(elementToInstance);

  const model: RobloxModelNode = {
    className: "Folder",
    properties: {
      Name: { String: "CanvasWorld" },
    },
    children,
  };

  return JSON.stringify(model, null, 2);
}
