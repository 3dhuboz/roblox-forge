// ── Template Presets System ──
// Pre-populates each game template with a realistic starter world so users
// don't start with a blank canvas. Each preset provides canvas elements,
// instance hierarchy, and starter Luau scripts.

import type { CanvasElement, ElementCategory } from "../stores/canvasStore";
import type { ScriptFile, InstanceNode } from "../types/project";
import type { GameInstance } from "../stores/instanceStore";
import { getDefaultLogic } from "./gameLogic";
import { getObbyScripts, getTycoonScripts, getSimulatorScripts, getBattlegroundsScripts, getRpgScripts, getHorrorScripts, getRacingScripts, getMinigamesScripts, getIncrementalScripts, getBlankScripts } from "./templateScripts";

// ── Types ──

export interface TemplatePreset {
  id: string;
  label: string;
  description: string;
  hierarchy: GameInstance[];
  canvasElements: CanvasElement[];
  scripts: ScriptFile[];
  stageCount: number;
}

// ── Helpers ──

let _seq = 0;

function makeIdFactory(): () => string {
  // Each factory call gets its own independent counter sequence
  const base = ++_seq * 10000;
  let n = 0;
  return () => `preset_${base + ++n}`;
}

function makeElementHelper(template: string) {
  const pid = makeIdFactory();
  return function el(
    type: string,
    category: ElementCategory,
    label: string,
    icon: string,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    extra: Partial<CanvasElement> = {},
  ): CanvasElement {
    return {
      id: pid(),
      type,
      category,
      label,
      icon,
      x,
      y,
      width,
      height,
      color,
      rotation: 0,
      locked: false,
      visible: true,
      properties: {},
      logic: getDefaultLogic(type, template),
      ...extra,
    };
  };
}

function inst(
  id: string,
  name: string,
  children: GameInstance[] = [],
  isExpanded = true,
): GameInstance {
  return { id, name, children, isExpanded };
}

function v3(x: number, y: number, z: number) {
  return { Vector3: [x, y, z] };
}

function cf(x: number, y: number, z: number) {
  return { CFrame: { position: [x, y, z], orientation: [0, 0, 0, 1, 0, 0, 0, 1, 0] } };
}

function rgb(r: number, g: number, b: number) {
  return { Color3uint8: [r, g, b] };
}

function makeInstanceNode(
  className: string,
  name: string,
  children: InstanceNode[] = [],
  extra: Partial<InstanceNode> = {},
): InstanceNode {
  return { className, name, properties: {}, children, ...extra };
}

// ── Common DataModel wrapper ──

function wrapInDataModel(workspaceChildren: InstanceNode[], extraServices: InstanceNode[] = []): InstanceNode {
  return makeInstanceNode("DataModel", "DataModel", [
    makeInstanceNode("Workspace", "Workspace", [
      makeInstanceNode("Terrain", "Terrain"),
      ...workspaceChildren,
    ]),
    makeInstanceNode("Lighting", "Lighting"),
    makeInstanceNode("ReplicatedStorage", "ReplicatedStorage"),
    makeInstanceNode("ServerScriptService", "ServerScriptService", extraServices),
    makeInstanceNode("StarterPlayer", "StarterPlayer"),
    makeInstanceNode("SoundService", "SoundService"),
  ]);
}

// ── Preset: Obby ──

