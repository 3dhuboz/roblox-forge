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

export function mockSendChatMessage(message: string): AiResponse {
  mockMessageCount++;
  const lower = message.toLowerCase();

  // Simulate intelligent responses based on user input
  if (lower.includes("add") && lower.includes("stage")) {
    return {
      message:
        "I've added a new stage to your obby! It has some tricky platforms and a checkpoint at the end. Try asking me to add specific obstacles like spinning bars or disappearing blocks!",
      changes: [
        { type: "add_stage", description: "Added Stage3 with 4 parts and a checkpoint" },
        { type: "update_config", description: "Updated MaxStages to 3" },
      ],
    };
  }

  if (lower.includes("kill") || lower.includes("lava")) {
    return {
      message:
        "Added some lava kill bricks! They glow red with Neon material. Players who touch them will respawn at their last checkpoint.",
      changes: [
        { type: "add_part", description: "Added LavaBrick1 to Stage2" },
        { type: "add_part", description: "Added LavaBrick2 to Stage2" },
      ],
    };
  }

  if (lower.includes("moving") || lower.includes("platform")) {
    return {
      message:
        "Added a moving platform that slides back and forth using TweenService. The platform takes 2 seconds per trip and pauses briefly at each end.",
      changes: [
        { type: "add_part", description: "Added MovingPlatform to Stage1" },
        { type: "modify_script", description: "Updated StageManager with platform animation" },
      ],
    };
  }

  if (lower.includes("color") || lower.includes("colour") || lower.includes("neon")) {
    return {
      message:
        "Updated the platform colors! Stage 1 now uses cool blues and purples with Neon material for a space feel. Stage 2 has warm oranges and reds.",
      changes: [
        { type: "set_property", description: "Updated colors across 8 parts" },
      ],
    };
  }

  if (lower.includes("checkpoint")) {
    return {
      message:
        "Added checkpoints to every stage. Each checkpoint is a green SpawnLocation that saves the player's progress. They'll respawn here if they fall!",
      changes: [
        { type: "add_part", description: "Added checkpoints to all stages" },
      ],
    };
  }

  // Default helpful response
  const tips = [
    "Try saying 'add a new stage with spinning obstacles' or 'make the platforms neon blue'!",
    "You can ask me to add kill bricks, moving platforms, trampolines, or conveyor belts.",
    "Want to customize colors? Try 'make stage 1 purple and glowing'.",
    "I can add checkpoints, speed boosts, or even a secret shortcut between stages!",
  ];

  return {
    message: `Got it! In the full desktop app, I'd make those changes to your game files right now. For this browser preview, here's a tip: ${tips[mockMessageCount % tips.length]}`,
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
