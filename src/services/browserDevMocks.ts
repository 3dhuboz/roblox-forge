import type { AiResponse } from "../types/ai";
import type { ProjectInfo, ProjectState, InstanceNode, ScriptFile } from "../types/project";
import type { AuthState, PublishResult } from "../types/roblox";
import type { ValidationIssue } from "../types/validation";

const MOCK_PREFIX = "browser-dev://";

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function v3(x: number, y: number, z: number) {
  return { Vector3: [x, y, z] };
}

function cf(x: number, y: number, z: number) {
  return { CFrame: { position: [x, y, z], orientation: [0, 0, 0, 1, 0, 0, 0, 1, 0] } };
}

function color(r: number, g: number, b: number) {
  return { Color3uint8: [r, g, b] };
}

function sampleHierarchy(): InstanceNode {
  return {
    className: "DataModel",
    name: "DataModel",
    properties: {},
    children: [
      {
        className: "Workspace",
        name: "Workspace",
        properties: {},
        children: [
          {
            className: "Folder",
            name: "Lobby",
            properties: {},
            children: [
              {
                className: "SpawnLocation",
                name: "Spawn",
                properties: { Size: v3(12, 1, 12), CFrame: cf(0, 3, 0), Color3uint8: color(100, 200, 100) },
                children: [],
              },
              {
                className: "Part",
                name: "LobbyFloor",
                properties: { Size: v3(30, 2, 30), CFrame: cf(0, 1, 0), Color3uint8: color(80, 80, 80) },
                children: [],
              },
            ],
          },
          {
            className: "Folder",
            name: "Stages",
            properties: {},
            children: [
              {
                className: "Folder",
                name: "Stage1",
                properties: {},
                children: [
                  {
                    className: "Part",
                    name: "StartPlatform",
                    properties: { Size: v3(10, 1, 10), CFrame: cf(0, 5, 40), Color3uint8: color(100, 100, 255) },
                    children: [],
                  },
                  {
                    className: "Part",
                    name: "JumpPad1",
                    properties: { Size: v3(6, 1, 6), CFrame: cf(8, 7, 55), Color3uint8: color(120, 120, 255) },
                    children: [],
                  },
                  {
                    className: "Part",
                    name: "LavaPit",
                    properties: { Size: v3(12, 1, 4), CFrame: cf(4, 4, 48), Color3uint8: color(255, 50, 20) },
                    children: [],
                    tags: ["KillBrick"],
                  },
                  {
                    className: "Part",
                    name: "NarrowBridge",
                    properties: { Size: v3(2, 1, 14), CFrame: cf(16, 8, 65), Color3uint8: color(180, 180, 200) },
                    children: [],
                  },
                  {
                    className: "SpawnLocation",
                    name: "Checkpoint1",
                    properties: { Size: v3(8, 1, 8), CFrame: cf(20, 9, 80), Color3uint8: color(0, 255, 0) },
                    children: [],
                  },
                ],
              },
              {
                className: "Folder",
                name: "Stage2",
                properties: {},
                children: [
                  {
                    className: "Part",
                    name: "Platform2A",
                    properties: { Size: v3(8, 1, 8), CFrame: cf(20, 12, 100), Color3uint8: color(200, 100, 255) },
                    children: [],
                  },
                  {
                    className: "Part",
                    name: "SpinnerDodge",
                    properties: { Size: v3(14, 2, 2), CFrame: cf(22, 14, 115), Color3uint8: color(255, 165, 0) },
                    children: [],
                    tags: ["KillBrick"],
                  },
                  {
                    className: "Part",
                    name: "MovingPlatform",
                    properties: { Size: v3(6, 1, 6), CFrame: cf(24, 15, 130), Color3uint8: color(50, 200, 255) },
                    children: [],
                  },
                  {
                    className: "Part",
                    name: "DisappearBlock1",
                    properties: { Size: v3(4, 1, 4), CFrame: cf(18, 16, 140), Color3uint8: color(255, 255, 100), Transparency: { Float32: 0.3 } },
                    children: [],
                  },
                  {
                    className: "Part",
                    name: "DisappearBlock2",
                    properties: { Size: v3(4, 1, 4), CFrame: cf(26, 16, 148), Color3uint8: color(255, 255, 100), Transparency: { Float32: 0.3 } },
                    children: [],
                  },
                  {
                    className: "SpawnLocation",
                    name: "Checkpoint2",
                    properties: { Size: v3(8, 1, 8), CFrame: cf(22, 18, 160), Color3uint8: color(0, 255, 0) },
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        className: "ServerScriptService",
        name: "ServerScriptService",
        properties: {},
        children: [
          {
            className: "Script",
            name: "StageManager",
            properties: {},
            children: [],
            scriptSource: "-- StageManager: handles stage transitions and kill bricks\nlocal Players = game:GetService(\"Players\")\nlocal CollectionService = game:GetService(\"CollectionService\")\n\nlocal function onKillBrickTouched(hit)\n\tlocal character = hit.Parent\n\tlocal humanoid = character and character:FindFirstChild(\"Humanoid\")\n\tif humanoid and humanoid.Health > 0 then\n\t\thumanoid.Health = 0\n\tend\nend\n\nfor _, brick in CollectionService:GetTagged(\"KillBrick\") do\n\tbrick.Touched:Connect(onKillBrickTouched)\nend\n\nCollectionService:GetInstanceAddedSignal(\"KillBrick\"):Connect(function(brick)\n\tbrick.Touched:Connect(onKillBrickTouched)\nend)\n\nprint(\"StageManager loaded\")\n",
          },
          {
            className: "Script",
            name: "DataManager",
            properties: {},
            children: [],
            scriptSource: "-- DataManager: handles saving player progress\nlocal DataStoreService = game:GetService(\"DataStoreService\")\nlocal Players = game:GetService(\"Players\")\n\nlocal playerStore = DataStoreService:GetDataStore(\"PlayerProgress\")\n\nlocal function onPlayerAdded(player)\n\tlocal success, data = pcall(function()\n\t\treturn playerStore:GetAsync(\"user_\" .. player.UserId)\n\tend)\n\tif success and data then\n\t\tlocal stage = Instance.new(\"IntValue\")\n\t\tstage.Name = \"CurrentStage\"\n\t\tstage.Value = data.stage or 1\n\t\tstage.Parent = player\n\tend\nend\n\nlocal function onPlayerRemoving(player)\n\tlocal stage = player:FindFirstChild(\"CurrentStage\")\n\tif stage then\n\t\tpcall(function()\n\t\t\tplayerStore:SetAsync(\"user_\" .. player.UserId, { stage = stage.Value })\n\t\tend)\n\tend\nend\n\nPlayers.PlayerAdded:Connect(onPlayerAdded)\nPlayers.PlayerRemoving:Connect(onPlayerRemoving)\n",
          },
        ],
      },
      {
        className: "StarterPlayer",
        name: "StarterPlayer",
        properties: {},
        children: [
          {
            className: "Folder",
            name: "StarterPlayerScripts",
            properties: {},
            children: [
              {
                className: "LocalScript",
                name: "ObbyUI",
                properties: {},
                children: [],
                scriptSource: "-- ObbyUI: client-side HUD\nlocal Players = game:GetService(\"Players\")\nlocal player = Players.LocalPlayer\n\nlocal screenGui = Instance.new(\"ScreenGui\")\nscreenGui.Name = \"ObbyHUD\"\nscreenGui.Parent = player.PlayerGui\n\nlocal stageLabel = Instance.new(\"TextLabel\")\nstageLabel.Size = UDim2.new(0, 200, 0, 40)\nstageLabel.Position = UDim2.new(0.5, -100, 0, 10)\nstageLabel.BackgroundTransparency = 0.5\nstageLabel.BackgroundColor3 = Color3.fromRGB(30, 30, 60)\nstageLabel.TextColor3 = Color3.new(1, 1, 1)\nstageLabel.TextSize = 18\nstageLabel.Font = Enum.Font.GothamBold\nstageLabel.Text = \"Stage 1\"\nstageLabel.Parent = screenGui\n",
              },
            ],
          },
        ],
      },
      {
        className: "ReplicatedStorage",
        name: "ReplicatedStorage",
        properties: {},
        children: [
          {
            className: "ModuleScript",
            name: "ObbyConfig",
            properties: {},
            children: [],
            scriptSource: "local ObbyConfig = {}\n\nObbyConfig.MaxStages = 2\nObbyConfig.StageNames = {\n\t[1] = \"Space Jump\",\n\t[2] = \"Spinner Gauntlet\",\n}\nObbyConfig.Difficulty = \"Medium\"\nObbyConfig.EnableLeaderboard = true\n\nreturn ObbyConfig\n",
          },
        ],
      },
      {
        className: "Lighting",
        name: "Lighting",
        properties: {},
        children: [],
      },
      {
        className: "SoundService",
        name: "SoundService",
        properties: {},
        children: [],
      },
    ],
  };
}

function sampleScripts(): ScriptFile[] {
  return [
    {
      relativePath: "src/server/StageManager.server.luau",
      name: "StageManager",
      scriptType: "server",
      content: "-- StageManager: handles stage transitions and kill bricks\nlocal Players = game:GetService(\"Players\")\nlocal CollectionService = game:GetService(\"CollectionService\")\n\nlocal function onKillBrickTouched(hit)\n\tlocal character = hit.Parent\n\tlocal humanoid = character and character:FindFirstChild(\"Humanoid\")\n\tif humanoid and humanoid.Health > 0 then\n\t\thumanoid.Health = 0\n\tend\nend\n\nfor _, brick in CollectionService:GetTagged(\"KillBrick\") do\n\tbrick.Touched:Connect(onKillBrickTouched)\nend\n\nCollectionService:GetInstanceAddedSignal(\"KillBrick\"):Connect(function(brick)\n\tbrick.Touched:Connect(onKillBrickTouched)\nend)\n\nprint(\"StageManager loaded\")\n",
    },
    {
      relativePath: "src/server/DataManager.server.luau",
      name: "DataManager",
      scriptType: "server",
      content: "-- DataManager: handles saving player progress\nlocal DataStoreService = game:GetService(\"DataStoreService\")\nlocal Players = game:GetService(\"Players\")\n\nlocal playerStore = DataStoreService:GetDataStore(\"PlayerProgress\")\n\nlocal function onPlayerAdded(player)\n\tlocal success, data = pcall(function()\n\t\treturn playerStore:GetAsync(\"user_\" .. player.UserId)\n\tend)\n\tif success and data then\n\t\tlocal stage = Instance.new(\"IntValue\")\n\t\tstage.Name = \"CurrentStage\"\n\t\tstage.Value = data.stage or 1\n\t\tstage.Parent = player\n\tend\nend\n\nlocal function onPlayerRemoving(player)\n\tlocal stage = player:FindFirstChild(\"CurrentStage\")\n\tif stage then\n\t\tpcall(function()\n\t\t\tplayerStore:SetAsync(\"user_\" .. player.UserId, { stage = stage.Value })\n\t\tend)\n\tend\nend\n\nPlayers.PlayerAdded:Connect(onPlayerAdded)\nPlayers.PlayerRemoving:Connect(onPlayerRemoving)\n",
    },
    {
      relativePath: "src/client/ObbyUI.client.luau",
      name: "ObbyUI",
      scriptType: "client",
      content: "-- ObbyUI: client-side HUD\nlocal Players = game:GetService(\"Players\")\nlocal player = Players.LocalPlayer\n\nlocal screenGui = Instance.new(\"ScreenGui\")\nscreenGui.Name = \"ObbyHUD\"\nscreenGui.Parent = player.PlayerGui\n\nlocal stageLabel = Instance.new(\"TextLabel\")\nstageLabel.Size = UDim2.new(0, 200, 0, 40)\nstageLabel.Position = UDim2.new(0.5, -100, 0, 10)\nstageLabel.BackgroundTransparency = 0.5\nstageLabel.BackgroundColor3 = Color3.fromRGB(30, 30, 60)\nstageLabel.TextColor3 = Color3.new(1, 1, 1)\nstageLabel.TextSize = 18\nstageLabel.Font = Enum.Font.GothamBold\nstageLabel.Text = \"Stage 1\"\nstageLabel.Parent = screenGui\n",
    },
    {
      relativePath: "src/shared/ObbyConfig.luau",
      name: "ObbyConfig",
      scriptType: "module",
      content: "local ObbyConfig = {}\n\nObbyConfig.MaxStages = 2\nObbyConfig.StageNames = {\n\t[1] = \"Space Jump\",\n\t[2] = \"Spinner Gauntlet\",\n}\nObbyConfig.Difficulty = \"Medium\"\nObbyConfig.EnableLeaderboard = true\n\nreturn ObbyConfig\n",
    },
  ];
}

const mockProjects = new Map<string, ProjectState>();

function projectState(template: string, projectName: string, path: string): ProjectState {
  return {
    name: projectName,
    path,
    template,
    hierarchy: sampleHierarchy(),
    scripts: sampleScripts(),
    stageCount: 2,
  };
}

export function mockCreateProject(templateName: string, projectName: string): ProjectInfo {
  const path = `${MOCK_PREFIX}${sanitizeName(projectName)}`;
  const state = projectState(templateName, projectName, path);
  mockProjects.set(path, state);
  return {
    name: projectName,
    path,
    template: templateName,
    createdAt: new Date().toISOString(),
  };
}

export function mockGetProjectState(projectPath: string): ProjectState {
  const existing = mockProjects.get(projectPath);
  if (existing) {
    return existing;
  }
  const state = projectState("obby", "Preview", projectPath);
  mockProjects.set(projectPath, state);
  return state;
}

export function mockWriteFile(
  projectPath: string,
  relativePath: string,
  content: string,
): void {
  const state = mockProjects.get(projectPath);
  if (!state) return;
  const rel = relativePath.replace(/\\/g, "/");
  const idx = state.scripts.findIndex((s) => s.relativePath === rel);
  if (idx >= 0) {
    const next = [...state.scripts];
    next[idx] = { ...next[idx], content };
    mockProjects.set(projectPath, { ...state, scripts: next });
  }
}

let mockMessageCount = 0;

// ── Keyword matchers ──

function matches(lower: string, ...keywords: string[]): boolean {
  return keywords.some((k) => lower.includes(k));
}

// ── Obby responses ──

function obbyResponse(lower: string): AiResponse | null {
  if (matches(lower, "stage") && matches(lower, "add", "new", "more", "create")) {
    return {
      message: "Added a new stage with varied platforms and a checkpoint at the end. Each stage gets progressively harder — want me to add specific obstacles like spinning bars or disappearing blocks?",
      changes: [
        { type: "add_stage", description: "Added Stage3 with 5 parts and a checkpoint" },
        { type: "update_config", description: "Updated MaxStages to 3" },
      ],
    };
  }
  if (matches(lower, "kill", "lava", "hazard", "danger")) {
    return {
      message: "Added lava kill bricks with red Neon material. Players who touch them respawn at their last checkpoint. I placed them between platforms to make the jumps trickier.",
      changes: [
        { type: "add_part", description: "Added LavaBrick1 to Stage2" },
        { type: "add_part", description: "Added LavaBrick2 to Stage2" },
      ],
    };
  }
  if (matches(lower, "moving", "slide", "tween")) {
    return {
      message: "Added a moving platform using TweenService — it slides 20 studs back and forth over 2 seconds with a brief pause at each end. Great for timing-based jumps!",
      changes: [
        { type: "add_part", description: "Added MovingPlatform to Stage1" },
        { type: "modify_script", description: "Updated StageManager with TweenService animation" },
      ],
    };
  }
  if (matches(lower, "spinning", "spin", "rotat")) {
    return {
      message: "Added a spinning obstacle bar! It rotates on a Heartbeat loop at 90°/sec. Players need to time their jumps to avoid getting knocked off.",
      changes: [
        { type: "add_part", description: "Added SpinBar to Stage2" },
        { type: "modify_script", description: "Added rotation script using RunService.Heartbeat" },
      ],
    };
  }
  if (matches(lower, "disappear", "vanish", "invisible")) {
    return {
      message: "Added disappearing blocks that cycle between visible and invisible every 2 seconds. The timing is staggered so players need to memorize the pattern!",
      changes: [
        { type: "add_part", description: "Added DisappearBlock1-3 to Stage2" },
        { type: "modify_script", description: "Added visibility toggle script" },
      ],
    };
  }
  if (matches(lower, "checkpoint", "spawn", "save")) {
    return {
      message: "Added checkpoints to every stage — green SpawnLocations that save progress. Players respawn here instead of the beginning!",
      changes: [{ type: "add_part", description: "Added checkpoints to all stages" }],
    };
  }
  if (matches(lower, "color", "colour", "neon", "glow", "theme")) {
    return {
      message: "Updated colors! Stage 1 uses cool blues and purples with Neon material. Stage 2 has warm oranges and reds. The checkpoints stay green for visibility.",
      changes: [{ type: "set_property", description: "Updated colors across 8 parts" }],
    };
  }
  if (matches(lower, "trampoline", "bounce", "jump pad")) {
    return {
      message: "Added a trampoline pad! When players land on it, their HumanoidRootPart gets a 120-stud upward velocity boost. Great for reaching high platforms.",
      changes: [
        { type: "add_part", description: "Added Trampoline to Stage1" },
        { type: "modify_script", description: "Added bounce handling via CollectionService tag" },
      ],
    };
  }
  return null;
}

// ── Tycoon responses ──

function tycoonResponse(lower: string): AiResponse | null {
  if (matches(lower, "dropper", "produce", "machine")) {
    return {
      message: "Added a new dropper machine! It produces glowing ore every 2 seconds that rolls onto the conveyor belt. Each ore is worth $1 base value (affected by your multipliers).",
      changes: [
        { type: "add_part", description: "Added OreDropper to Plot1" },
        { type: "modify_script", description: "Updated TycoonManager dropper loop" },
      ],
    };
  }
  if (matches(lower, "conveyor", "belt", "transport")) {
    return {
      message: "Extended the conveyor belt! It now runs 30 studs at speed 12. Items slide smoothly from dropper to collector using AssemblyLinearVelocity.",
      changes: [
        { type: "add_part", description: "Added Conveyor2 to Plot1" },
        { type: "set_property", description: "Set AssemblyLinearVelocity on conveyors" },
      ],
    };
  }
  if (matches(lower, "upgrade", "boost", "faster", "double", "2x")) {
    return {
      message: "Added a new upgrade button! It costs $500 and doubles your dropper speed. The button glows blue and disappears after purchase.",
      changes: [
        { type: "add_part", description: "Added UpgradeButton2 to Plot1" },
        { type: "update_config", description: "Added 'Double Speed' to TycoonConfig.Upgrades" },
      ],
    };
  }
  if (matches(lower, "rebirth", "prestige", "reset")) {
    return {
      message: "Added rebirth system! At $50,000 you can rebirth for a permanent 2x multiplier and 10 gems. All cash and upgrades reset but gems and rebirths are permanent.",
      changes: [
        { type: "modify_script", description: "Added rebirth logic to IncomeManager" },
        { type: "update_config", description: "Added rebirth tiers to TycoonConfig" },
      ],
    };
  }
  if (matches(lower, "collector", "collect", "earn")) {
    return {
      message: "Upgraded the collector! It now has a larger hitbox (8x4x8) and shows a particle effect when items are collected. Cash is added instantly on touch.",
      changes: [
        { type: "set_property", description: "Resized Collector to 8x4x8" },
        { type: "add_part", description: "Added ParticleEmitter to Collector" },
      ],
    };
  }
  if (matches(lower, "gamepass", "game pass", "robux", "premium")) {
    return {
      message: "Added a Game Pass setup! I've created a '2x Cash' pass structure. In the desktop app, you'd link this to your actual Game Pass ID from the Creator Dashboard.",
      changes: [
        { type: "modify_script", description: "Added game pass check to TycoonManager" },
        { type: "update_config", description: "Added GamePasses section to config" },
      ],
    };
  }
  return null;
}

// ── Simulator responses ──

function simResponse(lower: string): AiResponse | null {
  if (matches(lower, "click", "orb", "tap", "earn")) {
    return {
      message: "Set up the click system! Tap the glowing orbs to earn coins. Each click gives you coins equal to your Click Power (starts at 1). The orb pulses when clicked for satisfying feedback.",
      changes: [
        { type: "add_part", description: "Added ClickOrb to Lobby" },
        { type: "modify_script", description: "Updated ClickManager with visual feedback" },
      ],
    };
  }
  if (matches(lower, "pet", "egg", "hatch")) {
    return {
      message: "Added an egg hatching station! Costs 100 coins per hatch. You can get: Basic Cat (60% common, 1.2x boost), Lucky Dog (30% common, 1.3x), Crystal Fox (8% rare, 2x), or Golden Dragon (2% legendary, 5x)!",
      changes: [
        { type: "add_part", description: "Added EggHatchPad to Lobby" },
        { type: "modify_script", description: "Updated PetManager with weighted RNG" },
      ],
    };
  }
  if (matches(lower, "rebirth", "prestige", "reset")) {
    return {
      message: "Added rebirth system! At 50K coins, rebirth for a permanent 2x multiplier and 10 gems. Coins and upgrades reset, but pets and gems stay forever.",
      changes: [
        { type: "modify_script", description: "Updated RebirthManager with tier 1" },
        { type: "update_config", description: "Added rebirth config" },
      ],
    };
  }
  if (matches(lower, "zone", "area", "world", "unlock")) {
    return {
      message: "Added a new zone! 'Crystal Caves' unlocks at 1,000 coins and gives 3x coin multiplier. It has a purple crystal theme with new orbs to click.",
      changes: [
        { type: "add_stage", description: "Added CrystalCaves zone" },
        { type: "add_part", description: "Added ZoneGate with 1000 coin requirement" },
      ],
    };
  }
  if (matches(lower, "upgrade", "power", "auto", "multiplier")) {
    return {
      message: "Added upgrades! Click Power +1 (50 coins), Auto Click (500 coins — earns passively at half rate), 2x Coins (10 gems), Extra Pet Slot (25 gems).",
      changes: [
        { type: "modify_script", description: "Added upgrade shop to ClickManager" },
        { type: "update_config", description: "Added 4 upgrades to SimConfig" },
      ],
    };
  }
  if (matches(lower, "leaderboard", "rank", "top")) {
    return {
      message: "Added a global leaderboard showing top 100 players by total coins earned! Uses an OrderedDataStore that updates every 60 seconds.",
      changes: [
        { type: "modify_script", description: "Added LeaderboardService script" },
        { type: "add_part", description: "Added LeaderboardDisplay to Lobby" },
      ],
    };
  }
  if (matches(lower, "code", "redeem", "promo")) {
    return {
      message: "Added a codes system! Players can redeem codes for free coins and gems. I've set up 3 starter codes: 'LAUNCH' (500 coins), 'PETS' (free egg), 'GEMS5' (5 gems).",
      changes: [
        { type: "modify_script", description: "Added CodesManager server script" },
        { type: "update_config", description: "Added active codes to SimConfig" },
      ],
    };
  }
  if (matches(lower, "trading", "trade")) {
    return {
      message: "Added pet trading! Players can request a trade by clicking another player. Both see a trade UI showing offered pets. Both must confirm before the swap happens server-side.",
      changes: [
        { type: "modify_script", description: "Added TradingManager server script" },
        { type: "modify_script", description: "Added trading UI to SimulatorUI" },
      ],
    };
  }
  return null;
}

// ── Universal responses ──

function universalResponse(lower: string): AiResponse | null {
  if (matches(lower, "sound", "audio", "music", "sfx")) {
    return {
      message: "Added sound effects! Click sounds on interaction, a cash register 'cha-ching' on earnings, and ambient background music. All volumes are adjustable.",
      changes: [{ type: "modify_script", description: "Added SoundService configuration" }],
    };
  }
  if (matches(lower, "particle", "effect", "visual", "sparkle")) {
    return {
      message: "Added particle effects! Sparkles on checkpoints, fire particles on hazards, and a coin burst when earning. Makes everything feel more polished.",
      changes: [{ type: "add_part", description: "Added ParticleEmitters to key objects" }],
    };
  }
  if (matches(lower, "gui", "ui", "hud", "display", "screen")) {
    return {
      message: "Updated the HUD! Added a cleaner layout with rounded frames, animated number transitions, and better contrast. The font uses GothamBold for a modern Roblox feel.",
      changes: [{ type: "modify_script", description: "Redesigned client HUD layout" }],
    };
  }
  if (matches(lower, "lighting", "sky", "atmosphere", "time")) {
    return {
      message: "Updated the lighting! Set ClockTime to 14 for warm afternoon light, added an Atmosphere with slight haze, and a Bloom effect for glowing Neon materials.",
      changes: [{ type: "set_property", description: "Updated Lighting properties and added post-processing" }],
    };
  }
  return null;
}

export function mockSendChatMessage(message: string): AiResponse {
  mockMessageCount++;
  const lower = message.toLowerCase();

  // Try template-specific responses first, then universal
  const resp =
    obbyResponse(lower) ??
    tycoonResponse(lower) ??
    simResponse(lower) ??
    universalResponse(lower);

  if (resp) return resp;

  // Fallback
  const tips = [
    "Try describing what you want — 'add spinning obstacles' or 'make it neon themed'!",
    "I can add kill bricks, moving platforms, pets, upgrades, rebirths, and more.",
    "Want sounds or particles? Try 'add sound effects' or 'add sparkle particles'.",
    "I can help with UI too — try 'update the HUD' or 'add a leaderboard'.",
  ];

  return {
    message: `Interesting idea! Here's what I can do: ${tips[mockMessageCount % tips.length]}`,
    changes: [],
  };
}

export function mockValidateProject(): ValidationIssue[] {
  return [];
}

export function mockGetAuthState(): AuthState | null {
  return null;
}

export function mockBuildProject(projectPath: string): {
  rbxlPath: string;
  warnings: string[];
} {
  return {
    rbxlPath: `${projectPath}/mock-output.rbxl`,
    warnings: [
      "Browser dev mode: build was not run. Use the desktop app to produce a real .rbxl.",
    ],
  };
}

export function mockPublishGame(): PublishResult {
  return {
    success: false,
    error: "Publishing requires the desktop app. Run npm run tauri dev after installing Rust.",
  };
}