function obbyPreset(): TemplatePreset {
  const T = "obby";
  const el = makeElementHelper(T);
  const canvas: CanvasElement[] = [
    // ── Lobby (far left) ──
    el("spawn",    "mechanic",  "Spawn",        "user-plus",      100, 500,  30, 30, "#10b981"),
    el("ground",   "terrain",   "LobbyFloor",   "square",          50, 480, 150, 80, "#4a5568"),
    el("tree",     "decoration","Tree",          "tree-pine",       50, 440,  20, 40, "#166534"),

    // ── Stage 1 — blue platforms (wide spacing, stagger Z) ──
    el("platform",          "platform",  "Platform1A",    "minus",         300, 500, 60, 12, "#6366f1"),
    el("killbrick",         "obstacle",  "LavaPit1",      "skull",         420, 540, 40, 12, "#ef4444"),
    el("platform",          "platform",  "Platform1B",    "minus",         540, 460, 60, 12, "#6366f1"),
    el("moving-platform",   "platform",  "MovingPad1",    "move-horizontal",700, 500, 60, 12, "#06b6d4"),
    el("bouncy",            "platform",  "BouncePad",     "arrow-up",      860, 440, 50, 12, "#f472b6"),
    el("checkpoint",        "mechanic",  "Checkpoint1",   "flag",         1000, 480, 30, 30, "#22c55e"),

    // ── Stage 2 — yellow/purple platforms ──
    el("disappearing",      "platform",  "VanishPad1",    "eye-off",      1180, 520, 50, 12, "#fbbf24"),
    el("spinner",           "obstacle",  "Spinner1",      "rotate-cw",    1320, 460, 50, 10, "#f97316"),
    el("disappearing",      "platform",  "VanishPad2",    "eye-off",      1460, 500, 50, 12, "#fbbf24"),
    el("platform",          "platform",  "Platform2C",    "minus",        1600, 440, 60, 12, "#7c3aed"),
    el("checkpoint",        "mechanic",  "Checkpoint2",   "flag",         1750, 480, 30, 30, "#22c55e"),

    // ── Stage 3 — hard zone ──
    el("platform",          "platform",  "Platform3A",    "minus",        1940, 500, 60, 12, "#4c1d95"),
    el("killbrick",         "obstacle",  "LaserTrap",     "skull",        2080, 460, 40, 12, "#ef4444"),
    el("platform",          "platform",  "Platform3B",    "minus",        2220, 440, 60, 12, "#4c1d95"),
    el("platform",          "platform",  "VictoryPlatform","minus",       2400, 480, 80, 16, "#ffd700"),
    el("tree",              "decoration","Tree2",         "tree-pine",    2480, 440, 20, 40, "#166534"),
  ];

  const hierarchy: GameInstance[] = [
    inst("obby_dm", "DataModel", [
      inst("obby_ws", "Workspace", [
        inst("obby_lobby", "Lobby", [
          inst("obby_spawn", "Spawn"),
          inst("obby_lf", "LobbyFloor"),
        ]),
        inst("obby_stages", "Stages", [
          inst("obby_s1", "Stage1", [
            inst("obby_s1p1", "Platform1A"),
            inst("obby_s1p2", "Platform1B"),
            inst("obby_s1kb", "LavaPit1"),
            inst("obby_s1mp", "MovingPad1"),
            inst("obby_s1bp", "BouncePad"),
            inst("obby_s1cp", "Checkpoint1"),
          ]),
          inst("obby_s2", "Stage2", [
            inst("obby_s2v1", "VanishPad1"),
            inst("obby_s2v2", "VanishPad2"),
            inst("obby_s2sp", "Spinner1"),
            inst("obby_s2p3", "Platform2C"),
            inst("obby_s2cp", "Checkpoint2"),
          ]),
          inst("obby_s3", "Stage3", [
            inst("obby_s3p1", "Platform3A"),
            inst("obby_s3kb", "LaserTrap"),
            inst("obby_s3p2", "Platform3B"),
            inst("obby_s3vp", "VictoryPlatform"),
          ]),
        ]),
      ]),
      inst("obby_sss", "ServerScriptService"),
      inst("obby_rs",  "ReplicatedStorage"),
      inst("obby_sp",  "StarterPlayer"),
    ]),
  ];

  const scripts = getObbyScripts();

  return {
    id: "obby",
    label: "Obby",
    description: "Classic obstacle course with 3 stages, checkpoints, kill bricks, and a victory platform.",
    hierarchy,
    canvasElements: canvas,
    scripts,
    stageCount: 3,
  };
}

// ── Preset: Tycoon ──

function tycoonPreset(): TemplatePreset {
  const T = "tycoon";
  const el = makeElementHelper(T);
  const canvas: CanvasElement[] = [
    // ── Lobby (far left) ──
    el("spawn",          "mechanic",   "Spawn",          "user-plus",    80,  480,  30,  30,  "#10b981"),
    el("ground",         "terrain",    "LobbyGround",    "square",       40,  460, 120,  80,  "#4a5568"),
    el("tree",           "decoration", "LobbyTree1",     "tree-pine",    50,  420,  20,  40,  "#166534"),
    el("tree",           "decoration", "LobbyTree2",     "tree-pine",   140,  420,  20,  40,  "#166534"),

    // ── Plot 1 (left) — dropper → conveyor → collector, spread along Z ──
    el("tycoon-plot",    "structure",  "Plot1",          "grid-2x2",   300,  300, 140, 260,  "#228b22"),
    el("dropper",        "structure",  "Dropper1",       "arrow-down",  350,  310,  40,  40,  "#b0b0b0"),
    el("conveyor-belt",  "structure",  "Conveyor1",      "arrow-right", 340,  400,  80,  14,  "#555555"),
    el("collector",      "structure",  "Collector1",     "coins",       340,  460,  40,  30,  "#00cc00"),
    el("checkpoint",     "mechanic",   "ClaimPad1",      "flag",        350,  540,  40,  20,  "#22c55e"),
    el("upgrade-button", "structure",  "SpeedUpgrade",   "arrow-up",    470,  340,  40,  20,  "#ffcc00"),
    el("upgrade-button", "structure",  "ValueUpgrade",   "arrow-up",    470,  400,  40,  20,  "#ffcc00"),
    el("upgrade-button", "structure",  "CapacityUpgrade","arrow-up",    470,  460,  40,  20,  "#ffcc00"),

    // ── Plot 2 (center-right) — second player plot ──
    el("tycoon-plot",    "structure",  "Plot2",          "grid-2x2",   700,  300, 140, 260,  "#1a7a1a"),
    el("dropper",        "structure",  "Dropper2",       "arrow-down",  750,  310,  40,  40,  "#a0a0a0"),
    el("conveyor-belt",  "structure",  "Conveyor2",      "arrow-right", 740,  400,  80,  14,  "#555555"),
    el("collector",      "structure",  "Collector2",     "coins",       740,  460,  40,  30,  "#00cc00"),
    el("checkpoint",     "mechanic",   "ClaimPad2",      "flag",        750,  540,  40,  20,  "#22c55e"),

    // ── Shop Area (far right) ──
    el("shop-building",  "structure",  "UpgradeShop",    "store",      1050,  380,  80,  60,  "#daa520"),
    el("shopkeeper",     "character",  "Shopkeeper",     "shopping-bag",1070, 460,  20,  30,  "#eab308"),
    el("tree",           "decoration", "ShopTree",       "tree-pine",  1040,  340,  20,  40,  "#166534"),

    // ── Decorations ──
    el("rock",           "decoration", "Rock1",          "mountain",    560,  560,  24,  20,  "#6b7280"),
    el("fence",          "decoration", "PathFence",      "grip-horizontal", 200, 470, 60, 20, "#92400e"),
  ];

  const hierarchy: GameInstance[] = [
    inst("ty_dm", "DataModel", [
      inst("ty_ws", "Workspace", [
        inst("ty_lobby", "Lobby", [
          inst("ty_spawn",  "Spawn"),
          inst("ty_ground", "LobbyGround"),
        ]),
        inst("ty_plots", "Plots", [
          inst("ty_plot1", "Plot1", [
            inst("ty_tplot",    "TycoonPlot"),
            inst("ty_claim",    "ClaimPad"),
            inst("ty_dropper",  "OreDropper"),
            inst("ty_conv",     "ConveyorBelt"),
            inst("ty_coll",     "CashCollector"),
            inst("ty_upg1",     "SpeedUpgrade"),
            inst("ty_upg2",     "ValueUpgrade"),
          ]),
        ]),
        inst("ty_shop_area", "ShopArea", [
          inst("ty_shop",  "UpgradeShop"),
          inst("ty_npc",   "Shopkeeper"),
        ]),
      ]),
      inst("ty_sss", "ServerScriptService"),
      inst("ty_rs",  "ReplicatedStorage"),
      inst("ty_sp",  "StarterPlayer"),
    ]),
  ];

  const scripts = getTycoonScripts();

  return {
    id: "tycoon",
    label: "Tycoon",
    description: "Claim a plot, build droppers and conveyors, collect cash, and buy upgrades.",
    hierarchy,
    canvasElements: canvas,
    scripts,
    stageCount: 0,
  };
}

