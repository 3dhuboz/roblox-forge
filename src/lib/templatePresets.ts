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
    // Lobby / spawn
    el("spawn",    "mechanic",  "Spawn",        "user-plus",       60,  580, 40,  40,  "#10b981"),
    el("ground",   "terrain",   "LobbyFloor",   "square",          50,  630, 200, 40,  "#4a5568"),
    el("tree",     "decoration","Tree",          "tree-pine",       30,  560, 30,  60,  "#166534"),
    el("rock",     "decoration","Rock",          "mountain",        200, 625, 36,  28,  "#6b7280"),

    // Stage 1 — blue platforms
    el("platform",          "platform",  "Platform1A",    "minus",          310, 570, 100, 16, "#6366f1"),
    el("platform",          "platform",  "Platform1B",    "minus",          460, 540, 100, 16, "#6366f1"),
    el("killbrick",         "obstacle",  "LavaPit1",      "skull",          420, 620,  60, 16, "#ef4444"),
    el("moving-platform",   "platform",  "MovingPad1",    "move-horizontal",610, 510, 100, 16, "#06b6d4"),
    el("bouncy",            "platform",  "BouncePad",     "arrow-up",       760, 490,  80, 16, "#f472b6"),
    el("checkpoint",        "mechanic",  "Checkpoint1",   "flag",           870, 480,  40, 40, "#22c55e"),

    // Stage 2 — purple platforms
    el("disappearing",      "platform",  "VanishPad1",    "eye-off",        980, 450,  80, 16, "#fbbf24"),
    el("disappearing",      "platform",  "VanishPad2",    "eye-off",       1090, 430,  80, 16, "#fbbf24"),
    el("spinner",           "obstacle",  "Spinner1",      "rotate-cw",     1040, 410,  80, 12, "#f97316"),
    el("platform",          "platform",  "Platform2C",    "minus",         1180, 400, 100, 16, "#7c3aed"),
    el("checkpoint",        "mechanic",  "Checkpoint2",   "flag",          1290, 390,  40, 40, "#22c55e"),

    // Stage 3 — hard zone
    el("platform",          "platform",  "Platform3A",    "minus",         1130, 300, 100, 16, "#4c1d95"),
    el("killbrick",         "obstacle",  "LaserTrap",     "skull",         1240, 290,  60, 16, "#ef4444"),
    el("platform",          "platform",  "Platform3B",    "minus",         1310, 260, 100, 16, "#4c1d95"),
    el("platform",          "platform",  "VictoryPlatform","minus",        1230, 160, 120, 16, "#ffd700"),
    el("tree",              "decoration","Tree2",         "tree-pine",     1360, 140,  30, 60, "#166534"),
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
    // Spawn & lobby
    el("spawn",          "mechanic",   "Spawn",          "user-plus",    60,  580,  40,  40,  "#10b981"),
    el("ground",         "terrain",    "LobbyGround",    "square",       50,  630, 200,  40,  "#4a5568"),

    // Tycoon plot
    el("tycoon-plot",    "structure",  "TycoonPlot",     "grid-2x2",    350,  430, 100, 100,  "#228b22"),
    el("checkpoint",     "mechanic",   "ClaimPad",       "flag",         350,  545,  40,  40,  "#22c55e"),

    // Production chain
    el("dropper",        "structure",  "OreDropper",     "arrow-down",  370,  380,  40,  60,  "#a0a0a0"),
    el("conveyor-belt",  "structure",  "ConveyorBelt",   "arrow-right", 420,  490, 120,  20,  "#444444"),
    el("collector",      "structure",  "CashCollector",  "coins",       550,  475,  40,  40,  "#00cc00"),

    // Upgrades
    el("upgrade-button", "structure",  "SpeedUpgrade",   "arrow-up",    270,  490,  40,  30,  "#ffcc00"),
    el("upgrade-button", "structure",  "ValueUpgrade",   "arrow-up",    270,  535,  40,  30,  "#ffcc00"),

    // Shop building and NPC
    el("shop-building",  "structure",  "UpgradeShop",    "store",       660,  430,  80,  70,  "#daa520"),
    el("shopkeeper",     "character",  "Shopkeeper",     "shopping-bag",680,  510,  28,  40,  "#eab308"),

    // Fences around plot
    el("fence",          "decoration", "FenceNorth",     "grip-horizontal", 350, 390, 120, 28, "#92400e"),
    el("fence",          "decoration", "FenceSouth",     "grip-horizontal", 350, 540, 120, 28, "#92400e"),
    el("fence",          "decoration", "FenceWest",      "grip-horizontal", 310, 430,  80, 28, "#92400e", { rotation: 90 }),
    el("fence",          "decoration", "FenceEast",      "grip-horizontal", 490, 430,  80, 28, "#92400e", { rotation: 90 }),

    // Decoration
    el("tree",           "decoration", "Tree1",          "tree-pine",   220,  590,  30,  60,  "#166534"),
    el("tree",           "decoration", "Tree2",          "tree-pine",   760,  400,  30,  60,  "#166534"),
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
    // Spawn & starter zone
    el("spawn",      "mechanic",   "Spawn",         "user-plus",    60,  580,  40,  40,  "#10b981"),
    el("ground",     "terrain",    "StarterZone",   "square",       50,  630, 300,  40,  "#2d6a4f"),

    // Click coins / gems
    el("coin",       "mechanic",   "Coin1",         "coins",       200,  570,  20,  20,  "#eab308"),
    el("coin",       "mechanic",   "Coin2",         "coins",       230,  570,  20,  20,  "#eab308"),
    el("coin",       "mechanic",   "Coin3",         "coins",       260,  570,  20,  20,  "#eab308"),
    el("gem",        "mechanic",   "Gem1",          "diamond",     290,  560,  20,  20,  "#8b5cf6"),
    el("gem",        "mechanic",   "Gem2",          "diamond",     320,  560,  20,  20,  "#8b5cf6"),

    // Pet area
    el("npc",        "character",  "PetNPC",        "user",        420,  570,  28,  40,  "#22c55e"),
    el("portal",     "structure",  "EggHatchPortal","door-open",   490,  540,  40,  60,  "#9400d3"),

    // Advanced zone portal
    el("portal",     "structure",  "ZonePortal",    "door-open",   640,  530,  40,  60,  "#4f46e5"),
    el("npc",        "character",  "RebirthNPC",    "user",        720,  570,  28,  40,  "#f472b6"),

    // Trees and decorations
    el("tree",       "decoration", "Tree1",         "tree-pine",    30,  560,  30,  60,  "#166534"),
    el("tree",       "decoration", "Tree2",         "tree-pine",   150,  565,  30,  60,  "#166534"),
    el("bush",       "decoration", "Bush1",         "leaf",        370,  600,  32,  24,  "#15803d"),
    el("rock",       "decoration", "Rock1",         "mountain",    560,  610,  36,  28,  "#6b7280"),
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
    // Town spawn area
    el("spawn",        "mechanic",   "TownSpawn",      "user-plus",    100,  570,  40,  40,  "#10b981"),
    el("ground",       "terrain",    "TownGround",     "square",        50,  620, 300,  40,  "#4a5568"),

    // Quest NPC and shop
    el("npc",          "character",  "QuestGiver",     "user",          200,  560,  28,  40,  "#22c55e"),
    el("shop-building","structure",  "ItemShop",       "store",         320,  490,  80,  70,  "#daa520"),
    el("shopkeeper",   "character",  "Merchant",       "shopping-bag",  340,  565,  28,  40,  "#eab308"),

    // Houses
    el("house",        "structure",  "House1",         "home",          460,  500, 100,  80,  "#a0522d"),
    el("house",        "structure",  "House2",         "home",          580,  510, 100,  80,  "#8b4513"),

    // Bridge to second area
    el("bridge",       "structure",  "RiverBridge",    "minus",         700,  560, 150,  20,  "#8b7355"),

    // Dungeon cave entrance
    el("cave",         "structure",  "DungeonEntrance","mountain",      860,  490, 120,  60,  "#4a4a4a"),
    el("enemy",        "character",  "DungeonGuard",   "ghost",         900,  555,  32,  40,  "#dc2626"),

    // Boss arena
    el("arena",        "structure",  "BossArena",     "shield",        1050, 420, 120, 120,  "#8b0000"),
    el("boss",         "character",  "FinalBoss",     "crown",         1090, 470,  48,  56,  "#7c3aed"),

    // Scattered coins
    el("coin",         "mechanic",   "Coin1",         "coins",          150,  545,  20,  20,  "#eab308"),
    el("coin",         "mechanic",   "Coin2",         "coins",          250,  545,  20,  20,  "#eab308"),
    el("gem",          "mechanic",   "Gem1",          "diamond",        950,  470,  20,  20,  "#8b5cf6"),

    // Trees and rocks
    el("tree",         "decoration", "Tree1",         "tree-pine",       40,  555,  30,  60,  "#166534"),
    el("tree",         "decoration", "Tree2",         "tree-pine",      760,  520,  30,  60,  "#166534"),
    el("rock",         "decoration", "Rock1",         "mountain",        90,  610,  36,  28,  "#6b7280"),
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
    // Dark spawn room
    el("spawn",      "mechanic",   "Spawn",         "user-plus",    100,  570,  40,  40,  "#10b981"),
    el("ground",     "terrain",    "DarkRoom",      "square",        50,  620, 200,  40,  "#1a1a1a"),
    el("lamp",       "decoration", "DimLamp1",      "lamp",         120,  530,  16,  48,  "#fbbf24"),

    // Tunnel corridors
    el("tunnel",     "structure",  "Corridor1",     "circle",       310,  520,  60,  60,  "#555555"),
    el("tunnel",     "structure",  "Corridor2",     "circle",       430,  510,  60,  60,  "#555555"),
    el("lamp",       "decoration", "DimLamp2",      "lamp",         370,  500,  16,  48,  "#fbbf24"),

    // Locked door walls
    el("wall",       "structure",  "LockedDoor",    "square",       560,  490, 120,  60,  "#696969"),

    // Teleporter (after key pickup)
    el("teleporter", "mechanic",   "KeyTeleporter", "zap",          720,  500,  36,  44,  "#8b5cf6"),
    el("gem",        "mechanic",   "DoorKey",       "diamond",      640,  545,  20,  20,  "#8b5cf6"),

    // Enemy (jumpscare trigger)
    el("enemy",      "character",  "JumpscareEntity","ghost",       840,  530,  32,  40,  "#7c3aed"),

    // Cave (final area)
    el("cave",       "structure",  "FinalCave",     "mountain",     980,  470, 120,  60,  "#2a2a2a"),
    el("boss",       "character",  "CreatureBoss",  "crown",       1010,  525,  48,  56,  "#dc2626"),

    // Sparse lamps
    el("lamp",       "decoration", "Lamp3",         "lamp",         500,  510,  16,  48,  "#fbbf24"),
    el("lamp",       "decoration", "Lamp4",         "lamp",         900,  510,  16,  48,  "#fbbf24"),
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
    // Start / finish
    el("spawn",       "mechanic",   "VehicleSpawn",  "user-plus",     80,  570,  40,  40,  "#10b981"),
    el("portal",      "structure",  "StartLine",     "door-open",    140,  530,  40,  60,  "#9400d3"),

    // Track segments (left to right, then curving)
    el("race-track",  "structure",  "Track1",        "route",        230,  555, 200,  30,  "#333333"),
    el("boost-pad",   "mechanic",   "BoostPad1",     "chevrons-right",310, 545,  60,  12,  "#06b6d4"),
    el("race-track",  "structure",  "Track2",        "route",        440,  540, 200,  30,  "#333333"),
    el("checkpoint",  "mechanic",   "Checkpoint1",   "flag",         530,  530,  40,  40,  "#22c55e"),

    // Turn segment
    el("race-track",  "structure",  "Track3",        "route",        650,  500, 200,  30,  "#333333"),
    el("boost-pad",   "mechanic",   "BoostPad2",     "chevrons-right",730, 490,  60,  12,  "#06b6d4"),

    // Back straight
    el("race-track",  "structure",  "Track4",        "route",        860,  480, 200,  30,  "#333333"),
    el("checkpoint",  "mechanic",   "Checkpoint2",   "flag",         950,  470,  40,  40,  "#22c55e"),

    // Final stretch back to start
    el("race-track",  "structure",  "Track5",        "route",       1070,  460, 200,  30,  "#333333"),
    el("portal",      "structure",  "FinishLine",    "door-open",   1280,  440,  40,  60,  "#9400d3"),

    // Walls as barriers along the sides
    el("wall",        "structure",  "BarrierNorth1", "square",       310,  520, 120,  60,  "#696969"),
    el("wall",        "structure",  "BarrierSouth1", "square",       310,  600, 120,  60,  "#696969"),
    el("wall",        "structure",  "BarrierNorth2", "square",       730,  460, 120,  60,  "#696969"),
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
    // Central hub
    el("spawn",        "mechanic",   "HubSpawn",      "user-plus",    700,  450,  40,  40,  "#10b981"),
    el("ground",       "terrain",    "HubGround",     "square",       580,  500, 280,  40,  "#4a5568"),
    el("npc",          "character",  "VotingBoard",   "user",         700,  420,  28,  40,  "#22c55e"),

    // Portals to minigame arenas
    el("portal",       "structure",  "Portal1",       "door-open",    640,  440,  40,  60,  "#ef4444"),
    el("portal",       "structure",  "Portal2",       "door-open",    760,  440,  40,  60,  "#06b6d4"),
    el("portal",       "structure",  "Portal3",       "door-open",    880,  440,  40,  60,  "#22c55e"),

    // Arena 1 — survival
    el("arena",        "structure",  "SurvivalArena", "shield",       200,  280, 120, 120,  "#8b0000"),
    el("spawn",        "mechanic",   "Arena1Spawn",   "user-plus",    240,  310,  40,  40,  "#10b981"),
    el("killbrick",    "obstacle",   "HazardBrick1",  "skull",        230,  320,  60,  16,  "#ef4444"),

    // Arena 2 — race / collect
    el("arena",        "structure",  "CollectArena",  "shield",       700,  200, 120, 120,  "#1d4ed8"),
    el("spawn",        "mechanic",   "Arena2Spawn",   "user-plus",    740,  230,  40,  40,  "#10b981"),
    el("coin",         "mechanic",   "ArenaCoin1",    "coins",        780,  260,  20,  20,  "#eab308"),
    el("coin",         "mechanic",   "ArenaCoin2",    "coins",        810,  240,  20,  20,  "#eab308"),

    // Arena 3 — obby
    el("arena",        "structure",  "ObbyArena",     "shield",      1200,  280, 120, 120,  "#065f46"),
    el("spawn",        "mechanic",   "Arena3Spawn",   "user-plus",   1240,  310,  40,  40,  "#10b981"),
    el("platform",     "platform",   "ObbyPlatform1", "minus",       1260,  300, 100,  16,  "#6366f1"),

    // Fences separating hub areas
    el("fence",        "decoration", "Fence1",        "grip-horizontal", 590, 490, 80, 28, "#92400e"),
    el("fence",        "decoration", "Fence2",        "grip-horizontal", 810, 490, 80, 28, "#92400e"),

    // Coins as rewards in hub
    el("coin",         "mechanic",   "HubCoin1",      "coins",        610,  460,  20,  20,  "#eab308"),
    el("coin",         "mechanic",   "HubCoin2",      "coins",        810,  460,  20,  20,  "#eab308"),
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
    // Starter Zone
    el("spawn", "mechanic", "Spawn", "flag", 400, 500, 30, 30, "#00ff00"),
    el("ground", "terrain", "StarterGround", "square", 200, 400, 400, 300, "#2d5a27"),
    // Click Orbs
    el("click-orb", "mechanic", "ClickOrb1", "circle-dot", 350, 350, 30, 30, "#00ffff"),
    el("click-orb", "mechanic", "ClickOrb2", "circle-dot", 420, 320, 30, 30, "#00e5ff"),
    el("click-orb", "mechanic", "ClickOrb3", "circle-dot", 280, 330, 30, 30, "#00ccff"),
    el("click-orb", "mechanic", "ClickOrb4", "circle-dot", 370, 280, 30, 30, "#00b3ff"),
    el("click-orb", "mechanic", "ClickOrb5", "circle-dot", 310, 400, 30, 30, "#0099ff"),
    // Upgrade Area
    el("upgrade-board", "structure", "UpgradeBoard", "list", 550, 300, 60, 80, "#4ade80"),
    el("npc", "character", "UpgradeNPC", "user", 530, 350, 20, 40, "#fbbf24"),
    // Prestige Area
    el("prestige-pad", "mechanic", "PrestigePad", "refresh-cw", 650, 500, 50, 16, "#ffd700"),
    // Zone Portals
    el("zone-portal", "mechanic", "CrystalMinePortal", "door-open", 150, 300, 40, 60, "#8b5cf6"),
    el("zone-portal", "mechanic", "LavaForgePortal", "door-open", 150, 180, 40, 60, "#ef4444"),
    // Decorations
    el("tree", "decoration", "Tree1", "tree-pine", 100, 450, 30, 50, "#22c55e"),
    el("tree", "decoration", "Tree2", "tree-pine", 600, 450, 30, 50, "#22c55e"),
    el("rock", "decoration", "Crystal1", "gem", 480, 250, 20, 20, "#a78bfa"),
    el("rock", "decoration", "Crystal2", "gem", 250, 250, 20, 20, "#c084fc"),
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
