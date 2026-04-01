// ── Template Presets System ──
// Pre-populates each game template with a realistic starter world so users
// don't start with a blank canvas. Each preset provides canvas elements,
// instance hierarchy, and starter Luau scripts.

import type { CanvasElement, ElementCategory } from "../stores/canvasStore";
import type { ScriptFile, InstanceNode } from "../types/project";
import type { GameInstance } from "../stores/instanceStore";
import { getDefaultLogic } from "./gameLogic";

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

  const scripts: ScriptFile[] = [
    {
      relativePath: "src/server/StageManager.server.luau",
      name: "StageManager",
      scriptType: "server",
      content: `-- StageManager: handles stage transitions and kill bricks
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")

local function onKillBrickTouched(hit)
\tlocal character = hit.Parent
\tlocal humanoid = character and character:FindFirstChild("Humanoid")
\tif humanoid and humanoid.Health > 0 then
\t\thumanoid.Health = 0
\tend
end

for _, brick in CollectionService:GetTagged("KillBrick") do
\tbrick.Touched:Connect(onKillBrickTouched)
end

CollectionService:GetInstanceAddedSignal("KillBrick"):Connect(function(brick)
\tbrick.Touched:Connect(onKillBrickTouched)
end)

print("StageManager loaded")
`,
    },
    {
      relativePath: "src/server/DataManager.server.luau",
      name: "DataManager",
      scriptType: "server",
      content: `-- DataManager: handles saving player progress
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local playerStore = DataStoreService:GetDataStore("PlayerProgress")

local function onPlayerAdded(player)
\tlocal success, data = pcall(function()
\t\treturn playerStore:GetAsync("user_" .. player.UserId)
\tend)
\tif success and data then
\t\tlocal stage = Instance.new("IntValue")
\t\tstage.Name = "CurrentStage"
\t\tstage.Value = data.stage or 1
\t\tstage.Parent = player
\tend
end

local function onPlayerRemoving(player)
\tlocal stage = player:FindFirstChild("CurrentStage")
\tif stage then
\t\tpcall(function()
\t\t\tplayerStore:SetAsync("user_" .. player.UserId, { stage = stage.Value })
\t\tend)
\tend
end

Players.PlayerAdded:Connect(onPlayerAdded)
Players.PlayerRemoving:Connect(onPlayerRemoving)
`,
    },
    {
      relativePath: "src/client/ObbyUI.client.luau",
      name: "ObbyUI",
      scriptType: "client",
      content: `-- ObbyUI: client-side HUD
local Players = game:GetService("Players")
local player = Players.LocalPlayer

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "ObbyHUD"
screenGui.Parent = player.PlayerGui

local stageLabel = Instance.new("TextLabel")
stageLabel.Size = UDim2.new(0, 200, 0, 40)
stageLabel.Position = UDim2.new(0.5, -100, 0, 10)
stageLabel.BackgroundTransparency = 0.5
stageLabel.BackgroundColor3 = Color3.fromRGB(30, 30, 60)
stageLabel.TextColor3 = Color3.new(1, 1, 1)
stageLabel.TextSize = 18
stageLabel.Font = Enum.Font.GothamBold
stageLabel.Text = "Stage 1"
stageLabel.Parent = screenGui
`,
    },
  ];

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

  const scripts: ScriptFile[] = [
    {
      relativePath: "src/server/TycoonManager.server.luau",
      name: "TycoonManager",
      scriptType: "server",
      content: `-- TycoonManager: claim plots and manage ownership
local Players = game:GetService("Players")
local plots = workspace:WaitForChild("Plots")

local function onClaimTouched(claimPad, plot)
\treturn function(hit)
\t\tlocal character = hit.Parent
\t\tlocal player = Players:GetPlayerFromCharacter(character)
\t\tif player and not plot:GetAttribute("Owner") then
\t\t\tplot:SetAttribute("Owner", player.Name)
\t\t\tprint(player.Name .. " claimed " .. plot.Name)
\t\tend
\tend
end

for _, plot in plots:GetChildren() do
\tlocal claim = plot:FindFirstChild("ClaimPad")
\tif claim then
\t\tclaim.Touched:Connect(onClaimTouched(claim, plot))
\tend
end
`,
    },
    {
      relativePath: "src/server/DropperLoop.server.luau",
      name: "DropperLoop",
      scriptType: "server",
      content: `-- DropperLoop: spawns ore from droppers onto conveyor belts
local RunService = game:GetService("RunService")
local plots = workspace:WaitForChild("Plots")

local DROP_INTERVAL = 2
local ORE_VALUE = 5

for _, plot in plots:GetChildren() do
\tlocal dropper = plot:FindFirstChild("OreDropper")
\tlocal collector = plot:FindFirstChild("CashCollector")
\tif not (dropper and collector) then continue end

\ttask.spawn(function()
\t\twhile true do
\t\t\ttask.wait(DROP_INTERVAL)
\t\t\tlocal ore = Instance.new("Part")
\t\t\tore.Name = "Ore"
\t\t\tore.Size = Vector3.new(1, 1, 1)
\t\t\tore.CFrame = dropper.CFrame + Vector3.new(0, -2, 0)
\t\t\tore:SetAttribute("Value", ORE_VALUE)
\t\t\tore.Parent = plot
\t\tend
\tend)
end
`,
    },
    {
      relativePath: "src/server/LeaderboardSetup.server.luau",
      name: "LeaderboardSetup",
      scriptType: "server",
      content: `-- LeaderboardSetup: creates Cash and Gems leaderstats
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
\tlocal leaderstats = Instance.new("Folder")
\tleaderstats.Name = "leaderstats"
\tleaderstats.Parent = player

\tlocal cash = Instance.new("IntValue")
\tcash.Name = "Cash"
\tcash.Value = 0
\tcash.Parent = leaderstats

\tlocal gems = Instance.new("IntValue")
\tgems.Name = "Gems"
\tgems.Value = 0
\tgems.Parent = leaderstats
end)
`,
    },
    {
      relativePath: "src/server/CollectorHandler.server.luau",
      name: "CollectorHandler",
      scriptType: "server",
      content: `-- CollectorHandler: converts ore touching collector into player cash
local Players = game:GetService("Players")
local plots = workspace:WaitForChild("Plots")

for _, plot in plots:GetChildren() do
\tlocal collector = plot:FindFirstChild("CashCollector")
\tif not collector then continue end

\tcollector.Touched:Connect(function(hit)
\t\tif hit.Name ~= "Ore" then return end
\t\tlocal owner = plot:GetAttribute("Owner")
\t\tlocal player = Players:FindFirstChild(owner or "")
\t\tif player then
\t\t\tlocal cash = player.leaderstats and player.leaderstats:FindFirstChild("Cash")
\t\t\tif cash then cash.Value += hit:GetAttribute("Value") or 5 end
\t\tend
\t\thit:Destroy()
\tend)
end
`,
    },
  ];

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

  const scripts: ScriptFile[] = [
    {
      relativePath: "src/server/SimulatorManager.server.luau",
      name: "SimulatorManager",
      scriptType: "server",
      content: `-- SimulatorManager: handles coin/gem collection and rebirths
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
\tlocal leaderstats = Instance.new("Folder")
\tleaderstats.Name = "leaderstats"
\tleaderstats.Parent = player

\tlocal coins = Instance.new("IntValue")
\tcoins.Name = "Coins"
\tcoins.Value = 0
\tcoins.Parent = leaderstats

\tlocal gems = Instance.new("IntValue")
\tgems.Name = "Gems"
\tgems.Value = 0
\tgems.Parent = leaderstats

\tlocal rebirths = Instance.new("IntValue")
\trebirths.Name = "Rebirths"
\trebirths.Value = 0
\trebirths.Parent = leaderstats
end)
`,
    },
    {
      relativePath: "src/server/CollectibleHandler.server.luau",
      name: "CollectibleHandler",
      scriptType: "server",
      content: `-- CollectibleHandler: awards coins/gems when player touches them
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")

local RESPAWN_TIME = 2

local function onCollectibleTouched(part, currency, value)
\treturn function(hit)
\t\tlocal character = hit.Parent
\t\tlocal player = Players:GetPlayerFromCharacter(character)
\t\tif not player then return end
\t\tif not part:GetAttribute("Active") then return end
\t\tpart:SetAttribute("Active", false)
\t\tpart.Transparency = 1

\t\tlocal stat = player.leaderstats and player.leaderstats:FindFirstChild(currency)
\t\tif stat then stat.Value += value end

\t\ttask.delay(RESPAWN_TIME, function()
\t\t\tpart.Transparency = 0
\t\t\tpart:SetAttribute("Active", true)
\t\tend)
\tend
end

for _, coin in CollectionService:GetTagged("Coin") do
\tcoin:SetAttribute("Active", true)
\tcoin.Touched:Connect(onCollectibleTouched(coin, "Coins", 1))
end
for _, gem in CollectionService:GetTagged("Gem") do
\tgem:SetAttribute("Active", true)
\tgem.Touched:Connect(onCollectibleTouched(gem, "Gems", 5))
end
`,
    },
    {
      relativePath: "src/server/RebirthHandler.server.luau",
      name: "RebirthHandler",
      scriptType: "server",
      content: `-- RebirthHandler: resets coins for a rebirth multiplier bonus
local Players = game:GetService("Players")
local REBIRTH_COST = 1000

local function tryRebirth(player)
\tlocal ls = player:FindFirstChild("leaderstats")
\tif not ls then return end
\tlocal coins = ls:FindFirstChild("Coins")
\tlocal rebirths = ls:FindFirstChild("Rebirths")
\tif coins and rebirths and coins.Value >= REBIRTH_COST then
\t\tcoins.Value = 0
\t\trebirths.Value += 1
\t\tprint(player.Name .. " reborn! x" .. rebirths.Value)
\tend
end

-- Expose via RemoteEvent
local re = Instance.new("RemoteEvent")
re.Name = "RequestRebirth"
re.Parent = game.ReplicatedStorage
re.OnServerEvent:Connect(tryRebirth)
`,
    },
  ];

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

  const scripts: ScriptFile[] = [
    {
      relativePath: "src/server/BattleManager.server.luau",
      name: "BattleManager",
      scriptType: "server",
      content: `-- BattleManager: tracks kills and manages round state
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
\tlocal leaderstats = Instance.new("Folder")
\tleaderstats.Name = "leaderstats"
\tleaderstats.Parent = player

\tlocal kills = Instance.new("IntValue")
\tkills.Name = "Kills"
\tkills.Value = 0
\tkills.Parent = leaderstats

\tlocal deaths = Instance.new("IntValue")
\tdeaths.Name = "Deaths"
\tdeaths.Value = 0
\tdeaths.Parent = leaderstats
end)
`,
    },
    {
      relativePath: "src/server/RespawnManager.server.luau",
      name: "RespawnManager",
      scriptType: "server",
      content: `-- RespawnManager: handles player deaths and respawns
local Players = game:GetService("Players")
local RESPAWN_TIME = 5

Players.PlayerAdded:Connect(function(player)
\tplayer.CharacterAdded:Connect(function(character)
\t\tlocal humanoid = character:WaitForChild("Humanoid")
\t\thumanoid.Died:Connect(function()
\t\t\tlocal deaths = player.leaderstats and player.leaderstats:FindFirstChild("Deaths")
\t\t\tif deaths then deaths.Value += 1 end
\t\t\ttask.delay(RESPAWN_TIME, function()
\t\t\t\tplayer:LoadCharacter()
\t\t\tend)
\t\tend)
\tend)
end)
`,
    },
    {
      relativePath: "src/server/KillBrickHandler.server.luau",
      name: "KillBrickHandler",
      scriptType: "server",
      content: `-- KillBrickHandler: kills players that touch hazard zones
local CollectionService = game:GetService("CollectionService")

local function onKillBrickTouched(hit)
\tlocal character = hit.Parent
\tlocal humanoid = character and character:FindFirstChild("Humanoid")
\tif humanoid and humanoid.Health > 0 then
\t\thumanoid.Health = 0
\tend
end

for _, brick in CollectionService:GetTagged("KillBrick") do
\tbrick.Touched:Connect(onKillBrickTouched)
end
`,
    },
  ];

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

  const scripts: ScriptFile[] = [
    {
      relativePath: "src/server/RPGManager.server.luau",
      name: "RPGManager",
      scriptType: "server",
      content: `-- RPGManager: handles player stats for RPG
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
\tlocal leaderstats = Instance.new("Folder")
\tleaderstats.Name = "leaderstats"
\tleaderstats.Parent = player

\tlocal gold = Instance.new("IntValue")
\tgold.Name = "Gold"
\tgold.Value = 0
\tgold.Parent = leaderstats

\tlocal level = Instance.new("IntValue")
\tlevel.Name = "Level"
\tlevel.Value = 1
\tlevel.Parent = leaderstats

\tlocal xp = Instance.new("IntValue")
\txp.Name = "XP"
\txp.Value = 0
\txp.Parent = leaderstats
end)
`,
    },
    {
      relativePath: "src/server/EnemyAI.server.luau",
      name: "EnemyAI",
      scriptType: "server",
      content: `-- EnemyAI: simple enemy patrol and attack
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local ATTACK_RANGE = 15
local CHASE_SPEED = 12

-- Stub: full AI would use PathfindingService
print("EnemyAI loaded - enemies will chase players within " .. ATTACK_RANGE .. " studs")
`,
    },
    {
      relativePath: "src/server/QuestSystem.server.luau",
      name: "QuestSystem",
      scriptType: "server",
      content: `-- QuestSystem: manages quest assignment and completion
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local QuestData = {
\t["Defeat Dungeon Guard"] = { goal = 1, reward = 100, type = "kill" },
\t["Collect 5 Gems"] = { goal = 5, reward = 50, type = "collect" },
}

-- RemoteEvent for quest acceptance
local acceptQuest = Instance.new("RemoteEvent")
acceptQuest.Name = "AcceptQuest"
acceptQuest.Parent = ReplicatedStorage

acceptQuest.OnServerEvent:Connect(function(player, questName)
\tlocal data = QuestData[questName]
\tif data then
\t\tplayer:SetAttribute("ActiveQuest", questName)
\t\tplayer:SetAttribute("QuestProgress", 0)
\t\tprint(player.Name .. " accepted quest: " .. questName)
\tend
end)
`,
    },
  ];

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

  const scripts: ScriptFile[] = [
    {
      relativePath: "src/server/HorrorManager.server.luau",
      name: "HorrorManager",
      scriptType: "server",
      content: `-- HorrorManager: manages jumpscare triggers and locked doors
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")

-- Key pickup unlocks the teleporter
local function onKeyTouched(hit)
\tlocal character = hit.Parent
\tlocal player = Players:GetPlayerFromCharacter(character)
\tif player and not player:GetAttribute("HasKey") then
\t\tplayer:SetAttribute("HasKey", true)
\t\tprint(player.Name .. " picked up the key!")
\tend
end

local key = workspace:FindFirstChild("LockedSection") and workspace.LockedSection:FindFirstChild("DoorKey")
if key then
\tkey.Touched:Connect(onKeyTouched)
end
`,
    },
    {
      relativePath: "src/server/JumpscareHandler.server.luau",
      name: "JumpscareHandler",
      scriptType: "server",
      content: `-- JumpscareHandler: triggers jumpscare sound and screen effect
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local triggerJumpscare = Instance.new("RemoteEvent")
triggerJumpscare.Name = "TriggerJumpscare"
triggerJumpscare.Parent = ReplicatedStorage

local enemy = workspace:FindFirstChild("EnemyArea") and workspace.EnemyArea:FindFirstChild("JumpscareEntity")
if enemy then
\tenemy.Touched:Connect(function(hit)
\t\tlocal character = hit.Parent
\t\tlocal player = Players:GetPlayerFromCharacter(character)
\t\tif player then
\t\t\ttriggerJumpscare:FireClient(player)
\t\tend
\tend)
end
`,
    },
    {
      relativePath: "src/client/HorrorUI.client.luau",
      name: "HorrorUI",
      scriptType: "client",
      content: `-- HorrorUI: darkness overlay and jumpscare effect
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local player = Players.LocalPlayer

local triggerJumpscare = ReplicatedStorage:WaitForChild("TriggerJumpscare")

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "HorrorHUD"
screenGui.Parent = player.PlayerGui

local flash = Instance.new("Frame")
flash.Size = UDim2.new(1, 0, 1, 0)
flash.BackgroundColor3 = Color3.new(1, 0, 0)
flash.BackgroundTransparency = 1
flash.Parent = screenGui

triggerJumpscare.OnClientEvent:Connect(function()
\tflash.BackgroundTransparency = 0
\ttask.delay(0.3, function()
\t\tflash.BackgroundTransparency = 1
\tend)
end)
`,
    },
  ];

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

  const scripts: ScriptFile[] = [
    {
      relativePath: "src/server/RaceManager.server.luau",
      name: "RaceManager",
      scriptType: "server",
      content: `-- RaceManager: tracks lap times and positions
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
\tlocal leaderstats = Instance.new("Folder")
\tleaderstats.Name = "leaderstats"
\tleaderstats.Parent = player

\tlocal bestLap = Instance.new("NumberValue")
\tbestLap.Name = "BestLap"
\tbestLap.Value = 0
\tbestLap.Parent = leaderstats

\tlocal laps = Instance.new("IntValue")
\tlaps.Name = "Laps"
\tlaps.Value = 0
\tlaps.Parent = leaderstats
end)

-- Track lap times via finish line touch
local finishLine = workspace:FindFirstChild("FinishLine")
if finishLine then
\tfinishLine.Touched:Connect(function(hit)
\t\tlocal character = hit.Parent
\t\tlocal player = Players:GetPlayerFromCharacter(character)
\t\tif player then
\t\t\tlocal laps = player.leaderstats and player.leaderstats:FindFirstChild("Laps")
\t\t\tif laps then laps.Value += 1 end
\t\tend
\tend)
end
`,
    },
    {
      relativePath: "src/server/BoostPadHandler.server.luau",
      name: "BoostPadHandler",
      scriptType: "server",
      content: `-- BoostPadHandler: applies speed boost when player steps on pad
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")

local BOOST_SPEED = 32
local BOOST_DURATION = 3

local function onBoostTouched(hit)
\tlocal character = hit.Parent
\tlocal humanoid = character and character:FindFirstChildOfClass("Humanoid")
\tlocal player = Players:GetPlayerFromCharacter(character)
\tif not (humanoid and player) then return end
\tlocal normal = humanoid.WalkSpeed
\thumanoid.WalkSpeed = BOOST_SPEED
\ttask.delay(BOOST_DURATION, function()
\t\tif humanoid and humanoid.Parent then
\t\t\thumanoid.WalkSpeed = normal
\t\tend
\tend)
end

for _, pad in CollectionService:GetTagged("BoostPad") do
\tpad.Touched:Connect(onBoostTouched)
end
`,
    },
    {
      relativePath: "src/client/RaceUI.client.luau",
      name: "RaceUI",
      scriptType: "client",
      content: `-- RaceUI: displays lap count and best time HUD
local Players = game:GetService("Players")
local player = Players.LocalPlayer

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "RaceHUD"
screenGui.Parent = player.PlayerGui

local lapLabel = Instance.new("TextLabel")
lapLabel.Size = UDim2.new(0, 200, 0, 40)
lapLabel.Position = UDim2.new(0.5, -100, 0, 10)
lapLabel.BackgroundColor3 = Color3.fromRGB(20, 20, 20)
lapLabel.BackgroundTransparency = 0.4
lapLabel.TextColor3 = Color3.new(1, 1, 1)
lapLabel.TextSize = 20
lapLabel.Font = Enum.Font.GothamBold
lapLabel.Text = "Lap 0"
lapLabel.Parent = screenGui

local laps = player.leaderstats and player.leaderstats:FindFirstChild("Laps")
if laps then
\tlaps.Changed:Connect(function(v)
\t\tlapLabel.Text = "Lap " .. v
\tend)
end
`,
    },
  ];

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

  const scripts: ScriptFile[] = [
    {
      relativePath: "src/server/MinigameManager.server.luau",
      name: "MinigameManager",
      scriptType: "server",
      content: `-- MinigameManager: controls voting and round rotation
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local MINIGAMES = { "SurvivalArena", "CollectArena", "ObbyArena" }
local VOTE_TIME = 30
local ROUND_TIME = 120

local voteEvent = Instance.new("RemoteEvent")
voteEvent.Name = "CastVote"
voteEvent.Parent = ReplicatedStorage

local votes = {}

voteEvent.OnServerEvent:Connect(function(player, minigame)
\tif table.find(MINIGAMES, minigame) then
\t\tvotes[player.Name] = minigame
\t\tprint(player.Name .. " voted for " .. minigame)
\tend
end)

-- Tally votes to pick next minigame
local function tallyVotes()
\tlocal counts = {}
\tfor _, mg in MINIGAMES do counts[mg] = 0 end
\tfor _, vote in votes do counts[vote] = (counts[vote] or 0) + 1 end
\tlocal winner, max = MINIGAMES[1], 0
\tfor mg, count in counts do
\t\tif count > max then winner, max = mg, count end
\tend
\tvotes = {}
\treturn winner
end

print("MinigameManager loaded - " .. #MINIGAMES .. " minigames available")
`,
    },
    {
      relativePath: "src/server/RewardSystem.server.luau",
      name: "RewardSystem",
      scriptType: "server",
      content: `-- RewardSystem: awards coins to round winners
local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
\tlocal leaderstats = Instance.new("Folder")
\tleaderstats.Name = "leaderstats"
\tleaderstats.Parent = player

\tlocal coins = Instance.new("IntValue")
\tcoins.Name = "Coins"
\tcoins.Value = 0
\tcoins.Parent = leaderstats

\tlocal wins = Instance.new("IntValue")
\twins.Name = "Wins"
\twins.Value = 0
\twins.Parent = leaderstats
end)

-- Function called by MinigameManager to reward winner
local function rewardWinner(player, amount)
\tlocal coins = player.leaderstats and player.leaderstats:FindFirstChild("Coins")
\tif coins then coins.Value += amount end
end

return rewardWinner
`,
    },
    {
      relativePath: "src/client/MinigameUI.client.luau",
      name: "MinigameUI",
      scriptType: "client",
      content: `-- MinigameUI: voting screen and round countdown HUD
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local player = Players.LocalPlayer

local castVote = ReplicatedStorage:WaitForChild("CastVote")

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "MinigameHUD"
screenGui.Parent = player.PlayerGui

local statusLabel = Instance.new("TextLabel")
statusLabel.Size = UDim2.new(0, 300, 0, 50)
statusLabel.Position = UDim2.new(0.5, -150, 0, 10)
statusLabel.BackgroundColor3 = Color3.fromRGB(20, 20, 60)
statusLabel.BackgroundTransparency = 0.3
statusLabel.TextColor3 = Color3.new(1, 1, 1)
statusLabel.TextSize = 20
statusLabel.Font = Enum.Font.GothamBold
statusLabel.Text = "Waiting for votes..."
statusLabel.Parent = screenGui
`,
    },
  ];

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