// ── Preset: Simulator ──

function simulatorPreset(): TemplatePreset {
  const T = "simulator";
  const el = makeElementHelper(T);
  const canvas: CanvasElement[] = [
    // ── Starter Zone (left) — click area ──
    el("spawn",      "mechanic",   "Spawn",         "user-plus",    80,  350,  40,  40,  "#10b981"),
    el("ground",     "terrain",    "StarterZone",   "square",       40,  400, 250, 200,  "#2d6a4f"),
    el("coin",       "mechanic",   "Coin1",         "coins",       100,  420,  24,  24,  "#eab308"),
    el("coin",       "mechanic",   "Coin2",         "coins",       150,  420,  24,  24,  "#eab308"),
    el("coin",       "mechanic",   "Coin3",         "coins",       200,  420,  24,  24,  "#eab308"),
    el("gem",        "mechanic",   "Gem1",          "diamond",     120,  470,  24,  24,  "#8b5cf6"),
    el("gem",        "mechanic",   "Gem2",          "diamond",     180,  470,  24,  24,  "#8b5cf6"),
    el("tree",       "decoration", "Tree1",         "tree-pine",    50,  320,  30,  60,  "#166534"),
    el("tree",       "decoration", "Tree2",         "tree-pine",   240,  320,  30,  60,  "#166534"),

    // ── Pet Area (center) — hatching eggs ──
    el("ground",     "terrain",    "PetZone",       "square",      360,  400, 200, 200,  "#1a5c3a"),
    el("npc",        "character",  "PetNPC",        "user",        400,  420,  28,  40,  "#22c55e"),
    el("portal",     "structure",  "EggHatchPortal","door-open",   480,  410,  40,  60,  "#9400d3"),
    el("bush",       "decoration", "Bush1",         "leaf",        370,  530,  32,  24,  "#15803d"),

    // ── Zone Portals (right) — progression ──
    el("portal",     "structure",  "Zone2Portal",   "door-open",   650,  360,  50,  70,  "#4f46e5"),
    el("portal",     "structure",  "Zone3Portal",   "door-open",   650,  470,  50,  70,  "#ef4444"),

    // ── Rebirth Area (far right) ──
    el("npc",        "character",  "RebirthNPC",    "user",        800,  420,  28,  40,  "#f472b6"),
    el("ground",     "terrain",    "RebirthPad",    "square",      780,  460, 100,  60,  "#3b0764"),
    el("rock",       "decoration", "Crystal1",      "mountain",    830,  380,  36,  28,  "#a78bfa"),
  ];

  const hierarchy: GameInstance[] = [
    inst("sim_dm", "DataModel", [
      inst("sim_ws", "Workspace", [
        inst("sim_starter", "StarterZone", [
          inst("sim_spawn",   "Spawn"),
          inst("sim_coins",   "Coins", [
            inst("sim_c1", "Coin1"),
            inst("sim_c2", "Coin2"),
            inst("sim_c3", "Coin3"),
          ]),
          inst("sim_gems",  "Gems", [
            inst("sim_g1", "Gem1"),
            inst("sim_g2", "Gem2"),
          ]),
        ]),
        inst("sim_pets", "PetArea", [
          inst("sim_petnpc", "PetNPC"),
          inst("sim_egg",    "EggHatchPortal"),
        ]),
        inst("sim_adv", "AdvancedZone", [
          inst("sim_zone",   "ZonePortal"),
          inst("sim_rebirth","RebirthNPC"),
        ]),
      ]),
      inst("sim_sss", "ServerScriptService"),
      inst("sim_rs",  "ReplicatedStorage"),
      inst("sim_sp",  "StarterPlayer"),
    ]),
  ];

  const scripts = getSimulatorScripts();

  return {
    id: "simulator",
    label: "Simulator",
    description: "Click coins and gems, hatch pets, portal to advanced zones, and rebirth for multipliers.",
    hierarchy,
    canvasElements: canvas,
    scripts,
    stageCount: 0,
  };
}

// ── Preset: Battlegrounds ──

function battlegroundsPreset(): TemplatePreset {
  const T = "battlegrounds";
  const el = makeElementHelper(T);
  const canvas: CanvasElement[] = [
    // Central arena
    el("arena",      "structure",  "MainArena",     "shield",       500,  390, 120, 120,  "#8b0000"),

    // Four spawn points around the edges
    el("spawn",      "mechanic",   "SpawnNorth",    "user-plus",    540,  290,  40,  40,  "#10b981"),
    el("spawn",      "mechanic",   "SpawnSouth",    "user-plus",    540,  560,  40,  40,  "#10b981"),
    el("spawn",      "mechanic",   "SpawnWest",     "user-plus",    390,  430,  40,  40,  "#10b981"),
    el("spawn",      "mechanic",   "SpawnEast",     "user-plus",    690,  430,  40,  40,  "#10b981"),

    // Hazards
    el("killbrick",  "obstacle",   "HazardZone1",   "skull",        500,  395,  60,  16,  "#ef4444"),
    el("killbrick",  "obstacle",   "HazardZone2",   "skull",        560,  470,  60,  16,  "#ef4444"),

    // Boost pads
    el("boost-pad",  "mechanic",   "BoostPad1",     "chevrons-right",490, 500,  60,  12,  "#06b6d4"),
    el("boost-pad",  "mechanic",   "BoostPad2",     "chevrons-right",570, 380,  60,  12,  "#06b6d4"),

    // Cover walls
    el("wall",       "structure",  "CoverWall1",    "square",       440,  430, 120,  60,  "#696969"),
    el("wall",       "structure",  "CoverWall2",    "square",       620,  460, 120,  60,  "#696969"),

    // Sniper tower
    el("tower",      "structure",  "SniperTower",   "building",     780,  300,  40, 120,  "#808080"),

    // Bridge crossing
    el("bridge",     "structure",  "CenterBridge",  "minus",        450,  455, 150,  20,  "#8b7355"),

    // Decorations
    el("rock",       "decoration", "Rock1",         "mountain",     390,  560,  36,  28,  "#6b7280"),
    el("rock",       "decoration", "Rock2",         "mountain",     660,  300,  36,  28,  "#6b7280"),
  ];

  const hierarchy: GameInstance[] = [
    inst("bg_dm", "DataModel", [
      inst("bg_ws", "Workspace", [
        inst("bg_arena", "Arena", [
          inst("bg_main",   "MainArena"),
          inst("bg_bridge", "CenterBridge"),
          inst("bg_tower",  "SniperTower"),
        ]),
        inst("bg_spawns", "Spawns", [
          inst("bg_sn", "SpawnNorth"),
          inst("bg_ss", "SpawnSouth"),
          inst("bg_sw", "SpawnWest"),
          inst("bg_se", "SpawnEast"),
        ]),
        inst("bg_hazards", "Hazards", [
          inst("bg_hz1", "HazardZone1"),
          inst("bg_hz2", "HazardZone2"),
        ]),
        inst("bg_cover", "CoverWalls", [
          inst("bg_w1", "CoverWall1"),
          inst("bg_w2", "CoverWall2"),
        ]),
      ]),
      inst("bg_sss", "ServerScriptService"),
      inst("bg_rs",  "ReplicatedStorage"),
      inst("bg_sp",  "StarterPlayer"),
    ]),
  ];

  const scripts = getBattlegroundsScripts();

  return {
    id: "battlegrounds",
    label: "Battlegrounds",
    description: "PvP arena with 4 spawn points, cover walls, boost pads, hazards, and a sniper tower.",
    hierarchy,
    canvasElements: canvas,
    scripts,
    stageCount: 0,
  };
}

// ── Preset: RPG ──

function rpgPreset(): TemplatePreset {
  const T = "rpg";
  const el = makeElementHelper(T);
  const canvas: CanvasElement[] = [
    // ── Town (left) — safe zone ──
    el("spawn",        "mechanic",   "TownSpawn",      "user-plus",     80,  450,  40,  40,  "#10b981"),
    el("ground",       "terrain",    "TownGround",     "square",        40,  400, 240, 200,  "#4a5568"),
    el("npc",          "character",  "QuestGiver",     "user",          140,  420,  28,  40,  "#22c55e"),
    el("shop-building","structure",  "ItemShop",       "store",         180,  340,  80,  70,  "#daa520"),
    el("shopkeeper",   "character",  "Merchant",       "shopping-bag",  200,  420,  28,  40,  "#eab308"),
    el("house",        "structure",  "House1",         "home",           60,  320, 100,  80,  "#a0522d"),
    el("coin",         "mechanic",   "Coin1",          "coins",         100,  510,  20,  20,  "#eab308"),
    el("coin",         "mechanic",   "Coin2",          "coins",         160,  510,  20,  20,  "#eab308"),
    el("tree",         "decoration", "Tree1",          "tree-pine",      50,  280,  30,  60,  "#166534"),

    // ── Forest Path (center) — bridge + river ──
    el("ground",       "terrain",    "ForestPath",     "square",       340,  420, 120, 120,  "#2d5a27"),
    el("bridge",       "structure",  "RiverBridge",    "minus",         340,  470, 120,  24,  "#8b7355"),
    el("water",        "terrain",    "River",          "square",        340,  500, 120,  40,  "#1e40af"),
    el("tree",         "decoration", "Tree2",          "tree-pine",     360,  380,  30,  60,  "#166534"),
    el("tree",         "decoration", "Tree3",          "tree-pine",     420,  390,  30,  60,  "#166534"),

    // ── Dungeon (center-right) — danger zone ──
    el("cave",         "structure",  "DungeonEntrance","mountain",      540,  350, 120,  80,  "#4a4a4a"),
    el("enemy",        "character",  "DungeonGuard",   "ghost",         570,  440,  32,  40,  "#dc2626"),
    el("enemy",        "character",  "DungeonEnemy",   "ghost",         620,  390,  32,  40,  "#dc2626"),
    el("rock",         "decoration", "DungeonRock",    "mountain",      540,  440,  36,  28,  "#6b7280"),

    // ── Boss Arena (far right) — final fight ──
    el("arena",        "structure",  "BossArena",      "shield",        750,  320, 150, 150,  "#8b0000"),
    el("boss",         "character",  "FinalBoss",      "crown",         800,  380,  48,  56,  "#7c3aed"),
    el("gem",          "mechanic",   "BossGem",        "diamond",       780,  440,  24,  24,  "#8b5cf6"),
  ];

  const hierarchy: GameInstance[] = [
    inst("rpg_dm", "DataModel", [
      inst("rpg_ws", "Workspace", [
        inst("rpg_town", "Town", [
          inst("rpg_spawn",  "TownSpawn"),
          inst("rpg_npc",    "QuestGiver"),
          inst("rpg_shop",   "ItemShop"),
          inst("rpg_merch",  "Merchant"),
          inst("rpg_h1",     "House1"),
          inst("rpg_h2",     "House2"),
        ]),
        inst("rpg_bridge",   "RiverBridge"),
        inst("rpg_dungeon",  "Dungeon", [
          inst("rpg_dcave",  "DungeonEntrance"),
          inst("rpg_guard",  "DungeonGuard"),
        ]),
        inst("rpg_boss_area","BossArea", [
          inst("rpg_arena",  "BossArena"),
          inst("rpg_boss",   "FinalBoss"),
        ]),
      ]),
      inst("rpg_sss", "ServerScriptService"),
      inst("rpg_rs",  "ReplicatedStorage"),
      inst("rpg_sp",  "StarterPlayer"),
    ]),
  ];

  const scripts = getRpgScripts();

  return {
    id: "rpg",
    label: "RPG",
    description: "Town with quest NPC, item shop, dungeon cave, bridge, boss arena, and scattered loot.",
    hierarchy,
    canvasElements: canvas,
    scripts,
    stageCount: 0,
  };
}

// ── Preset: Horror ──

function horrorPreset(): TemplatePreset {
  const T = "horror";
  const el = makeElementHelper(T);
  const canvas: CanvasElement[] = [
    // ── Room 1: Dark Spawn (top-left) ──
    el("ground",     "terrain",    "SpawnRoom",     "square",        60,  200, 160, 140,  "#1a1a1a"),
    el("spawn",      "mechanic",   "Spawn",         "user-plus",    110,  250,  40,  40,  "#10b981"),
    el("lamp",       "decoration", "DimLamp1",      "lamp",         160,  210,  16,  48,  "#fbbf24"),

    // ── Corridor 1 (connecting down) ──
    el("tunnel",     "structure",  "Corridor1",     "circle",       110,  380,  60,  60,  "#333333"),
    el("lamp",       "decoration", "DimLamp2",      "lamp",         100,  420,  16,  48,  "#fbbf24"),

    // ── Room 2: Puzzle Room (bottom-left) ──
    el("ground",     "terrain",    "PuzzleRoom",    "square",        60,  460, 180, 140,  "#222222"),
    el("gem",        "mechanic",   "DoorKey",       "diamond",      140,  500,  24,  24,  "#8b5cf6"),
    el("wall",       "structure",  "LockedDoor",    "square",       190,  490,  40,  80,  "#696969"),

    // ── Corridor 2 (connecting right) ──
    el("tunnel",     "structure",  "Corridor2",     "circle",       300,  500,  60,  60,  "#333333"),

    // ── Room 3: Jumpscare Hall (center) ──
    el("ground",     "terrain",    "JumpscareHall", "square",       400,  420, 180, 180,  "#1a1a1a"),
    el("enemy",      "character",  "JumpscareEntity","ghost",       470,  480,  32,  40,  "#7c3aed"),
    el("lamp",       "decoration", "Lamp3",         "lamp",         430,  430,  16,  48,  "#fbbf24"),

    // ── Room 4: Final Cave (right) ──
    el("cave",       "structure",  "FinalCave",     "mountain",     660,  350, 160, 120,  "#2a2a2a"),
    el("boss",       "character",  "CreatureBoss",  "crown",        710,  400,  48,  56,  "#dc2626"),
    el("lamp",       "decoration", "Lamp4",         "lamp",         680,  360,  16,  48,  "#fbbf24"),
  ];

  const hierarchy: GameInstance[] = [
    inst("hr_dm", "DataModel", [
      inst("hr_ws", "Workspace", [
        inst("hr_spawn_room", "SpawnRoom", [
          inst("hr_spawn",  "Spawn"),
          inst("hr_lamp1",  "DimLamp1"),
        ]),
        inst("hr_corridors", "Corridors", [
          inst("hr_c1", "Corridor1"),
          inst("hr_c2", "Corridor2"),
          inst("hr_lamp2", "DimLamp2"),
        ]),
        inst("hr_locked", "LockedSection", [
          inst("hr_door",  "LockedDoor"),
          inst("hr_key",   "DoorKey"),
          inst("hr_tp",    "KeyTeleporter"),
        ]),
        inst("hr_entity", "EnemyArea", [
          inst("hr_jump",  "JumpscareEntity"),
        ]),
        inst("hr_cave", "FinalCave", [
          inst("hr_boss",  "CreatureBoss"),
        ]),
      ]),
      inst("hr_sss", "ServerScriptService"),
      inst("hr_rs",  "ReplicatedStorage"),
      inst("hr_sp",  "StarterPlayer"),
    ]),
  ];

  const scripts = getHorrorScripts();

  return {
    id: "horror",
    label: "Horror",
    description: "Dark corridors, locked doors, key collectibles, jumpscare entities, and a final boss cave.",
    hierarchy,
    canvasElements: canvas,
    scripts,
    stageCount: 0,
  };
}

// ── Preset: Racing ──

function racingPreset(): TemplatePreset {
  const T = "racing";
  const el = makeElementHelper(T);
  const canvas: CanvasElement[] = [
    // ── Start/Finish Area (bottom-left) ──
    el("spawn",       "mechanic",   "VehicleSpawn",  "user-plus",    120,  520,  40,  40,  "#10b981"),
    el("portal",      "structure",  "StartLine",     "door-open",    180,  510,  30,  50,  "#ffd700"),

    // ── Bottom Straight (left → right) ──
    el("race-track",  "structure",  "Track1",        "route",        250,  520, 300,  40,  "#333333"),
    el("boost-pad",   "mechanic",   "BoostPad1",     "chevrons-right",380, 530,  60,  14,  "#06b6d4"),

    // ── Right Straight (bottom → top) ──
    el("race-track",  "structure",  "Track2",        "route",        570,  320,  40, 240,  "#333333"),
    el("checkpoint",  "mechanic",   "Checkpoint1",   "flag",         575,  400,  30,  30,  "#22c55e"),

    // ── Top Straight (right → left) ──
    el("race-track",  "structure",  "Track3",        "route",        250,  280, 300,  40,  "#333333"),
    el("boost-pad",   "mechanic",   "BoostPad2",     "chevrons-right",350, 290,  60,  14,  "#06b6d4"),

    // ── Left Straight (top → bottom) ──
    el("race-track",  "structure",  "Track4",        "route",        200,  320,  40, 240,  "#333333"),
    el("checkpoint",  "mechanic",   "Checkpoint2",   "flag",         205,  420,  30,  30,  "#22c55e"),

    // ── Finish Line (back at start) ──
    el("portal",      "structure",  "FinishLine",    "door-open",    180,  460,  30,  50,  "#9400d3"),

    // ── Inner Track Decorations ──
    el("ground",      "terrain",    "InfieldGrass",  "square",       280,  340, 240, 160,  "#2d6a27"),
    el("tree",        "decoration", "InfieldTree1",  "tree-pine",    340,  380,  30,  60,  "#166534"),
    el("tree",        "decoration", "InfieldTree2",  "tree-pine",    420,  400,  30,  60,  "#166534"),
    el("rock",        "decoration", "InfieldRock",   "mountain",     380,  440,  36,  28,  "#6b7280"),
  ];

  const hierarchy: GameInstance[] = [
    inst("rc_dm", "DataModel", [
      inst("rc_ws", "Workspace", [
        inst("rc_start", "StartArea", [
          inst("rc_spawn",  "VehicleSpawn"),
          inst("rc_start_portal", "StartLine"),
        ]),
        inst("rc_track", "Track", [
          inst("rc_t1", "Track1"),
          inst("rc_t2", "Track2"),
          inst("rc_t3", "Track3"),
          inst("rc_t4", "Track4"),
          inst("rc_t5", "Track5"),
        ]),
        inst("rc_checkpoints", "Checkpoints", [
          inst("rc_cp1", "Checkpoint1"),
          inst("rc_cp2", "Checkpoint2"),
        ]),
        inst("rc_boosts", "BoostPads", [
          inst("rc_bp1", "BoostPad1"),
          inst("rc_bp2", "BoostPad2"),
        ]),
        inst("rc_finish",  "FinishLine"),
      ]),
      inst("rc_sss", "ServerScriptService"),
      inst("rc_rs",  "ReplicatedStorage"),
      inst("rc_sp",  "StarterPlayer"),
    ]),
  ];

  const scripts = getRacingScripts();

  return {
    id: "racing",
    label: "Racing",
    description: "Vehicle spawn, multi-segment track with boost pads, checkpoints, and a finish line portal.",
    hierarchy,
    canvasElements: canvas,
    scripts,
    stageCount: 0,
  };
}

// ── Preset: Minigames ──

function minigamesPreset(): TemplatePreset {
  const T = "minigames";
  const el = makeElementHelper(T);
  const canvas: CanvasElement[] = [
    // ── Central Hub (middle) ──
    el("ground",       "terrain",    "HubGround",     "square",       350,  380, 200, 180,  "#4a5568"),
    el("spawn",        "mechanic",   "HubSpawn",      "user-plus",    420,  450,  40,  40,  "#10b981"),
    el("npc",          "character",  "VotingBoard",   "user",         430,  400,  28,  40,  "#22c55e"),
    el("coin",         "mechanic",   "HubCoin1",      "coins",        380,  420,  20,  20,  "#eab308"),
    el("coin",         "mechanic",   "HubCoin2",      "coins",        490,  420,  20,  20,  "#eab308"),

    // ── 3 Portals radiating from hub ──
    el("portal",       "structure",  "SurvivalPortal","door-open",    310,  390,  40,  60,  "#ef4444"),
    el("portal",       "structure",  "CollectPortal", "door-open",    430,  350,  40,  60,  "#06b6d4"),
    el("portal",       "structure",  "ObbyPortal",    "door-open",    550,  390,  40,  60,  "#22c55e"),

    // ── Arena 1: Survival (top-left) ──
    el("arena",        "structure",  "SurvivalArena", "shield",       100,  200, 160, 140,  "#8b0000"),
    el("spawn",        "mechanic",   "Arena1Spawn",   "user-plus",    150,  250,  40,  40,  "#10b981"),
    el("killbrick",    "obstacle",   "HazardBrick1",  "skull",        170,  290,  60,  16,  "#ef4444"),
    el("killbrick",    "obstacle",   "HazardBrick2",  "skull",        120,  310,  60,  16,  "#ef4444"),

    // ── Arena 2: Coin Collect (top-center) ──
    el("arena",        "structure",  "CollectArena",  "shield",       350,  120, 160, 140,  "#1d4ed8"),
    el("spawn",        "mechanic",   "Arena2Spawn",   "user-plus",    400,  170,  40,  40,  "#10b981"),
    el("coin",         "mechanic",   "ArenaCoin1",    "coins",        420,  200,  24,  24,  "#eab308"),
    el("coin",         "mechanic",   "ArenaCoin2",    "coins",        460,  180,  24,  24,  "#eab308"),
    el("coin",         "mechanic",   "ArenaCoin3",    "coins",        380,  220,  24,  24,  "#eab308"),

    // ── Arena 3: Obby (top-right) ──
    el("arena",        "structure",  "ObbyArena",     "shield",       610,  200, 160, 140,  "#065f46"),
    el("spawn",        "mechanic",   "Arena3Spawn",   "user-plus",    650,  240,  40,  40,  "#10b981"),
    el("platform",     "platform",   "ObbyPlat1",     "minus",        680,  260, 80,  16,  "#6366f1"),
    el("platform",     "platform",   "ObbyPlat2",     "minus",        710,  290, 80,  16,  "#6366f1"),
  ];

  const hierarchy: GameInstance[] = [
    inst("mg_dm", "DataModel", [
      inst("mg_ws", "Workspace", [
        inst("mg_hub", "Hub", [
          inst("mg_spawn",  "HubSpawn"),
          inst("mg_vote",   "VotingBoard"),
          inst("mg_p1",     "Portal1"),
          inst("mg_p2",     "Portal2"),
          inst("mg_p3",     "Portal3"),
        ]),
        inst("mg_a1", "SurvivalArena", [
          inst("mg_a1s",  "Arena1Spawn"),
          inst("mg_a1kb", "HazardBrick1"),
        ]),
        inst("mg_a2", "CollectArena", [
          inst("mg_a2s",  "Arena2Spawn"),
          inst("mg_a2c1", "ArenaCoin1"),
          inst("mg_a2c2", "ArenaCoin2"),
        ]),
        inst("mg_a3", "ObbyArena", [
          inst("mg_a3s",  "Arena3Spawn"),
          inst("mg_a3p",  "ObbyPlatform1"),
        ]),
      ]),
      inst("mg_sss", "ServerScriptService"),
      inst("mg_rs",  "ReplicatedStorage"),
      inst("mg_sp",  "StarterPlayer"),
    ]),
  ];

  const scripts = getMinigamesScripts();

  return {
    id: "minigames",
    label: "Minigames",
    description: "Central hub with voting NPC, portals to 3 distinct arenas (survival, collect, obby).",
    hierarchy,
    canvasElements: canvas,
    scripts,
    stageCount: 0,
  };
}

// ── Incremental Preset ──

function incrementalPreset(): TemplatePreset {
  const el = makeElementHelper("incremental");

  const canvas: CanvasElement[] = [
    // ── Central Click Area (hub) ──
    el("spawn",        "mechanic",   "Spawn",              "flag",        400, 450,  40,  40,  "#10b981"),
    el("ground",       "terrain",    "ClickZone",          "square",      300, 350, 200, 200,  "#1a3a2a"),
    el("click-orb",    "mechanic",   "ClickOrb1",          "circle-dot",  350, 380,  35,  35,  "#00ffff"),
    el("click-orb",    "mechanic",   "ClickOrb2",          "circle-dot",  420, 360,  35,  35,  "#00e5ff"),
    el("click-orb",    "mechanic",   "ClickOrb3",          "circle-dot",  380, 420,  35,  35,  "#00ccff"),
    el("click-orb",    "mechanic",   "ClickOrb4",          "circle-dot",  450, 420,  35,  35,  "#00b3ff"),
    el("click-orb",    "mechanic",   "ClickOrb5",          "circle-dot",  340, 460,  35,  35,  "#0099ff"),

    // ── Upgrade Shop (left of hub) ──
    el("upgrade-board","structure",  "UpgradeBoard",       "list",        100, 330,  80, 100,  "#4ade80"),
    el("npc",          "character",  "UpgradeNPC",         "user",        120, 440,  28,  40,  "#fbbf24"),
    el("tree",         "decoration", "Tree1",              "tree-pine",    60, 300,  30,  50,  "#22c55e"),

    // ── Prestige Altar (right of hub) ──
    el("prestige-pad", "mechanic",   "PrestigePad",        "refresh-cw",  620, 400,  70,  30,  "#ffd700"),
    el("ground",       "terrain",    "PrestigeGround",     "square",      590, 350, 130, 130,  "#2a1a0a"),
    el("rock",         "decoration", "PrestigeCrystal",    "gem",         650, 360,  30,  30,  "#fbbf24"),

    // ── Zone Portals (top, radiating from hub) ──
    el("zone-portal",  "mechanic",   "CrystalMinePortal",  "door-open",   300, 200,  50,  70,  "#8b5cf6"),
    el("zone-portal",  "mechanic",   "LavaForgePortal",    "door-open",   450, 200,  50,  70,  "#ef4444"),
    el("zone-portal",  "mechanic",   "SkyIslandPortal",    "door-open",   600, 200,  50,  70,  "#3b82f6"),

    // ── Decorations ──
    el("tree",         "decoration", "Tree2",              "tree-pine",   530, 510,  30,  50,  "#22c55e"),
    el("rock",         "decoration", "Crystal1",           "gem",         200, 480,  24,  24,  "#a78bfa"),
    el("rock",         "decoration", "Crystal2",           "gem",         250, 510,  24,  24,  "#c084fc"),
  ];

  const hierarchy: GameInstance[] = [
    inst("dm", "DataModel", [
      inst("ws", "Workspace", [
        inst("starter", "StarterZone", [
          inst("spawn", "Spawn"),
          inst("ground", "StarterGround"),
          inst("orbs", "ClickOrbs", [
            inst("o1", "Orb1"), inst("o2", "Orb2"), inst("o3", "Orb3"),
            inst("o4", "Orb4"), inst("o5", "Orb5"),
          ]),
        ]),
        inst("upgrade", "UpgradeArea", [
          inst("board", "UpgradeBoard"),
          inst("npc", "UpgradeNPC"),
        ]),
        inst("prestige", "PrestigeArea", [
          inst("pad", "PrestigePad"),
        ]),
        inst("zones", "Zones", [
          inst("cm", "CrystalMine_Portal"),
          inst("lf", "LavaForge_Portal"),
        ]),
      ]),
      inst("sss", "ServerScriptService"),
      inst("rs", "ReplicatedStorage"),
      inst("sp", "StarterPlayer"),
    ]),
  ];

  const scripts = getIncrementalScripts();

  return {
    id: "incremental",
    label: "Incremental",
    description: "Idle clicker with offline earnings, prestige layers, and automation unlocks.",
    hierarchy,
    canvasElements: canvas,
    scripts,
    stageCount: 0,
  };
}

// ── Blank/Custom Preset ──

function blankPreset(): TemplatePreset {
  const el = makeElementHelper("blank");

  const canvas: CanvasElement[] = [
    el("spawn", "mechanic", "Spawn", "flag", 400, 400, 30, 30, "#00ff00"),
    el("ground", "terrain", "Baseplate", "square", 200, 300, 600, 400, "#4a5568"),
  ];

  const hierarchy: GameInstance[] = [
    inst("dm", "DataModel", [
      inst("ws", "Workspace", [
        inst("spawn", "SpawnLocation"),
        inst("base", "Baseplate"),
      ]),
      inst("sss", "ServerScriptService"),
      inst("rs", "ReplicatedStorage"),
      inst("sp", "StarterPlayer"),
      inst("sg", "StarterGui"),
      inst("lt", "Lighting"),
      inst("ss", "SoundService"),
    ]),
  ];

  const scripts = getBlankScripts();

  return {
    id: "blank",
    label: "Custom Game",
    description: "Start with a blank canvas. Build any game type from scratch with AI assistance.",
    hierarchy,
    canvasElements: canvas,
    scripts,
    stageCount: 0,
  };
}

// ── Registry ──

const PRESETS: Record<string, () => TemplatePreset> = {
  obby:         obbyPreset,
  tycoon:       tycoonPreset,
  simulator:    simulatorPreset,
  battlegrounds: battlegroundsPreset,
  rpg:          rpgPreset,
  horror:       horrorPreset,
  racing:       racingPreset,
  minigames:    minigamesPreset,
  incremental:  incrementalPreset,
  blank:        blankPreset,
};

export function getTemplatePreset(templateId: string): TemplatePreset | null {
  const factory = PRESETS[templateId];
  if (!factory) return null;
  return factory();
}

// ── Utility: convert TemplatePreset hierarchy → InstanceNode ──

export function hierarchyToInstanceNode(instances: GameInstance[]): InstanceNode {
  function convert(inst: GameInstance): InstanceNode {
    return {
      className: "Folder",
      name: inst.name,
      properties: {},
      children: inst.children.map(convert),
    };
  }

  return {
    className: "DataModel",
    name: "DataModel",
    properties: {},
    children: instances.flatMap((i) =>
      i.name === "DataModel" ? i.children.map(convert) : [convert(i)],
    ),
  };
}
