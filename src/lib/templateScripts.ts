/**
 * Production-quality Luau scripts for each game template.
 * These are the REAL game scripts from /templates/ — not stubs.
 * Each function returns the complete ScriptFile[] for that template.
 */

import type { ScriptFile } from "../types/project";

// ── Shared Scripts (used by all templates) ──

// RateLimit module — shared across all templates
const RATE_LIMIT = `
--[[
	RateLimit.luau
	Shared rate-limiting module for RemoteEvent spam prevention.

	Usage (server):
	  local RateLimit = require(game.ReplicatedStorage.RateLimit)

	  remoteEvent.OnServerEvent:Connect(function(player, ...)
	      if not RateLimit.check(player, "click", 0.1) then return end
	      -- process the event
	  end)
]]

local RateLimit = {}

local timestamps: { [Player]: { [string]: number } } = {}

--- Check if an action is allowed for a player.
--- Returns true if enough time has passed since the last call.
--- @param player Player — the player performing the action
--- @param action string — a unique name for this action
--- @param cooldown number — minimum seconds between actions
--- @return boolean — true if allowed, false if rate-limited
function RateLimit.check(player: Player, action: string, cooldown: number): boolean
	if not timestamps[player] then
		timestamps[player] = {}
	end

	local now = tick()
	local lastTime = timestamps[player][action] or 0

	if now - lastTime < cooldown then
		return false
	end

	timestamps[player][action] = now
	return true
end

--- Clean up when a player leaves (prevents memory leaks).
--- Call this from PlayerRemoving or let the module handle it.
function RateLimit.cleanup(player: Player)
	timestamps[player] = nil
end

-- Auto-cleanup on player leave
game:GetService("Players").PlayerRemoving:Connect(function(player)
	RateLimit.cleanup(player)
end)

return RateLimit
`;

// PlatformBehaviors — shared across all templates
const PLATFORM_BEHAVIORS = `
--[[
	PlatformBehaviors.server.luau
	Drives ALL dynamic platform mechanics using CollectionService tags.

	Tags handled:
	  MovingPlatform   → tweens back and forth
	  DisappearPlatform → fades out on touch, reappears after delay
	  BouncyPlatform   → launches player upward on touch
	  Spinner          → rotates continuously
	  Conveyor         → pushes parts/players in a direction
	  KillBrick        → kills player on touch (backup for StageManager)

	Each part reads its behavior from Attributes set in the model file:
	  MoveDistance (number)   — how far to move (studs)
	  MoveSpeed (number)     — movement speed (studs/sec)
	  MoveDirection (string) — "x", "y", "z", or "horizontal"/"vertical"
	  DisappearDelay (number)  — seconds before disappearing after touch
	  ReappearDelay (number)   — seconds before reappearing
	  BounceForce (number)     — upward velocity applied
	  SpinSpeed (number)       — radians per second
	  ConveyorSpeed (number)   — studs per second
	  ConveyorDirection (string) — "left","right","forward","backward"
]]

local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Players = game:GetService("Players")

-- ── Helper ──

local function getAttr(part: BasePart, name: string, default: any): any
	local val = part:GetAttribute(name)
	if val ~= nil then
		return val
	end
	return default
end

local function getCharacterFromPart(hit: BasePart): (Model?, Humanoid?)
	local character = hit.Parent
	if not character then return nil, nil end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	if not humanoid then return nil, nil end
	if not Players:GetPlayerFromCharacter(character) then return nil, nil end
	return character, humanoid
end

-- ── Moving Platform ──

local function setupMovingPlatform(part: BasePart)
	local distance = getAttr(part, "MoveDistance", 20)
	local speed = getAttr(part, "MoveSpeed", 4)
	local direction = getAttr(part, "MoveDirection", "x")

	local startCFrame = part.CFrame
	local moveVector: Vector3

	if direction == "y" or direction == "vertical" then
		moveVector = Vector3.new(0, distance, 0)
	elseif direction == "z" or direction == "forward" then
		moveVector = Vector3.new(0, 0, distance)
	else -- "x" or "horizontal" or default
		moveVector = Vector3.new(distance, 0, 0)
	end

	local endCFrame = startCFrame + moveVector
	local tweenTime = distance / math.max(speed, 0.1)

	local tweenInfo = TweenInfo.new(tweenTime, Enum.EasingStyle.Linear, Enum.EasingDirection.InOut, -1, true)
	local tween = TweenService:Create(part, tweenInfo, { CFrame = endCFrame })
	tween:Play()
end

for _, part in CollectionService:GetTagged("MovingPlatform") do
	task.spawn(setupMovingPlatform, part)
end
CollectionService:GetInstanceAddedSignal("MovingPlatform"):Connect(function(part)
	task.spawn(setupMovingPlatform, part)
end)

-- ── Disappearing Platform ──

local function setupDisappearPlatform(part: BasePart)
	local disappearDelay = getAttr(part, "DisappearDelay", 1.5)
	local reappearDelay = getAttr(part, "ReappearDelay", 3)
	local originalTransparency = part.Transparency
	local debounce = false

	part.Touched:Connect(function(hit)
		if debounce then return end
		local _, humanoid = getCharacterFromPart(hit)
		if not humanoid then return end

		debounce = true

		-- Flash warning
		for i = 1, 3 do
			part.Transparency = 0.5
			task.wait(disappearDelay / 6)
			part.Transparency = originalTransparency
			task.wait(disappearDelay / 6)
		end

		-- Disappear
		part.Transparency = 1
		part.CanCollide = false

		-- Reappear after delay
		task.wait(reappearDelay)
		part.Transparency = originalTransparency
		part.CanCollide = true
		debounce = false
	end)
end

for _, part in CollectionService:GetTagged("DisappearPlatform") do
	task.spawn(setupDisappearPlatform, part)
end
CollectionService:GetInstanceAddedSignal("DisappearPlatform"):Connect(function(part)
	task.spawn(setupDisappearPlatform, part)
end)

-- ── Bouncy Platform ──

local function setupBouncyPlatform(part: BasePart)
	local bounceForce = getAttr(part, "BounceForce", 80)

	part.Touched:Connect(function(hit)
		local character, humanoid = getCharacterFromPart(hit)
		if not humanoid then return end

		local hrp = character:FindFirstChild("HumanoidRootPart") :: BasePart?
		if hrp then
			hrp.AssemblyLinearVelocity = Vector3.new(
				hrp.AssemblyLinearVelocity.X,
				bounceForce,
				hrp.AssemblyLinearVelocity.Z
			)
		end
	end)
end

for _, part in CollectionService:GetTagged("BouncyPlatform") do
	task.spawn(setupBouncyPlatform, part)
end
CollectionService:GetInstanceAddedSignal("BouncyPlatform"):Connect(function(part)
	task.spawn(setupBouncyPlatform, part)
end)

-- ── Spinner ──

local function setupSpinner(part: BasePart)
	local spinSpeed = getAttr(part, "SpinSpeed", 3) -- radians/sec

	RunService.Heartbeat:Connect(function(dt)
		if not part.Parent then return end
		part.CFrame = part.CFrame * CFrame.Angles(0, spinSpeed * dt, 0)
	end)
end

for _, part in CollectionService:GetTagged("Spinner") do
	task.spawn(setupSpinner, part)
end
CollectionService:GetInstanceAddedSignal("Spinner"):Connect(function(part)
	task.spawn(setupSpinner, part)
end)

-- ── Conveyor ──

local function setupConveyor(part: BasePart)
	local speed = getAttr(part, "ConveyorSpeed", 12)
	local direction = getAttr(part, "ConveyorDirection", "forward")

	local directionVector: Vector3
	if direction == "left" then
		directionVector = Vector3.new(-speed, 0, 0)
	elseif direction == "right" then
		directionVector = Vector3.new(speed, 0, 0)
	elseif direction == "backward" then
		directionVector = Vector3.new(0, 0, -speed)
	else -- "forward" or default
		directionVector = Vector3.new(0, 0, speed)
	end

	part.AssemblyLinearVelocity = directionVector
end

for _, part in CollectionService:GetTagged("Conveyor") do
	task.spawn(setupConveyor, part)
end
CollectionService:GetInstanceAddedSignal("Conveyor"):Connect(function(part)
	task.spawn(setupConveyor, part)
end)
`;


// ── Obby Template Scripts ──

const OBBY_OBBYUI_CLIENT_LUAU = `
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ObbyConfig = require(ReplicatedStorage:WaitForChild("ObbyConfig"))
local player = Players.LocalPlayer

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "ObbyHUD"
screenGui.ResetOnSpawn = false
screenGui.Parent = player:WaitForChild("PlayerGui")

-- Stage display (top center)
local stageFrame = Instance.new("Frame")
stageFrame.Name = "StageDisplay"
stageFrame.Size = UDim2.new(0, 220, 0, 50)
stageFrame.Position = UDim2.new(0.5, -110, 0, 10)
stageFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
stageFrame.BackgroundTransparency = 0.3
stageFrame.Parent = screenGui

local stageCorner = Instance.new("UICorner")
stageCorner.CornerRadius = UDim.new(0, 10)
stageCorner.Parent = stageFrame

local stageLabel = Instance.new("TextLabel")
stageLabel.Name = "StageLabel"
stageLabel.Size = UDim2.new(1, -16, 1, 0)
stageLabel.Position = UDim2.new(0, 8, 0, 0)
stageLabel.BackgroundTransparency = 1
stageLabel.Text = "Stage: 0 / " .. ObbyConfig.MaxStages
stageLabel.TextColor3 = Color3.new(1, 1, 1)
stageLabel.TextScaled = true
stageLabel.Font = Enum.Font.GothamBold
stageLabel.Parent = stageFrame

-- Death counter
if ObbyConfig.Features.EnableDeathCounter then
	local deathFrame = Instance.new("Frame")
	deathFrame.Name = "DeathDisplay"
	deathFrame.Size = UDim2.new(0, 160, 0, 40)
	deathFrame.Position = UDim2.new(0.5, -80, 0, 70)
	deathFrame.BackgroundColor3 = Color3.fromRGB(50, 20, 20)
	deathFrame.BackgroundTransparency = 0.3
	deathFrame.Parent = screenGui

	local deathCorner = Instance.new("UICorner")
	deathCorner.CornerRadius = UDim.new(0, 10)
	deathCorner.Parent = deathFrame

	local deathLabel = Instance.new("TextLabel")
	deathLabel.Name = "DeathLabel"
	deathLabel.Size = UDim2.new(1, -16, 1, 0)
	deathLabel.Position = UDim2.new(0, 8, 0, 0)
	deathLabel.BackgroundTransparency = 1
	deathLabel.Text = "Deaths: 0"
	deathLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
	deathLabel.TextScaled = true
	deathLabel.Font = Enum.Font.GothamBold
	deathLabel.Parent = deathFrame
end

-- Timer (top right)
if ObbyConfig.Features.EnableTimer then
	local timerFrame = Instance.new("Frame")
	timerFrame.Name = "TimerDisplay"
	timerFrame.Size = UDim2.new(0, 140, 0, 40)
	timerFrame.Position = UDim2.new(1, -150, 0, 10)
	timerFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
	timerFrame.BackgroundTransparency = 0.3
	timerFrame.Parent = screenGui

	local timerCorner = Instance.new("UICorner")
	timerCorner.CornerRadius = UDim.new(0, 10)
	timerCorner.Parent = timerFrame

	local timerLabel = Instance.new("TextLabel")
	timerLabel.Name = "TimerLabel"
	timerLabel.Size = UDim2.new(1, -16, 1, 0)
	timerLabel.Position = UDim2.new(0, 8, 0, 0)
	timerLabel.BackgroundTransparency = 1
	timerLabel.Text = "0:00"
	timerLabel.TextColor3 = Color3.new(1, 1, 1)
	timerLabel.TextScaled = true
	timerLabel.Font = Enum.Font.GothamBold
	timerLabel.Parent = timerFrame

	local startTime = tick()
	RunService.Heartbeat:Connect(function()
		local elapsed = tick() - startTime
		local minutes = math.floor(elapsed / 60)
		local seconds = math.floor(elapsed % 60)
		timerLabel.Text = string.format("%d:%02d", minutes, seconds)
	end)
end

-- Update displays from leaderstats
local leaderstats = player:WaitForChild("leaderstats")
local stageValue = leaderstats:WaitForChild("Stage")

stageValue.Changed:Connect(function(newValue)
	stageLabel.Text = "Stage: " .. newValue .. " / " .. ObbyConfig.MaxStages

	-- Show stage name if available
	local stageName = ObbyConfig.StageNames[newValue]
	if stageName then
		stageLabel.Text = stageName .. " (" .. newValue .. "/" .. ObbyConfig.MaxStages .. ")"
	end
end)

if ObbyConfig.Features.EnableDeathCounter then
	local deathValue = leaderstats:WaitForChild("Deaths")
	local deathDisplay = screenGui:FindFirstChild("DeathDisplay")
	if deathDisplay then
		local deathLabel = deathDisplay:FindFirstChild("DeathLabel")
		if deathLabel then
			deathValue.Changed:Connect(function(newValue)
				deathLabel.Text = "Deaths: " .. newValue
			end)
		end
	end
end
`;

const OBBY_DATAMANAGER_SERVER_LUAU = `
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")

local DATA_STORE_NAME = "ObbyPlayerData_v1"
local dataStore = DataStoreService:GetDataStore(DATA_STORE_NAME)

local MAX_RETRIES = 3
local playerData: { [Player]: { stage: number, deaths: number, bestTime: number? } } = {}

--- Retry a function with exponential backoff.
local function withRetry(fn: () -> any, label: string): (boolean, any)
	for attempt = 1, MAX_RETRIES do
		local success, result = pcall(fn)
		if success then
			return true, result
		end
		if attempt < MAX_RETRIES then
			local backoff = math.pow(2, attempt)
			warn(string.format("[DataManager] %s failed (attempt %d/%d): %s — retrying in %ds",
				label, attempt, MAX_RETRIES, tostring(result), backoff))
			task.wait(backoff)
		else
			warn(string.format("[DataManager] %s failed after %d attempts: %s",
				label, MAX_RETRIES, tostring(result)))
			return false, result
		end
	end
	return false, "Max retries reached"
end

local function loadPlayerData(player: Player)
	local key = "Player_" .. player.UserId
	local success, data = withRetry(function()
		return dataStore:GetAsync(key)
	end, "Load " .. player.Name)

	if success and data then
		playerData[player] = data
	else
		playerData[player] = {
			stage = 0,
			deaths = 0,
			bestTime = nil,
		}
	end
end

local function savePlayerData(player: Player)
	local data = playerData[player]
	if not data then
		return
	end

	local key = "Player_" .. player.UserId
	withRetry(function()
		dataStore:UpdateAsync(key, function()
			return data
		end)
	end, "Save " .. player.Name)
end

local function onPlayerAdded(player: Player)
	loadPlayerData(player)
end

local function onPlayerRemoving(player: Player)
	savePlayerData(player)
	playerData[player] = nil
end

Players.PlayerAdded:Connect(onPlayerAdded)
Players.PlayerRemoving:Connect(onPlayerRemoving)

-- Process players who joined before this script loaded
for _, player in Players:GetPlayers() do
	task.spawn(onPlayerAdded, player)
end

game:BindToClose(function()
	local threads = {}
	for _, player in Players:GetPlayers() do
		table.insert(threads, task.spawn(savePlayerData, player))
	end
	-- BindToClose gives ~30 seconds, plenty for retries
end)
`;

const OBBY_LEADERBOARDMANAGER_SERVER_LUAU = `
local Players = game:GetService("Players")

local function onPlayerAdded(player: Player)
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	leaderstats.Parent = player

	local stage = Instance.new("IntValue")
	stage.Name = "Stage"
	stage.Value = 0
	stage.Parent = leaderstats

	local deaths = Instance.new("IntValue")
	deaths.Name = "Deaths"
	deaths.Value = 0
	deaths.Parent = leaderstats
end

local function trackDeaths(player: Player)
	player.CharacterAdded:Connect(function(character)
		local humanoid = character:WaitForChild("Humanoid")
		humanoid.Died:Connect(function()
			local leaderstats = player:FindFirstChild("leaderstats")
			if leaderstats then
				local deathsVal = leaderstats:FindFirstChild("Deaths")
				if deathsVal then
					deathsVal.Value += 1
				end
			end
		end)
	end)
end

Players.PlayerAdded:Connect(function(player)
	onPlayerAdded(player)
	trackDeaths(player)
end)
`;

const OBBY_STAGEMANAGER_SERVER_LUAU = `
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ObbyConfig = require(ReplicatedStorage:WaitForChild("ObbyConfig"))

local playerStages: { [Player]: number } = {}

local function getStageCheckpoint(stageNum: number): SpawnLocation?
	local stages = workspace:WaitForChild("Stages")
	local stageName = "Stage" .. stageNum
	local stageFolder = stages:FindFirstChild(stageName)
	if not stageFolder then
		return nil
	end

	for _, child in stageFolder:GetChildren() do
		if child:IsA("SpawnLocation") then
			return child
		end
	end
	return nil
end

local function setPlayerStage(player: Player, stageNum: number)
	playerStages[player] = stageNum

	local leaderstats = player:FindFirstChild("leaderstats")
	if leaderstats then
		local stageValue = leaderstats:FindFirstChild("Stage")
		if stageValue then
			stageValue.Value = stageNum
		end
	end

	local checkpoint = getStageCheckpoint(stageNum)
	if checkpoint then
		player.RespawnLocation = checkpoint
	end
end

local function setupKillBricks()
	local function connectKillBrick(killBrick: BasePart)
		killBrick.Touched:Connect(function(hit)
			local character = hit.Parent
			if not character then
				return
			end
			local humanoid = character:FindFirstChildOfClass("Humanoid")
			if humanoid and humanoid.Health > 0 then
				humanoid:TakeDamage(ObbyConfig.KillBrickDamage)
			end
		end)
	end

	for _, killBrick in CollectionService:GetTagged("KillBrick") do
		connectKillBrick(killBrick)
	end

	CollectionService:GetInstanceAddedSignal("KillBrick"):Connect(connectKillBrick)
end

local function setupCheckpoints()
	local stages = workspace:WaitForChild("Stages")
	for _, stageFolder in stages:GetChildren() do
		local stageNum = tonumber(stageFolder.Name:match("%d+"))
		if not stageNum then
			continue
		end

		for _, child in stageFolder:GetChildren() do
			if child:IsA("SpawnLocation") then
				child.Touched:Connect(function(hit)
					local character = hit.Parent
					if not character then
						return
					end
					local player = Players:GetPlayerFromCharacter(character)
					if not player then
						return
					end

					local currentStage = playerStages[player] or 0
					if stageNum > currentStage then
						setPlayerStage(player, stageNum)
					end
				end)
			end
		end
	end
end

local function onPlayerAdded(player: Player)
	playerStages[player] = 0

	player.CharacterAdded:Connect(function()
		task.wait(0.1)
		local stage = playerStages[player] or 0
		if stage > 0 then
			local checkpoint = getStageCheckpoint(stage)
			if checkpoint then
				player.RespawnLocation = checkpoint
			end
		end
	end)
end

local function onPlayerRemoving(player: Player)
	playerStages[player] = nil
end

Players.PlayerAdded:Connect(onPlayerAdded)
Players.PlayerRemoving:Connect(onPlayerRemoving)

for _, player in Players:GetPlayers() do
	task.spawn(onPlayerAdded, player)
end

setupKillBricks()
setupCheckpoints()
`;

const OBBY_OBBYCONFIG_LUAU = `
local ObbyConfig = {}

ObbyConfig.GameName = "My Obby"
ObbyConfig.MaxStages = 5
ObbyConfig.Difficulty = "medium"

ObbyConfig.Features = {
	EnableTimer = true,
	EnableDeathCounter = true,
	EnableLeaderboard = true,
	SaveProgress = true,
}

ObbyConfig.StageNames = {
	[1] = "The Beginning",
	[2] = "Bridge of Peril",
	[3] = "Moving Madness",
	[4] = "Vanishing Act",
	[5] = "The Gauntlet",
}

ObbyConfig.KillBrickDamage = 100
ObbyConfig.RespawnDelay = 1

return ObbyConfig
`;

export function getObbyScripts(): ScriptFile[] {
  return [
    { relativePath: "src/client/ObbyUI.client.luau", name: "ObbyUI", scriptType: "client", content: OBBY_OBBYUI_CLIENT_LUAU },
    { relativePath: "src/server/DataManager.server.luau", name: "DataManager", scriptType: "server", content: OBBY_DATAMANAGER_SERVER_LUAU },
    { relativePath: "src/server/LeaderboardManager.server.luau", name: "LeaderboardManager", scriptType: "server", content: OBBY_LEADERBOARDMANAGER_SERVER_LUAU },
    { relativePath: "src/server/PlatformBehaviors.server.luau", name: "PlatformBehaviors", scriptType: "server", content: PLATFORM_BEHAVIORS },
    { relativePath: "src/server/StageManager.server.luau", name: "StageManager", scriptType: "server", content: OBBY_STAGEMANAGER_SERVER_LUAU },
    { relativePath: "src/shared/ObbyConfig.luau", name: "ObbyConfig", scriptType: "module", content: OBBY_OBBYCONFIG_LUAU },
    { relativePath: "src/shared/RateLimit.luau", name: "RateLimit", scriptType: "module", content: RATE_LIMIT },
  ];
}

// ── Tycoon Template Scripts ──

const TYCOON_TYCOONUI_CLIENT_LUAU = `
-- TycoonUI: client-side HUD for tycoon game
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- Create main HUD
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "TycoonHUD"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Cash display (top center)
local cashFrame = Instance.new("Frame")
cashFrame.Name = "CashFrame"
cashFrame.Size = UDim2.new(0, 220, 0, 50)
cashFrame.Position = UDim2.new(0.5, -110, 0, 10)
cashFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
cashFrame.BackgroundTransparency = 0.2
cashFrame.BorderSizePixel = 0
cashFrame.Parent = screenGui

local cashCorner = Instance.new("UICorner")
cashCorner.CornerRadius = UDim.new(0, 12)
cashCorner.Parent = cashFrame

local cashIcon = Instance.new("TextLabel")
cashIcon.Name = "Icon"
cashIcon.Size = UDim2.new(0, 40, 1, 0)
cashIcon.Position = UDim2.new(0, 5, 0, 0)
cashIcon.BackgroundTransparency = 1
cashIcon.Text = "$"
cashIcon.TextColor3 = Color3.fromRGB(100, 255, 100)
cashIcon.TextSize = 28
cashIcon.Font = Enum.Font.GothamBold
cashIcon.Parent = cashFrame

local cashLabel = Instance.new("TextLabel")
cashLabel.Name = "Amount"
cashLabel.Size = UDim2.new(1, -50, 1, 0)
cashLabel.Position = UDim2.new(0, 45, 0, 0)
cashLabel.BackgroundTransparency = 1
cashLabel.Text = "0"
cashLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
cashLabel.TextSize = 24
cashLabel.Font = Enum.Font.GothamBold
cashLabel.TextXAlignment = Enum.TextXAlignment.Left
cashLabel.Parent = cashFrame

-- Upgrades panel (right side)
local upgradesFrame = Instance.new("Frame")
upgradesFrame.Name = "UpgradesFrame"
upgradesFrame.Size = UDim2.new(0, 200, 0, 300)
upgradesFrame.Position = UDim2.new(1, -210, 0.5, -150)
upgradesFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
upgradesFrame.BackgroundTransparency = 0.2
upgradesFrame.BorderSizePixel = 0
upgradesFrame.Visible = false
upgradesFrame.Parent = screenGui

local upgradesCorner = Instance.new("UICorner")
upgradesCorner.CornerRadius = UDim.new(0, 12)
upgradesCorner.Parent = upgradesFrame

local upgradesTitle = Instance.new("TextLabel")
upgradesTitle.Size = UDim2.new(1, 0, 0, 36)
upgradesTitle.BackgroundTransparency = 1
upgradesTitle.Text = "Upgrades"
upgradesTitle.TextColor3 = Color3.fromRGB(255, 200, 50)
upgradesTitle.TextSize = 18
upgradesTitle.Font = Enum.Font.GothamBold
upgradesTitle.Parent = upgradesFrame

-- Listen for cash updates
local updateCash = ReplicatedStorage:WaitForChild("UpdateCash")
updateCash.OnClientEvent:Connect(function(newCash)
	cashLabel.Text = tostring(math.floor(newCash))
end)

-- Format numbers with commas
local function formatNumber(n)
	local formatted = tostring(math.floor(n))
	local k
	while true do
		formatted, k = string.gsub(formatted, "^(-?%d+)(%d%d%d)", "%1,%2")
		if k == 0 then break end
	end
	return formatted
end

-- Periodically update cash from server
task.spawn(function()
	while true do
		task.wait(1)
		local getCash = ReplicatedStorage:FindFirstChild("GetCash")
		if getCash then
			local success, cash = pcall(function()
				return getCash:InvokeServer()
			end)
			if success then
				cashLabel.Text = formatNumber(cash)
			end
		end
	end
end)

print("TycoonUI loaded")
`;

const TYCOON_DATAMANAGER_SERVER_LUAU = `
-- DataManager: saves and loads tycoon player data
local DataStoreService = game:GetService("DataStoreService")

local MAX_RETRIES = 3
local function withRetry(fn, label)
	for attempt = 1, MAX_RETRIES do
		local success, result = pcall(fn)
		if success then return true, result end
		if attempt < MAX_RETRIES then
			local backoff = math.pow(2, attempt)
			warn(string.format("[DataManager] %s failed (attempt %d/%d): %s", label, attempt, MAX_RETRIES, tostring(result)))
			task.wait(backoff)
		else
			warn(string.format("[DataManager] %s failed after %d attempts: %s", label, MAX_RETRIES, tostring(result)))
			return false, result
		end
	end
	return false, "Max retries"
end
local Players = game:GetService("Players")

local tycoonStore = DataStoreService:GetDataStore("TycoonData_v1")

local MAX_RETRIES = 3
local function withRetry(fn, label)
	for attempt = 1, MAX_RETRIES do
		local success, result = pcall(fn)
		if success then return true, result end
		if attempt < MAX_RETRIES then
			local backoff = math.pow(2, attempt)
			warn(string.format("[DataManager] %s failed (attempt %d/%d): %s", label, attempt, MAX_RETRIES, tostring(result)))
			task.wait(backoff)
		else
			warn(string.format("[DataManager] %s failed after %d attempts: %s", label, MAX_RETRIES, tostring(result)))
			return false, result
		end
	end
	return false, "Max retries"
end

local function loadPlayerData(player)
	local key = "user_" .. player.UserId
	local success, data = withRetry(function()
		return tycoonStore:GetAsync(key)
	end)

	if success and data then
		-- Restore saved cash
		local cashValue = Instance.new("IntValue")
		cashValue.Name = "SavedCash"
		cashValue.Value = data.cash or 0
		cashValue.Parent = player

		-- Restore upgrades
		local upgradesFolder = Instance.new("Folder")
		upgradesFolder.Name = "Upgrades"
		upgradesFolder.Parent = player

		if data.upgrades then
			for _, upgradeName in ipairs(data.upgrades) do
				local tag = Instance.new("StringValue")
				tag.Name = upgradeName
				tag.Value = upgradeName
				tag.Parent = upgradesFolder
			end
		end

		print("Loaded data for " .. player.Name)
	else
		-- New player defaults
		local cashValue = Instance.new("IntValue")
		cashValue.Name = "SavedCash"
		cashValue.Value = 0
		cashValue.Parent = player

		local upgradesFolder = Instance.new("Folder")
		upgradesFolder.Name = "Upgrades"
		upgradesFolder.Parent = player
	end
end

local function savePlayerData(player)
	local key = "user_" .. player.UserId
	local cash = player:FindFirstChild("SavedCash")
	local upgradesFolder = player:FindFirstChild("Upgrades")

	local upgrades = {}
	if upgradesFolder then
		for _, child in upgradesFolder:GetChildren() do
			table.insert(upgrades, child.Value)
		end
	end

	local data = {
		cash = cash and cash.Value or 0,
		upgrades = upgrades,
	}

	local success, err = withRetry(function()
		tycoonStore:SetAsync(key, data)
	end)

	if not success then
		warn("Failed to save data for " .. player.Name .. ": " .. tostring(err))
	else
		print("Saved data for " .. player.Name)
	end
end


-- Leaderstats
local function setupLeaderstats(player)
	local folder = Instance.new("Folder")
	folder.Name = "leaderstats"
	folder.Parent = player
	local cash = Instance.new("IntValue")
	cash.Name = "Cash"
	cash.Value = 0
	cash.Parent = folder
end

Players.PlayerAdded:Connect(function(player)
	setupLeaderstats(player)
	loadPlayerData(player)
end)
Players.PlayerRemoving:Connect(savePlayerData)

-- Auto-save every 5 minutes
task.spawn(function()
	while true do
		task.wait(300)
		for _, player in Players:GetPlayers() do
			savePlayerData(player)
		end
	end
end)

-- Save all on server shutdown
game:BindToClose(function()
	for _, player in Players:GetPlayers() do
		savePlayerData(player)
	end
end)

print("DataManager loaded")
`;

const TYCOON_INCOMEMANAGER_SERVER_LUAU = `
-- IncomeManager: handles upgrade purchases and income multipliers
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local TycoonConfig = require(ReplicatedStorage:WaitForChild("TycoonConfig"))

-- Create RemoteEvent for purchases
local purchaseEvent = Instance.new("RemoteEvent")
purchaseEvent.Name = "PurchaseUpgrade"
purchaseEvent.Parent = ReplicatedStorage

local function getPlayerCash(player)
	local getCash = ReplicatedStorage:FindFirstChild("GetCash")
	if getCash then
		return getCash:InvokeClient(player)
	end
	return 0
end

-- Upgrade button handling
local function setupUpgradeButton(button)
	button.Touched:Connect(function(hit)
		local character = hit.Parent
		local player = Players:GetPlayerFromCharacter(character)
		if not player then return end

		local plot = button.Parent
		-- Verify player owns this plot
		local upgradesFolder = player:FindFirstChild("Upgrades")
		if not upgradesFolder then return end

		-- Find next available upgrade
		local ownedUpgrades = {}
		for _, child in upgradesFolder:GetChildren() do
			ownedUpgrades[child.Value] = true
		end

		for _, upgrade in ipairs(TycoonConfig.Upgrades) do
			if not ownedUpgrades[upgrade.Name] then
				-- Check if player can afford it
				local cashEvent = ReplicatedStorage:FindFirstChild("GetCash")
				local cash = 0
				if cashEvent then
					local success, result = pcall(function()
						return cashEvent:InvokeServer()
					end)
					if success then cash = result end
				end

				-- For now, use the SavedCash value
				local savedCash = player:FindFirstChild("SavedCash")
				if savedCash and savedCash.Value >= upgrade.Cost then
					savedCash.Value = savedCash.Value - upgrade.Cost

					local tag = Instance.new("StringValue")
					tag.Name = upgrade.Name
					tag.Value = upgrade.Name
					tag.Parent = upgradesFolder

					-- Apply upgrade effect
					applyUpgrade(plot, upgrade)

					print(player.Name .. " purchased " .. upgrade.Name)

					-- Notify client
					local updateCash = ReplicatedStorage:FindFirstChild("UpdateCash")
					if updateCash then
						updateCash:FireClient(player, savedCash.Value)
					end
				end
				break
			end
		end
	end)
end

function applyUpgrade(plot, upgrade)
	if upgrade.Effect == "dropper_speed" then
		-- Handled by TycoonManager checking player upgrades
	elseif upgrade.Effect == "drop_value" then
		-- Handled by TycoonManager checking player upgrades
	elseif upgrade.Effect == "conveyor_speed" then
		for _, child in plot:GetChildren() do
			if CollectionService:HasTag(child, "Conveyor") then
				child.AssemblyLinearVelocity = child.AssemblyLinearVelocity * upgrade.Multiplier
			end
		end
	elseif upgrade.Effect == "auto_collect" then
		-- Enable auto-collection on collector
		for _, child in plot:GetChildren() do
			if CollectionService:HasTag(child, "Collector") then
				local autoTag = Instance.new("BoolValue")
				autoTag.Name = "AutoCollect"
				autoTag.Value = true
				autoTag.Parent = child
			end
		end
	end
end

for _, button in CollectionService:GetTagged("UpgradeButton") do
	setupUpgradeButton(button)
end

print("IncomeManager loaded")
`;

const TYCOON_TYCOONMANAGER_SERVER_LUAU = `
-- TycoonManager: handles plot claiming, droppers, conveyors, and collectors
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local TycoonConfig = require(ReplicatedStorage:WaitForChild("TycoonConfig"))

-- Track which player owns which plot
local plotOwners = {} -- [plotFolder] = player
local playerPlots = {} -- [player] = plotFolder
local playerCash = {} -- [player] = number

-- Find all plots
local plotsFolder = workspace:WaitForChild("Plots")

-- Claim button handling
local function setupClaimButton(button)
	button.Touched:Connect(function(hit)
		local character = hit.Parent
		local player = Players:GetPlayerFromCharacter(character)
		if not player then return end
		if playerPlots[player] then return end

		local plot = button.Parent
		if plotOwners[plot] then return end

		-- Claim the plot
		plotOwners[plot] = player
		playerPlots[player] = plot
		playerCash[player] = TycoonConfig.StartingCash

		-- Hide claim button
		button.Transparency = 1
		button.CanCollide = false

		-- Change plot base color to show ownership
		local base = plot:FindFirstChild("PlotBase")
		if base then
			base.Color = Color3.fromRGB(150, 200, 150)
		end

		print(player.Name .. " claimed plot " .. plot.Name)
	end)
end

for _, button in CollectionService:GetTagged("ClaimButton") do
	setupClaimButton(button)
end

-- Dropper system
local dropperTimers = {}

local function createDrop(dropper)
	local plot = dropper.Parent
	local owner = plotOwners[plot]
	if not owner then return end

	local drop = Instance.new("Part")
	drop.Name = "Drop"
	drop.Size = Vector3.new(1, 1, 1)
	drop.Position = dropper.Position + Vector3.new(0, 3, 0)
	drop.Color = Color3.fromRGB(0, 180, 255)
	drop.Material = Enum.Material.Neon
	drop.Anchored = false
	drop.CanCollide = true
	drop.Parent = workspace

	-- Tag with value
	local valueTag = Instance.new("IntValue")
	valueTag.Name = "DropValue"
	valueTag.Value = TycoonConfig.BaseDropValue
	valueTag.Parent = drop

	-- Auto-destroy after 30 seconds
	task.delay(30, function()
		if drop and drop.Parent then
			drop:Destroy()
		end
	end)
end

RunService.Heartbeat:Connect(function(dt)
	for _, dropper in CollectionService:GetTagged("Dropper") do
		if not dropperTimers[dropper] then
			dropperTimers[dropper] = 0
		end
		dropperTimers[dropper] = dropperTimers[dropper] + dt
		if dropperTimers[dropper] >= TycoonConfig.DropperInterval then
			dropperTimers[dropper] = 0
			createDrop(dropper)
		end
	end
end)

-- Conveyor system (reads direction from Attributes, fallback to Z-axis)
for _, conveyor in CollectionService:GetTagged("Conveyor") do
	local speed = conveyor:GetAttribute("ConveyorSpeed") or TycoonConfig.ConveyorSpeed
	local dir = conveyor:GetAttribute("ConveyorDirection") or "forward"

	if dir == "left" then
		conveyor.AssemblyLinearVelocity = Vector3.new(-speed, 0, 0)
	elseif dir == "right" then
		conveyor.AssemblyLinearVelocity = Vector3.new(speed, 0, 0)
	elseif dir == "backward" then
		conveyor.AssemblyLinearVelocity = Vector3.new(0, 0, -speed)
	else
		conveyor.AssemblyLinearVelocity = Vector3.new(0, 0, speed)
	end
end

-- Collector system
local function setupCollector(collector)
	collector.Touched:Connect(function(hit)
		if hit.Name ~= "Drop" then return end

		local plot = collector.Parent
		local owner = plotOwners[plot]
		if not owner then return end

		local valueTag = hit:FindFirstChild("DropValue")
		local value = valueTag and valueTag.Value or TycoonConfig.BaseDropValue

		playerCash[owner] = (playerCash[owner] or 0) + value
		hit:Destroy()

		-- Update cash display (via remote event if exists)
		local cashEvent = ReplicatedStorage:FindFirstChild("UpdateCash")
		if cashEvent then
			cashEvent:FireClient(owner, playerCash[owner])
		end
	end)
end

for _, collector in CollectionService:GetTagged("Collector") do
	setupCollector(collector)
end

-- Create RemoteEvent for cash updates
local cashEvent = Instance.new("RemoteEvent")
cashEvent.Name = "UpdateCash"
cashEvent.Parent = ReplicatedStorage

-- Create RemoteFunction for getting cash
local getCash = Instance.new("RemoteFunction")
getCash.Name = "GetCash"
getCash.Parent = ReplicatedStorage

getCash.OnServerInvoke = function(player)
	return playerCash[player] or 0
end

-- Upgrade button system
local upgradeEvent = Instance.new("RemoteEvent")
upgradeEvent.Name = "UpgradeEvent"
upgradeEvent.Parent = ReplicatedStorage

local function setupUpgradeButton(button)
	local upgradeName = button:GetAttribute("UpgradeName") or button.Name
	local upgradeCost = button:GetAttribute("UpgradeCost") or 100
	local upgradeMultiplier = button:GetAttribute("UpgradeMultiplier") or 2

	button.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player then return end

		local plot = button.Parent
		if plotOwners[plot] ~= player then return end

		local cash = playerCash[player] or 0
		if cash < upgradeCost then
			upgradeEvent:FireClient(player, {
				type = "error",
				message = "Need $" .. upgradeCost .. " (you have $" .. cash .. ")",
			})
			return
		end

		-- Check if already purchased
		local upgradesFolder = player:FindFirstChild("Upgrades")
		if not upgradesFolder then
			upgradesFolder = Instance.new("Folder")
			upgradesFolder.Name = "Upgrades"
			upgradesFolder.Parent = player
		end

		if upgradesFolder:FindFirstChild(upgradeName) then
			upgradeEvent:FireClient(player, { type = "error", message = "Already purchased!" })
			return
		end

		-- Purchase
		playerCash[player] = cash - upgradeCost
		local tag = Instance.new("StringValue")
		tag.Name = upgradeName
		tag.Value = upgradeName
		tag.Parent = upgradesFolder

		-- Hide the button
		button.Transparency = 1
		button.CanCollide = false

		-- Apply upgrade effect (e.g., faster dropper)
		if upgradeName:find("Speed") then
			-- Reduce dropper interval
			for _, dropper in CollectionService:GetTagged("Dropper") do
				if dropper.Parent == plot then
					local attr = dropper:GetAttribute("DropInterval")
					if attr then
						dropper:SetAttribute("DropInterval", attr / upgradeMultiplier)
					end
				end
			end
		end

		upgradeEvent:FireClient(player, {
			type = "purchased",
			name = upgradeName,
			cost = upgradeCost,
			cash = playerCash[player],
		})

		cashEvent:FireClient(player, playerCash[player])
	end)
end

for _, button in CollectionService:GetTagged("UpgradeButton") do
	setupUpgradeButton(button)
end
CollectionService:GetInstanceAddedSignal("UpgradeButton"):Connect(setupUpgradeButton)

-- Cleanup on player leaving
Players.PlayerRemoving:Connect(function(player)
	local plot = playerPlots[player]
	if plot then
		plotOwners[plot] = nil
		playerPlots[player] = nil

		-- Show claim button again
		for _, child in plot:GetChildren() do
			if CollectionService:HasTag(child, "ClaimButton") then
				child.Transparency = 0
				child.CanCollide = true
			end
		end

		local base = plot:FindFirstChild("PlotBase")
		if base then
			base.Color = Color3.fromRGB(200, 200, 200)
		end
	end
	playerCash[player] = nil
end)

print("TycoonManager loaded")
`;

const TYCOON_TYCOONCONFIG_LUAU = `
local TycoonConfig = {}

TycoonConfig.MaxPlots = 4
TycoonConfig.StartingCash = 0
TycoonConfig.DropperInterval = 2
TycoonConfig.BaseDropValue = 1
TycoonConfig.ConveyorSpeed = 10

TycoonConfig.Upgrades = {
	{
		Name = "Faster Dropper",
		Cost = 100,
		Effect = "dropper_speed",
		Multiplier = 1.5,
		Description = "Droppers produce 50% faster",
	},
	{
		Name = "Double Value",
		Cost = 500,
		Effect = "drop_value",
		Multiplier = 2,
		Description = "Each drop is worth 2x",
	},
	{
		Name = "Speed Conveyor",
		Cost = 250,
		Effect = "conveyor_speed",
		Multiplier = 2,
		Description = "Conveyors move items 2x faster",
	},
	{
		Name = "Auto Collector",
		Cost = 1000,
		Effect = "auto_collect",
		Multiplier = 1,
		Description = "Automatically collects items",
	},
}

TycoonConfig.PlotNames = {
	[1] = "Starter Factory",
	[2] = "Advanced Plant",
	[3] = "Mega Facility",
	[4] = "Ultimate HQ",
}

return TycoonConfig
`;

export function getTycoonScripts(): ScriptFile[] {
  return [
    { relativePath: "src/client/TycoonUI.client.luau", name: "TycoonUI", scriptType: "client", content: TYCOON_TYCOONUI_CLIENT_LUAU },
    { relativePath: "src/server/DataManager.server.luau", name: "DataManager", scriptType: "server", content: TYCOON_DATAMANAGER_SERVER_LUAU },
    { relativePath: "src/server/IncomeManager.server.luau", name: "IncomeManager", scriptType: "server", content: TYCOON_INCOMEMANAGER_SERVER_LUAU },
    { relativePath: "src/server/PlatformBehaviors.server.luau", name: "PlatformBehaviors", scriptType: "server", content: PLATFORM_BEHAVIORS },
    { relativePath: "src/server/TycoonManager.server.luau", name: "TycoonManager", scriptType: "server", content: TYCOON_TYCOONMANAGER_SERVER_LUAU },
    { relativePath: "src/shared/RateLimit.luau", name: "RateLimit", scriptType: "module", content: RATE_LIMIT },
    { relativePath: "src/shared/TycoonConfig.luau", name: "TycoonConfig", scriptType: "module", content: TYCOON_TYCOONCONFIG_LUAU },
  ];
}

// ── Simulator Template Scripts ──

const SIMULATOR_SIMULATORUI_CLIENT_LUAU = `
-- SimulatorUI: client-side HUD for simulator game
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- Create main HUD
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "SimHUD"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Coins display (top left)
local coinsFrame = Instance.new("Frame")
coinsFrame.Name = "CoinsFrame"
coinsFrame.Size = UDim2.new(0, 180, 0, 44)
coinsFrame.Position = UDim2.new(0, 12, 0, 12)
coinsFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
coinsFrame.BackgroundTransparency = 0.15
coinsFrame.BorderSizePixel = 0
coinsFrame.Parent = screenGui

local coinsCorner = Instance.new("UICorner")
coinsCorner.CornerRadius = UDim.new(0, 10)
coinsCorner.Parent = coinsFrame

local coinsIcon = Instance.new("TextLabel")
coinsIcon.Size = UDim2.new(0, 36, 1, 0)
coinsIcon.BackgroundTransparency = 1
coinsIcon.Text = "🪙"
coinsIcon.TextSize = 20
coinsIcon.Parent = coinsFrame

local coinsLabel = Instance.new("TextLabel")
coinsLabel.Name = "CoinsAmount"
coinsLabel.Size = UDim2.new(1, -40, 1, 0)
coinsLabel.Position = UDim2.new(0, 38, 0, 0)
coinsLabel.BackgroundTransparency = 1
coinsLabel.Text = "0"
coinsLabel.TextColor3 = Color3.fromRGB(255, 220, 50)
coinsLabel.TextSize = 20
coinsLabel.Font = Enum.Font.GothamBold
coinsLabel.TextXAlignment = Enum.TextXAlignment.Left
coinsLabel.Parent = coinsFrame

-- Gems display (below coins)
local gemsFrame = Instance.new("Frame")
gemsFrame.Name = "GemsFrame"
gemsFrame.Size = UDim2.new(0, 180, 0, 44)
gemsFrame.Position = UDim2.new(0, 12, 0, 62)
gemsFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
gemsFrame.BackgroundTransparency = 0.15
gemsFrame.BorderSizePixel = 0
gemsFrame.Parent = screenGui

local gemsCorner = Instance.new("UICorner")
gemsCorner.CornerRadius = UDim.new(0, 10)
gemsCorner.Parent = gemsFrame

local gemsIcon = Instance.new("TextLabel")
gemsIcon.Size = UDim2.new(0, 36, 1, 0)
gemsIcon.BackgroundTransparency = 1
gemsIcon.Text = "💎"
gemsIcon.TextSize = 20
gemsIcon.Parent = gemsFrame

local gemsLabel = Instance.new("TextLabel")
gemsLabel.Name = "GemsAmount"
gemsLabel.Size = UDim2.new(1, -40, 1, 0)
gemsLabel.Position = UDim2.new(0, 38, 0, 0)
gemsLabel.BackgroundTransparency = 1
gemsLabel.Text = "0"
gemsLabel.TextColor3 = Color3.fromRGB(150, 200, 255)
gemsLabel.TextSize = 20
gemsLabel.Font = Enum.Font.GothamBold
gemsLabel.TextXAlignment = Enum.TextXAlignment.Left
gemsLabel.Parent = gemsFrame

-- Click power indicator (top center)
local powerFrame = Instance.new("Frame")
powerFrame.Size = UDim2.new(0, 160, 0, 36)
powerFrame.Position = UDim2.new(0.5, -80, 0, 12)
powerFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
powerFrame.BackgroundTransparency = 0.15
powerFrame.BorderSizePixel = 0
powerFrame.Parent = screenGui

local powerCorner = Instance.new("UICorner")
powerCorner.CornerRadius = UDim.new(0, 10)
powerCorner.Parent = powerFrame

local powerLabel = Instance.new("TextLabel")
powerLabel.Name = "PowerLabel"
powerLabel.Size = UDim2.new(1, 0, 1, 0)
powerLabel.BackgroundTransparency = 1
powerLabel.Text = "⚡ Click Power: 1"
powerLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
powerLabel.TextSize = 14
powerLabel.Font = Enum.Font.GothamBold
powerLabel.Parent = powerFrame

-- Format numbers
local function formatNumber(n)
	if n >= 1000000 then
		return string.format("%.1fM", n / 1000000)
	elseif n >= 1000 then
		return string.format("%.1fK", n / 1000)
	end
	return tostring(math.floor(n))
end

-- Listen for stat updates
local updateStats = ReplicatedStorage:WaitForChild("UpdateStats")
updateStats.OnClientEvent:Connect(function(stats)
	if stats.coins then
		coinsLabel.Text = formatNumber(stats.coins)
	end
	if stats.gems then
		gemsLabel.Text = formatNumber(stats.gems)
	end
	if stats.clickPower then
		powerLabel.Text = "⚡ Click Power: " .. stats.clickPower
	end
end)

-- Handle clicking orbs
local clickEvent = ReplicatedStorage:WaitForChild("ClickOrb")
local mouse = player:GetMouse()

mouse.Button1Down:Connect(function()
	local target = mouse.Target
	if target and game:GetService("CollectionService"):HasTag(target, "ClickOrb") then
		clickEvent:FireServer(target)
	end
end)

print("SimulatorUI loaded")
`;

const SIMULATOR_CLICKMANAGER_SERVER_LUAU = `
-- ClickManager: handles clicking orbs to earn coins
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local SimConfig = require(ReplicatedStorage:WaitForChild("SimConfig"))
local RateLimit = require(ReplicatedStorage:WaitForChild("RateLimit"))

-- Remote events
local clickEvent = Instance.new("RemoteEvent")
clickEvent.Name = "ClickOrb"
clickEvent.Parent = ReplicatedStorage

local updateStats = Instance.new("RemoteEvent")
updateStats.Name = "UpdateStats"
updateStats.Parent = ReplicatedStorage

-- Player data (in-memory, DataManager handles persistence)
local playerData = {}

local function getPlayerData(player)
	if not playerData[player] then
		playerData[player] = {
			coins = SimConfig.StartingCoins,
			gems = SimConfig.StartingGems,
			clickPower = SimConfig.ClickPower,
			coinMultiplier = 1,
			rebirthLevel = 0,
			pets = {},
			maxPets = 3,
			autoClick = false,
			upgrades = {},
		}
	end
	return playerData[player]
end

-- Handle click events from client (rate-limited to prevent exploits)
clickEvent.OnServerEvent:Connect(function(player, orbInstance)
	if not RateLimit.check(player, "click", 0.1) then return end
	if not orbInstance or not orbInstance:IsA("BasePart") then return end
	if not CollectionService:HasTag(orbInstance, "ClickOrb") then return end

	local data = getPlayerData(player)

	-- Calculate coins earned
	local baseCoins = data.clickPower
	local multiplier = data.coinMultiplier

	-- Apply pet boosts
	for _, pet in ipairs(data.pets) do
		multiplier = multiplier * (pet.CoinBoost or 1)
	end

	-- Apply rebirth multiplier
	if data.rebirthLevel > 0 then
		for _, rebirth in ipairs(SimConfig.Rebirths) do
			if data.rebirthLevel >= rebirth.Level then
				multiplier = multiplier * rebirth.Multiplier
			end
		end
	end

	local earned = math.floor(baseCoins * multiplier)
	data.coins = data.coins + earned

	-- Visual feedback on the orb
	task.spawn(function()
		local originalSize = orbInstance.Size
		local originalColor = orbInstance.Color
		orbInstance.Size = originalSize * 0.85
		orbInstance.Color = Color3.fromRGB(255, 255, 200)
		task.wait(0.1)
		orbInstance.Size = originalSize
		orbInstance.Color = originalColor
	end)

	-- Update client
	updateStats:FireClient(player, {
		coins = data.coins,
		gems = data.gems,
		clickPower = data.clickPower,
		rebirthLevel = data.rebirthLevel,
		petCount = #data.pets,
	})
end)

-- Auto-click system
task.spawn(function()
	while true do
		task.wait(1)
		for _, player in Players:GetPlayers() do
			local data = getPlayerData(player)
			if data.autoClick then
				local earned = math.floor(data.clickPower * data.coinMultiplier * 0.5)
				data.coins = data.coins + earned
				updateStats:FireClient(player, {
					coins = data.coins,
					gems = data.gems,
					clickPower = data.clickPower,
					rebirthLevel = data.rebirthLevel,
					petCount = #data.pets,
				})
			end
		end
	end
end)

-- Expose data for other scripts
local getDataFunc = Instance.new("BindableFunction")
getDataFunc.Name = "GetPlayerData"
getDataFunc.Parent = script
getDataFunc.OnInvoke = function(player)
	return getPlayerData(player)
end

-- Cleanup
Players.PlayerRemoving:Connect(function(player)
	playerData[player] = nil
end)

print("ClickManager loaded")
`;

const SIMULATOR_DATAMANAGER_SERVER_LUAU = `
-- DataManager: saves and loads simulator player data
local DataStoreService = game:GetService("DataStoreService")

local MAX_RETRIES = 3
local function withRetry(fn, label)
	for attempt = 1, MAX_RETRIES do
		local success, result = pcall(fn)
		if success then return true, result end
		if attempt < MAX_RETRIES then
			local backoff = math.pow(2, attempt)
			warn(string.format("[DataManager] %s failed (attempt %d/%d): %s", label, attempt, MAX_RETRIES, tostring(result)))
			task.wait(backoff)
		else
			warn(string.format("[DataManager] %s failed after %d attempts: %s", label, MAX_RETRIES, tostring(result)))
			return false, result
		end
	end
	return false, "Max retries"
end
local Players = game:GetService("Players")

local simStore = DataStoreService:GetDataStore("SimulatorData_v1")

local MAX_RETRIES = 3
local function withRetry(fn, label)
	for attempt = 1, MAX_RETRIES do
		local success, result = pcall(fn)
		if success then return true, result end
		if attempt < MAX_RETRIES then
			local backoff = math.pow(2, attempt)
			warn(string.format("[DataManager] %s failed (attempt %d/%d): %s", label, attempt, MAX_RETRIES, tostring(result)))
			task.wait(backoff)
		else
			warn(string.format("[DataManager] %s failed after %d attempts: %s", label, MAX_RETRIES, tostring(result)))
			return false, result
		end
	end
	return false, "Max retries"
end

local function loadPlayerData(player)
	local key = "user_" .. player.UserId
	local success, data = withRetry(function()
		return tycoonStore:GetAsync(key)
	end)

	if success and data then
		local folder = Instance.new("Folder")
		folder.Name = "SimSave"
		folder.Parent = player

		local coins = Instance.new("IntValue")
		coins.Name = "Coins"
		coins.Value = data.coins or 0
		coins.Parent = folder

		local gems = Instance.new("IntValue")
		gems.Name = "Gems"
		gems.Value = data.gems or 0
		gems.Parent = folder

		local rebirth = Instance.new("IntValue")
		rebirth.Name = "RebirthLevel"
		rebirth.Value = data.rebirthLevel or 0
		rebirth.Parent = folder

		print("Loaded data for " .. player.Name)
	else
		local folder = Instance.new("Folder")
		folder.Name = "SimSave"
		folder.Parent = player
	end
end

local function savePlayerData(player)
	local key = "user_" .. player.UserId
	local getDataFunc = game.ServerScriptService:FindFirstChild("ClickManager")
		and game.ServerScriptService.ClickManager:FindFirstChild("GetPlayerData")

	local saveData = { coins = 0, gems = 0, rebirthLevel = 0, pets = {} }

	if getDataFunc then
		local data = getDataFunc:Invoke(player)
		if data then
			saveData.coins = data.coins or 0
			saveData.gems = data.gems or 0
			saveData.rebirthLevel = data.rebirthLevel or 0
			saveData.pets = {}
			for _, pet in ipairs(data.pets or {}) do
				table.insert(saveData.pets, {
					Name = pet.Name,
					Rarity = pet.Rarity,
					CoinBoost = pet.CoinBoost,
				})
			end
		end
	end

	local success, err = withRetry(function()
		simStore:SetAsync(key, saveData)
	end)

	if not success then
		warn("Failed to save data for " .. player.Name .. ": " .. tostring(err))
	end
end


-- Leaderstats
local function setupLeaderstats(player)
	local folder = Instance.new("Folder")
	folder.Name = "leaderstats"
	folder.Parent = player
	local coins = Instance.new("IntValue")
	coins.Name = "Coins"
	coins.Value = 0
	coins.Parent = folder
	local rebirths = Instance.new("IntValue")
	rebirths.Name = "Rebirths"
	rebirths.Value = 0
	rebirths.Parent = folder
end

Players.PlayerAdded:Connect(loadPlayerData)
Players.PlayerRemoving:Connect(savePlayerData)

task.spawn(function()
	while true do
		task.wait(300)
		for _, player in Players:GetPlayers() do
			savePlayerData(player)
		end
	end
end)

game:BindToClose(function()
	for _, player in Players:GetPlayers() do
		savePlayerData(player)
	end
end)

print("DataManager loaded")
`;

const SIMULATOR_PETMANAGER_SERVER_LUAU = `
-- PetManager: handles egg hatching, pet equipping, and pet effects
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local SimConfig = require(ReplicatedStorage:WaitForChild("SimConfig"))

local hatchEvent = Instance.new("RemoteEvent")
hatchEvent.Name = "HatchEgg"
hatchEvent.Parent = ReplicatedStorage

local petUpdateEvent = Instance.new("RemoteEvent")
petUpdateEvent.Name = "PetUpdate"
petUpdateEvent.Parent = ReplicatedStorage

local function getPlayerData(player)
	local getDataFunc = game.ServerScriptService.ClickManager:FindFirstChild("GetPlayerData")
	if getDataFunc then
		return getDataFunc:Invoke(player)
	end
	return nil
end

local function rollPet(hatchCost)
	local eligiblePets = {}
	for _, pet in ipairs(SimConfig.Pets) do
		if pet.HatchCost <= hatchCost then
			table.insert(eligiblePets, pet)
		end
	end

	if #eligiblePets == 0 then return nil end

	local roll = math.random(1, 100)
	local cumulative = 0
	for _, pet in ipairs(eligiblePets) do
		cumulative = cumulative + pet.HatchChance
		if roll <= cumulative then
			return pet
		end
	end

	return eligiblePets[1]
end

-- ── Visible pet models ──

local activePetModels: { [Player]: { Model } } = {}

local RARITY_COLORS = {
	Common = Color3.fromRGB(150, 150, 150),
	Uncommon = Color3.fromRGB(50, 200, 50),
	Rare = Color3.fromRGB(50, 100, 255),
	Epic = Color3.fromRGB(180, 50, 255),
	Legendary = Color3.fromRGB(255, 200, 0),
}

local function spawnPetModel(player: Player, petData: { Name: string, Rarity: string, CoinBoost: number })
	local character = player.Character
	if not character then return end
	local hrp = character:FindFirstChild("HumanoidRootPart")
	if not hrp then return end

	local model = Instance.new("Model")
	model.Name = petData.Name .. "_Pet"

	-- Pet body
	local body = Instance.new("Part")
	body.Name = "Body"
	body.Size = Vector3.new(2, 2, 2)
	body.Shape = Enum.PartType.Ball
	body.Color = RARITY_COLORS[petData.Rarity] or RARITY_COLORS.Common
	body.Material = Enum.Material.SmoothPlastic
	body.Anchored = true
	body.CanCollide = false
	body.Parent = model

	-- Name label
	local billboard = Instance.new("BillboardGui")
	billboard.Size = UDim2.new(0, 80, 0, 20)
	billboard.StudsOffset = Vector3.new(0, 2, 0)
	billboard.AlwaysOnTop = true
	billboard.Parent = body

	local nameLabel = Instance.new("TextLabel")
	nameLabel.Size = UDim2.new(1, 0, 1, 0)
	nameLabel.BackgroundTransparency = 1
	nameLabel.Text = petData.Name
	nameLabel.TextColor3 = RARITY_COLORS[petData.Rarity] or Color3.new(1, 1, 1)
	nameLabel.TextScaled = true
	nameLabel.Font = Enum.Font.GothamBold
	nameLabel.Parent = billboard

	-- Glow for rare+
	if petData.Rarity == "Epic" or petData.Rarity == "Legendary" then
		local light = Instance.new("PointLight")
		light.Color = RARITY_COLORS[petData.Rarity]
		light.Range = 8
		light.Brightness = 1
		light.Parent = body
	end

	model.PrimaryPart = body
	model.Parent = workspace

	-- Track
	if not activePetModels[player] then
		activePetModels[player] = {}
	end
	table.insert(activePetModels[player], model)

	-- Follow loop
	local petIndex = #activePetModels[player]
	task.spawn(function()
		while model.Parent and character.Parent do
			local targetHRP = character:FindFirstChild("HumanoidRootPart")
			if not targetHRP then break end

			-- Orbit behind player at different angles per pet
			local angle = tick() * 1.5 + petIndex * (math.pi * 2 / math.max(1, #(activePetModels[player] or {})))
			local radius = 4
			local offset = Vector3.new(
				math.cos(angle) * radius,
				1.5 + math.sin(tick() * 2) * 0.3, -- gentle bob
				math.sin(angle) * radius
			)
			local targetPos = targetHRP.Position + offset
			body.CFrame = body.CFrame:Lerp(CFrame.new(targetPos), 0.1)
			task.wait(0.03)
		end

		if model.Parent then model:Destroy() end
	end)
end

local function despawnPets(player: Player)
	local pets = activePetModels[player]
	if pets then
		for _, model in pets do
			if model.Parent then model:Destroy() end
		end
	end
	activePetModels[player] = nil
end

-- Handle egg hatching
hatchEvent.OnServerEvent:Connect(function(player, eggPad)
	if not eggPad or not CollectionService:HasTag(eggPad, "EggHatchPad") then return end

	local data = getPlayerData(player)
	if not data then return end

	local hatchCost = 100
	if data.coins < hatchCost then return end

	if #data.pets >= data.maxPets then
		petUpdateEvent:FireClient(player, { error = "Pet slots full! Buy more slots or release a pet." })
		return
	end

	data.coins = data.coins - hatchCost

	local newPet = rollPet(hatchCost)
	if newPet then
		table.insert(data.pets, {
			Name = newPet.Name,
			Rarity = newPet.Rarity,
			CoinBoost = newPet.CoinBoost,
		})

		petUpdateEvent:FireClient(player, {
			hatched = newPet.Name,
			rarity = newPet.Rarity,
			coinBoost = newPet.CoinBoost,
			pets = data.pets,
			coins = data.coins,
		})

		print(player.Name .. " hatched a " .. newPet.Rarity .. " " .. newPet.Name)

		spawnPetModel(player, {
			Name = newPet.Name,
			Rarity = newPet.Rarity,
			CoinBoost = newPet.CoinBoost,
		})
	end
end)

-- Respawn pets when character loads
Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(function()
		task.wait(1) -- Wait for character to fully load
		local data = getPlayerData(player)
		if data and data.pets then
			despawnPets(player)
			for _, petData in ipairs(data.pets) do
				spawnPetModel(player, petData)
			end
		end
	end)
end)

Players.PlayerRemoving:Connect(function(player)
	despawnPets(player)
end)

-- Egg pad visual animation
for _, pad in CollectionService:GetTagged("EggHatchPad") do
	task.spawn(function()
		local basePos = pad.Position
		while pad and pad.Parent do
			for i = 0, math.pi * 2, 0.05 do
				if not pad or not pad.Parent then break end
				pad.Position = basePos + Vector3.new(0, math.sin(i) * 0.3, 0)
				task.wait(0.03)
			end
		end
	end)
end

print("PetManager loaded")
`;

const SIMULATOR_REBIRTHMANAGER_SERVER_LUAU = `
-- RebirthManager: handles rebirth system for permanent multipliers
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local SimConfig = require(ReplicatedStorage:WaitForChild("SimConfig"))

local rebirthEvent = Instance.new("RemoteEvent")
rebirthEvent.Name = "Rebirth"
rebirthEvent.Parent = ReplicatedStorage

local function getPlayerData(player)
	local getDataFunc = game.ServerScriptService.ClickManager:FindFirstChild("GetPlayerData")
	if getDataFunc then
		return getDataFunc:Invoke(player)
	end
	return nil
end

rebirthEvent.OnServerEvent:Connect(function(player)
	local data = getPlayerData(player)
	if not data then return end

	local nextLevel = data.rebirthLevel + 1
	local rebirthInfo = nil

	for _, r in ipairs(SimConfig.Rebirths) do
		if r.Level == nextLevel then
			rebirthInfo = r
			break
		end
	end

	if not rebirthInfo then
		local updateStats = ReplicatedStorage:FindFirstChild("UpdateStats")
		if updateStats then
			updateStats:FireClient(player, {
				error = "Max rebirth level reached!",
				coins = data.coins,
				gems = data.gems,
				clickPower = data.clickPower,
				rebirthLevel = data.rebirthLevel,
				petCount = #data.pets,
			})
		end
		return
	end

	if data.coins < rebirthInfo.RequiredCoins then return end

	-- Reset coins, keep gems and pets
	data.coins = 0
	data.clickPower = SimConfig.ClickPower
	data.rebirthLevel = nextLevel
	data.gems = data.gems + rebirthInfo.GemsReward
	data.coinMultiplier = 1
	data.autoClick = false
	data.upgrades = {}

	local updateStats = ReplicatedStorage:FindFirstChild("UpdateStats")
	if updateStats then
		updateStats:FireClient(player, {
			coins = data.coins,
			gems = data.gems,
			clickPower = data.clickPower,
			rebirthLevel = data.rebirthLevel,
			petCount = #data.pets,
			rebirthComplete = true,
			gemsEarned = rebirthInfo.GemsReward,
		})
	end

	print(player.Name .. " rebirthed to level " .. nextLevel .. "! Earned " .. rebirthInfo.GemsReward .. " gems")
end)

print("RebirthManager loaded")
`;

const SIMULATOR_SIMCONFIG_LUAU = `
local SimConfig = {}

SimConfig.StartingCoins = 0
SimConfig.StartingGems = 0
SimConfig.ClickPower = 1
SimConfig.ClickCooldown = 0

SimConfig.Zones = {
	{
		Name = "Starter Meadow",
		RequiredCoins = 0,
		CoinMultiplier = 1,
		Color = Color3.fromRGB(120, 200, 120),
	},
	{
		Name = "Crystal Caves",
		RequiredCoins = 1000,
		CoinMultiplier = 3,
		Color = Color3.fromRGB(150, 100, 220),
	},
	{
		Name = "Lava Peaks",
		RequiredCoins = 10000,
		CoinMultiplier = 10,
		Color = Color3.fromRGB(220, 80, 50),
	},
}

SimConfig.Pets = {
	{
		Name = "Basic Cat",
		Rarity = "Common",
		CoinBoost = 1.2,
		HatchCost = 100,
		HatchChance = 60,
		Color = Color3.fromRGB(200, 180, 140),
	},
	{
		Name = "Lucky Dog",
		Rarity = "Common",
		CoinBoost = 1.3,
		HatchCost = 100,
		HatchChance = 30,
		Color = Color3.fromRGB(180, 140, 100),
	},
	{
		Name = "Crystal Fox",
		Rarity = "Rare",
		CoinBoost = 2.0,
		HatchCost = 500,
		HatchChance = 8,
		Color = Color3.fromRGB(100, 180, 255),
	},
	{
		Name = "Golden Dragon",
		Rarity = "Legendary",
		CoinBoost = 5.0,
		HatchCost = 500,
		HatchChance = 2,
		Color = Color3.fromRGB(255, 200, 50),
	},
}

SimConfig.Rebirths = {
	{
		Level = 1,
		RequiredCoins = 50000,
		Multiplier = 2,
		GemsReward = 10,
	},
	{
		Level = 2,
		RequiredCoins = 200000,
		Multiplier = 3,
		GemsReward = 25,
	},
	{
		Level = 3,
		RequiredCoins = 1000000,
		Multiplier = 5,
		GemsReward = 50,
	},
}

SimConfig.Upgrades = {
	{
		Name = "Click Power +1",
		Cost = 50,
		Currency = "coins",
		Effect = "click_power",
		Value = 1,
	},
	{
		Name = "Auto Click",
		Cost = 500,
		Currency = "coins",
		Effect = "auto_click",
		Value = 1,
	},
	{
		Name = "2x Coins",
		Cost = 10,
		Currency = "gems",
		Effect = "coin_multiplier",
		Value = 2,
	},
	{
		Name = "Extra Pet Slot",
		Cost = 25,
		Currency = "gems",
		Effect = "pet_slots",
		Value = 1,
	},
}

return SimConfig
`;

export function getSimulatorScripts(): ScriptFile[] {
  return [
    { relativePath: "src/client/SimulatorUI.client.luau", name: "SimulatorUI", scriptType: "client", content: SIMULATOR_SIMULATORUI_CLIENT_LUAU },
    { relativePath: "src/server/ClickManager.server.luau", name: "ClickManager", scriptType: "server", content: SIMULATOR_CLICKMANAGER_SERVER_LUAU },
    { relativePath: "src/server/DataManager.server.luau", name: "DataManager", scriptType: "server", content: SIMULATOR_DATAMANAGER_SERVER_LUAU },
    { relativePath: "src/server/PetManager.server.luau", name: "PetManager", scriptType: "server", content: SIMULATOR_PETMANAGER_SERVER_LUAU },
    { relativePath: "src/server/PlatformBehaviors.server.luau", name: "PlatformBehaviors", scriptType: "server", content: PLATFORM_BEHAVIORS },
    { relativePath: "src/server/RebirthManager.server.luau", name: "RebirthManager", scriptType: "server", content: SIMULATOR_REBIRTHMANAGER_SERVER_LUAU },
    { relativePath: "src/shared/RateLimit.luau", name: "RateLimit", scriptType: "module", content: RATE_LIMIT },
    { relativePath: "src/shared/SimConfig.luau", name: "SimConfig", scriptType: "module", content: SIMULATOR_SIMCONFIG_LUAU },
  ];
}

// ── Battlegrounds Template Scripts ──

const BATTLEGROUNDS_BATTLEUI_CLIENT_LUAU = `
-- BattleUI: client-side HUD for battlegrounds game
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- Create main HUD
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "BattleHUD"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Health bar (top center)
local healthFrame = Instance.new("Frame")
healthFrame.Name = "HealthFrame"
healthFrame.Size = UDim2.new(0, 260, 0, 30)
healthFrame.Position = UDim2.new(0.5, -130, 0, 12)
healthFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 40)
healthFrame.BorderSizePixel = 0
healthFrame.Parent = screenGui

local healthCorner = Instance.new("UICorner")
healthCorner.CornerRadius = UDim.new(0, 8)
healthCorner.Parent = healthFrame

local healthBar = Instance.new("Frame")
healthBar.Name = "Bar"
healthBar.Size = UDim2.new(1, -4, 1, -4)
healthBar.Position = UDim2.new(0, 2, 0, 2)
healthBar.BackgroundColor3 = Color3.fromRGB(80, 220, 80)
healthBar.BorderSizePixel = 0
healthBar.Parent = healthFrame

local healthBarCorner = Instance.new("UICorner")
healthBarCorner.CornerRadius = UDim.new(0, 6)
healthBarCorner.Parent = healthBar

local healthLabel = Instance.new("TextLabel")
healthLabel.Name = "Label"
healthLabel.Size = UDim2.new(1, 0, 1, 0)
healthLabel.BackgroundTransparency = 1
healthLabel.Text = "100 / 100"
healthLabel.TextColor3 = Color3.new(1, 1, 1)
healthLabel.TextSize = 14
healthLabel.Font = Enum.Font.GothamBold
healthLabel.Parent = healthFrame

-- Kill/Death counter (top left)
local statsFrame = Instance.new("Frame")
statsFrame.Size = UDim2.new(0, 160, 0, 50)
statsFrame.Position = UDim2.new(0, 12, 0, 12)
statsFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
statsFrame.BackgroundTransparency = 0.15
statsFrame.BorderSizePixel = 0
statsFrame.Parent = screenGui

local statsCorner = Instance.new("UICorner")
statsCorner.CornerRadius = UDim.new(0, 10)
statsCorner.Parent = statsFrame

local killsLabel = Instance.new("TextLabel")
killsLabel.Name = "Kills"
killsLabel.Size = UDim2.new(0.5, 0, 1, 0)
killsLabel.BackgroundTransparency = 1
killsLabel.Text = "0 Kills"
killsLabel.TextColor3 = Color3.fromRGB(100, 255, 100)
killsLabel.TextSize = 16
killsLabel.Font = Enum.Font.GothamBold
killsLabel.Parent = statsFrame

local deathsLabel = Instance.new("TextLabel")
deathsLabel.Name = "Deaths"
deathsLabel.Size = UDim2.new(0.5, 0, 1, 0)
deathsLabel.Position = UDim2.new(0.5, 0, 0, 0)
deathsLabel.BackgroundTransparency = 1
deathsLabel.Text = "0 Deaths"
deathsLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
deathsLabel.TextSize = 16
deathsLabel.Font = Enum.Font.GothamBold
deathsLabel.Parent = statsFrame

-- Ability bar (bottom center)
local abilityBar = Instance.new("Frame")
abilityBar.Name = "AbilityBar"
abilityBar.Size = UDim2.new(0, 300, 0, 60)
abilityBar.Position = UDim2.new(0.5, -150, 1, -75)
abilityBar.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
abilityBar.BackgroundTransparency = 0.2
abilityBar.BorderSizePixel = 0
abilityBar.Parent = screenGui

local abilityCorner = Instance.new("UICorner")
abilityCorner.CornerRadius = UDim.new(0, 12)
abilityCorner.Parent = abilityBar

local abilityLayout = Instance.new("UIListLayout")
abilityLayout.FillDirection = Enum.FillDirection.Horizontal
abilityLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center
abilityLayout.VerticalAlignment = Enum.VerticalAlignment.Center
abilityLayout.Padding = UDim.new(0, 8)
abilityLayout.Parent = abilityBar

-- Round timer (top right)
local timerLabel = Instance.new("TextLabel")
timerLabel.Name = "Timer"
timerLabel.Size = UDim2.new(0, 120, 0, 40)
timerLabel.Position = UDim2.new(1, -132, 0, 12)
timerLabel.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
timerLabel.BackgroundTransparency = 0.15
timerLabel.Text = "2:00"
timerLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
timerLabel.TextSize = 22
timerLabel.Font = Enum.Font.GothamBold
timerLabel.BorderSizePixel = 0
timerLabel.Parent = screenGui

local timerCorner = Instance.new("UICorner")
timerCorner.CornerRadius = UDim.new(0, 10)
timerCorner.Parent = timerLabel

-- Kill feed (top right below timer)
local killFeed = Instance.new("Frame")
killFeed.Name = "KillFeed"
killFeed.Size = UDim2.new(0, 250, 0, 120)
killFeed.Position = UDim2.new(1, -262, 0, 60)
killFeed.BackgroundTransparency = 1
killFeed.Parent = screenGui

local killFeedLayout = Instance.new("UIListLayout")
killFeedLayout.SortOrder = Enum.SortOrder.LayoutOrder
killFeedLayout.Padding = UDim.new(0, 2)
killFeedLayout.Parent = killFeed

-- Handle ability keys (1, 2, 3, 4)
local useAbilityEvent = ReplicatedStorage:WaitForChild("UseAbility")

UserInputService.InputBegan:Connect(function(input, processed)
	if processed then return end
	local keyMap = {
		[Enum.KeyCode.One] = 1,
		[Enum.KeyCode.Two] = 2,
		[Enum.KeyCode.Three] = 3,
		[Enum.KeyCode.Four] = 4,
	}
	local slot = keyMap[input.KeyCode]
	if slot then
		local mouse = player:GetMouse()
		local targetPos = mouse.Hit and mouse.Hit.Position or Vector3.new(0, 0, 0)
		useAbilityEvent:FireServer("ability_" .. slot, targetPos)
	end
end)

-- Listen for kill feed
local killFeedEvent = ReplicatedStorage:WaitForChild("KillFeed")
killFeedEvent.OnClientEvent:Connect(function(killerName, victimName, abilityName)
	local entry = Instance.new("TextLabel")
	entry.Size = UDim2.new(1, 0, 0, 20)
	entry.BackgroundColor3 = Color3.fromRGB(20, 20, 30)
	entry.BackgroundTransparency = 0.3
	entry.Text = killerName .. " → " .. victimName .. " (" .. abilityName .. ")"
	entry.TextColor3 = Color3.fromRGB(255, 200, 100)
	entry.TextSize = 12
	entry.Font = Enum.Font.GothamBold
	entry.TextXAlignment = Enum.TextXAlignment.Right
	entry.Parent = killFeed

	task.delay(5, function()
		if entry and entry.Parent then
			entry:Destroy()
		end
	end)
end)

-- Update health bar
task.spawn(function()
	while true do
		task.wait(0.1)
		local character = player.Character
		if character then
			local humanoid = character:FindFirstChild("Humanoid")
			if humanoid then
				local pct = humanoid.Health / humanoid.MaxHealth
				healthBar.Size = UDim2.new(pct, -4, 1, -4)
				healthBar.BackgroundColor3 = Color3.fromRGB(
					math.floor(255 * (1 - pct)),
					math.floor(220 * pct),
					80
				)
				healthLabel.Text = math.floor(humanoid.Health) .. " / " .. humanoid.MaxHealth
			end
		end
	end
end)

print("BattleUI loaded")
`;

const BATTLEGROUNDS_COLLISIONGROUPSETUP_SERVER_LUAU = `
-- CollisionGroupSetup: configure collision groups for PvP modes
-- Players don't collide with each other (prevents body-blocking in combat)
-- Projectiles collide with players but not with other projectiles

local PhysicsService = game:GetService("PhysicsService")
local Players = game:GetService("Players")

-- Register collision groups
PhysicsService:RegisterCollisionGroup("Players")
PhysicsService:RegisterCollisionGroup("Projectiles")

-- Players don't collide with each other
PhysicsService:CollisionGroupSetCollidable("Players", "Players", false)

-- Projectiles don't collide with each other
PhysicsService:CollisionGroupSetCollidable("Projectiles", "Projectiles", false)

-- Projectiles DO collide with players (for hit detection)
PhysicsService:CollisionGroupSetCollidable("Projectiles", "Players", true)

-- Assign player characters to the Players collision group
local function assignCollisionGroup(character)
	for _, part in ipairs(character:GetDescendants()) do
		if part:IsA("BasePart") then
			part.CollisionGroup = "Players"
		end
	end

	character.DescendantAdded:Connect(function(descendant)
		if descendant:IsA("BasePart") then
			descendant.CollisionGroup = "Players"
		end
	end)
end

Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(assignCollisionGroup)
	if player.Character then
		assignCollisionGroup(player.Character)
	end
end)

print("CollisionGroupSetup loaded — Players and Projectiles groups configured")
`;

const BATTLEGROUNDS_COMBATMANAGER_SERVER_LUAU = `
-- CombatManager: handles abilities, damage, and combat mechanics
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local BattleConfig = require(ReplicatedStorage:WaitForChild("BattleConfig"))
local RateLimit = require(ReplicatedStorage:WaitForChild("RateLimit"))

-- Remote events
local useAbility = Instance.new("RemoteEvent")
useAbility.Name = "UseAbility"
useAbility.Parent = ReplicatedStorage

local selectClassEvent = Instance.new("RemoteEvent")
selectClassEvent.Name = "SelectClass"
selectClassEvent.Parent = ReplicatedStorage

local playerStatsEvent = Instance.new("RemoteEvent")
playerStatsEvent.Name = "PlayerStats"
playerStatsEvent.Parent = ReplicatedStorage

local damageEvent = Instance.new("RemoteEvent")
damageEvent.Name = "DamageEvent"
damageEvent.Parent = ReplicatedStorage

local killFeedEvent = Instance.new("RemoteEvent")
killFeedEvent.Name = "KillFeed"
killFeedEvent.Parent = ReplicatedStorage

-- Player state
local playerState = {}
local cooldowns = {}

local function getAbilityConfig(abilityName)
	for _, ability in ipairs(BattleConfig.Abilities) do
		if ability.Name == abilityName then
			return ability
		end
	end
	return nil
end

local function getClassConfig(className)
	for _, class in ipairs(BattleConfig.Classes) do
		if class.Name == className then
			return class
		end
	end
	return nil
end

local function initPlayer(player)
	playerState[player] = {
		class = "Warrior",
		kills = 0,
		deaths = 0,
		assists = 0,
		coins = 0,
		inMatch = false,
	}
	cooldowns[player] = {}
end

local function applyClassStats(player)
	local state = playerState[player]
	if not state then return end

	local classConfig = getClassConfig(state.class)
	if not classConfig then return end

	local character = player.Character
	if not character then return end

	local humanoid = character:FindFirstChild("Humanoid")
	if humanoid then
		humanoid.MaxHealth = classConfig.Health
		humanoid.Health = classConfig.Health
		humanoid.WalkSpeed = classConfig.Speed
		humanoid.JumpPower = BattleConfig.JumpPower
	end
end

-- Handle class selection
selectClassEvent.OnServerEvent:Connect(function(player, className)
	if not RateLimit.check(player, "class_select", 1) then return end
	local state = playerState[player]
	if not state then return end

	local classConfig = getClassConfig(className)
	if not classConfig then
		selectClassEvent:FireClient(player, { type = "error", message = "Unknown class: " .. tostring(className) })
		return
	end

	state.class = className
	applyClassStats(player)

	selectClassEvent:FireClient(player, {
		type = "class_selected",
		class = className,
		health = classConfig.Health,
		speed = classConfig.Speed,
		abilities = classConfig.Abilities,
	})

	-- Broadcast updated stats
	playerStatsEvent:FireAllClients(player.Name, {
		class = className,
		kills = state.kills,
		deaths = state.deaths,
	})
end)

-- Leaderstats (visible on player list)
local function setupLeaderstats(player)
	local folder = Instance.new("Folder")
	folder.Name = "leaderstats"
	folder.Parent = player

	local kills = Instance.new("IntValue")
	kills.Name = "Kills"
	kills.Value = 0
	kills.Parent = folder

	local deaths = Instance.new("IntValue")
	deaths.Name = "Deaths"
	deaths.Value = 0
	deaths.Parent = folder

	local classVal = Instance.new("StringValue")
	classVal.Name = "Class"
	classVal.Value = "Warrior"
	classVal.Parent = folder
end

local function updateLeaderstats(player)
	local state = playerState[player]
	if not state then return end
	local stats = player:FindFirstChild("leaderstats")
	if not stats then return end
	local killsVal = stats:FindFirstChild("Kills")
	if killsVal then killsVal.Value = state.kills end
	local deathsVal = stats:FindFirstChild("Deaths")
	if deathsVal then deathsVal.Value = state.deaths end
	local classVal = stats:FindFirstChild("Class")
	if classVal then classVal.Value = state.class end
end

-- Handle ability usage
useAbility.OnServerEvent:Connect(function(player, abilityName, targetPosition)
	if not RateLimit.check(player, "ability", 0.1) then return end
	local state = playerState[player]
	if not state or not state.inMatch then return end

	local classConfig = getClassConfig(state.class)
	if not classConfig then return end

	-- Check if class has this ability
	local hasAbility = false
	for _, name in ipairs(classConfig.Abilities) do
		if name == abilityName then
			hasAbility = true
			break
		end
	end
	if not hasAbility then return end

	-- Check cooldown
	local now = tick()
	if cooldowns[player][abilityName] and now < cooldowns[player][abilityName] then
		return
	end

	local abilityConfig = getAbilityConfig(abilityName)
	if not abilityConfig then return end

	-- Set cooldown
	cooldowns[player][abilityName] = now + abilityConfig.Cooldown

	local character = player.Character
	if not character then return end
	local rootPart = character:FindFirstChild("HumanoidRootPart")
	if not rootPart then return end

	-- Create projectile or area effect
	if abilityConfig.Range > 15 then
		-- Ranged projectile
		local projectile = Instance.new("Part")
		projectile.Name = "Projectile_" .. abilityName
		projectile.Size = Vector3.new(2, 2, 2)
		projectile.Shape = Enum.PartType.Ball
		projectile.Color = abilityConfig.Color
		projectile.Material = Enum.Material.Neon
		projectile.Anchored = false
		projectile.CanCollide = false
		projectile.Position = rootPart.Position + rootPart.CFrame.LookVector * 3
		projectile.Parent = workspace

		local direction = (targetPosition - rootPart.Position).Unit
		local velocity = Instance.new("BodyVelocity")
		velocity.Velocity = direction * 80
		velocity.MaxForce = Vector3.new(math.huge, math.huge, math.huge)
		velocity.Parent = projectile

		-- Damage on hit
		projectile.Touched:Connect(function(hit)
			local hitCharacter = hit.Parent
			local hitPlayer = Players:GetPlayerFromCharacter(hitCharacter)
			if hitPlayer and hitPlayer ~= player then
				local humanoid = hitCharacter:FindFirstChild("Humanoid")
				if humanoid and humanoid.Health > 0 then
					humanoid:TakeDamage(abilityConfig.Damage)
					damageEvent:FireAllClients(hitPlayer, abilityConfig.Damage, abilityName)

					if humanoid.Health <= 0 then
						state.kills = state.kills + 1
						state.coins = state.coins + BattleConfig.KillReward
						local victimState = playerState[hitPlayer]
						if victimState then
							victimState.deaths = victimState.deaths + 1
						end
						killFeedEvent:FireAllClients(player.Name, hitPlayer.Name, abilityName)
					end
				end
				projectile:Destroy()
			end
		end)

		-- Auto-destroy after 3 seconds
		task.delay(3, function()
			if projectile and projectile.Parent then
				projectile:Destroy()
			end
		end)
	else
		-- Melee / area ability
		for _, otherPlayer in Players:GetPlayers() do
			if otherPlayer ~= player and playerState[otherPlayer] and playerState[otherPlayer].inMatch then
				local otherChar = otherPlayer.Character
				if otherChar then
					local otherRoot = otherChar:FindFirstChild("HumanoidRootPart")
					if otherRoot then
						local dist = (otherRoot.Position - rootPart.Position).Magnitude
						if dist <= abilityConfig.Range then
							local humanoid = otherChar:FindFirstChild("Humanoid")
							if humanoid then
								if abilityConfig.Damage < 0 then
									-- Heal
									humanoid.Health = math.min(humanoid.MaxHealth, humanoid.Health - abilityConfig.Damage)
								else
									humanoid:TakeDamage(abilityConfig.Damage)
									if humanoid.Health <= 0 then
										state.kills = state.kills + 1
										state.coins = state.coins + BattleConfig.KillReward
										killFeedEvent:FireAllClients(player.Name, otherPlayer.Name, abilityName)
									end
								end
							end
						end
					end
				end
			end
		end
	end
end)

-- Setup
Players.PlayerAdded:Connect(function(player)
	initPlayer(player)
	setupLeaderstats(player)
	player.CharacterAdded:Connect(function()
		task.wait(0.1)
		applyClassStats(player)
	end)
end)

Players.PlayerRemoving:Connect(function(player)
	playerState[player] = nil
	cooldowns[player] = nil
end)

for _, player in Players:GetPlayers() do
	initPlayer(player)
	setupLeaderstats(player)
end

-- Update leaderstats every 2 seconds
task.spawn(function()
	while true do
		task.wait(2)
		for _, player in Players:GetPlayers() do
			updateLeaderstats(player)
		end
	end
end)

print("CombatManager loaded")
`;

const BATTLEGROUNDS_DATAMANAGER_SERVER_LUAU = `
-- DataManager: saves and loads battlegrounds player stats
local DataStoreService = game:GetService("DataStoreService")

local MAX_RETRIES = 3
local function withRetry(fn, label)
	for attempt = 1, MAX_RETRIES do
		local success, result = pcall(fn)
		if success then return true, result end
		if attempt < MAX_RETRIES then
			local backoff = math.pow(2, attempt)
			warn(string.format("[DataManager] %s failed (attempt %d/%d): %s", label, attempt, MAX_RETRIES, tostring(result)))
			task.wait(backoff)
		else
			warn(string.format("[DataManager] %s failed after %d attempts: %s", label, MAX_RETRIES, tostring(result)))
			return false, result
		end
	end
	return false, "Max retries"
end
local Players = game:GetService("Players")

local battleStore = DataStoreService:GetDataStore("BattleData_v1")

local MAX_RETRIES = 3
local function withRetry(fn, label)
	for attempt = 1, MAX_RETRIES do
		local success, result = pcall(fn)
		if success then return true, result end
		if attempt < MAX_RETRIES then
			local backoff = math.pow(2, attempt)
			warn(string.format("[DataManager] %s failed (attempt %d/%d): %s", label, attempt, MAX_RETRIES, tostring(result)))
			task.wait(backoff)
		else
			warn(string.format("[DataManager] %s failed after %d attempts: %s", label, MAX_RETRIES, tostring(result)))
			return false, result
		end
	end
	return false, "Max retries"
end

local function loadPlayerData(player)
	local key = "user_" .. player.UserId
	local success, data = withRetry(function()
		return tycoonStore:GetAsync(key)
	end)

	if success and data then
		local folder = Instance.new("Folder")
		folder.Name = "BattleStats"
		folder.Parent = player

		for _, stat in ipairs({ "Kills", "Deaths", "Wins", "Coins" }) do
			local val = Instance.new("IntValue")
			val.Name = stat
			val.Value = data[stat:lower()] or 0
			val.Parent = folder
		end

		local className = Instance.new("StringValue")
		className.Name = "SelectedClass"
		className.Value = data.selectedClass or "Warrior"
		className.Parent = folder
	else
		local folder = Instance.new("Folder")
		folder.Name = "BattleStats"
		folder.Parent = player

		for _, stat in ipairs({ "Kills", "Deaths", "Wins", "Coins" }) do
			local val = Instance.new("IntValue")
			val.Name = stat
			val.Value = 0
			val.Parent = folder
		end

		local className = Instance.new("StringValue")
		className.Name = "SelectedClass"
		className.Value = "Warrior"
		className.Parent = folder
	end
end

local function savePlayerData(player)
	local key = "user_" .. player.UserId
	local folder = player:FindFirstChild("BattleStats")
	if not folder then return end

	local data = {
		kills = folder.Kills.Value,
		deaths = folder.Deaths.Value,
		wins = folder.Wins.Value,
		coins = folder.Coins.Value,
		selectedClass = folder.SelectedClass.Value,
	}

	pcall(function()
		battleStore:SetAsync(key, data)
	end)
end

Players.PlayerAdded:Connect(loadPlayerData)
Players.PlayerRemoving:Connect(savePlayerData)

task.spawn(function()
	while true do
		task.wait(300)
		for _, player in Players:GetPlayers() do
			savePlayerData(player)
		end
	end
end)

game:BindToClose(function()
	for _, player in Players:GetPlayers() do
		savePlayerData(player)
	end
end)

print("DataManager loaded")
`;

const BATTLEGROUNDS_MATCHMANAGER_SERVER_LUAU = `
-- MatchManager: handles matchmaking, rounds, and win conditions
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local BattleConfig = require(ReplicatedStorage:WaitForChild("BattleConfig"))

local matchEvent = Instance.new("RemoteEvent")
matchEvent.Name = "MatchEvent"
matchEvent.Parent = ReplicatedStorage

local queue = {}
local activeMatch = nil

local function addToQueue(player)
	if table.find(queue, player) then return end
	table.insert(queue, player)
	matchEvent:FireClient(player, { status = "queued", position = #queue })

	if #queue >= 2 then
		startMatch()
	end
end

local function removeFromQueue(player)
	local idx = table.find(queue, player)
	if idx then
		table.remove(queue, idx)
	end
end

function startMatch()
	if activeMatch then return end

	local matchPlayers = {}
	local count = math.min(#queue, BattleConfig.MaxPlayersPerMatch)
	for i = 1, count do
		table.insert(matchPlayers, table.remove(queue, 1))
	end

	activeMatch = {
		players = matchPlayers,
		startTime = tick(),
		scores = {},
	}

	for _, player in ipairs(matchPlayers) do
		activeMatch.scores[player] = 0
		matchEvent:FireClient(player, { status = "started", duration = BattleConfig.RoundDuration })

		-- Teleport to arena
		local character = player.Character
		if character then
			local rootPart = character:FindFirstChild("HumanoidRootPart")
			if rootPart then
				local offset = Vector3.new(math.random(-20, 20), 5, math.random(-20, 20))
				rootPart.CFrame = CFrame.new(Vector3.new(0, 5, -120) + offset)
			end
		end
	end

	-- Round timer
	task.spawn(function()
		task.wait(BattleConfig.RoundDuration)
		endMatch()
	end)

	print("Match started with " .. #matchPlayers .. " players")
end

function endMatch()
	if not activeMatch then return end

	-- Find winner (most kills)
	local winner = nil
	local bestScore = -1
	for _, player in ipairs(activeMatch.players) do
		local score = activeMatch.scores[player] or 0
		if score > bestScore then
			bestScore = score
			winner = player
		end
	end

	for _, player in ipairs(activeMatch.players) do
		local isWinner = player == winner
		matchEvent:FireClient(player, {
			status = "ended",
			winner = winner and winner.Name or "Draw",
			isWinner = isWinner,
			reward = isWinner and BattleConfig.WinReward or 0,
		})

		-- Teleport back to lobby
		local character = player.Character
		if character then
			local rootPart = character:FindFirstChild("HumanoidRootPart")
			if rootPart then
				rootPart.CFrame = CFrame.new(0, 5, 0)
			end
		end
	end

	if winner then
		print(winner.Name .. " won the match!")
	end

	activeMatch = nil
end

-- Queue pad handling
local CollectionService = game:GetService("CollectionService")
for _, pad in CollectionService:GetTagged("QueuePad") do
	pad.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if player then
			addToQueue(player)
		end
	end)
end

-- Cleanup
Players.PlayerRemoving:Connect(function(player)
	removeFromQueue(player)
	if activeMatch then
		local idx = table.find(activeMatch.players, player)
		if idx then
			table.remove(activeMatch.players, idx)
		end
		if #activeMatch.players < 2 then
			endMatch()
		end
	end
end)

print("MatchManager loaded")
`;

const BATTLEGROUNDS_BATTLECONFIG_LUAU = `
local BattleConfig = {}

BattleConfig.MaxPlayersPerMatch = 8
BattleConfig.RoundDuration = 120
BattleConfig.RespawnTime = 5
BattleConfig.StartingHealth = 100
BattleConfig.WalkSpeed = 16
BattleConfig.JumpPower = 50

BattleConfig.Abilities = {
	{
		Name = "Fireball",
		Damage = 25,
		Cooldown = 3,
		Range = 60,
		Color = Color3.fromRGB(255, 80, 20),
		Description = "Launch a fireball that explodes on impact",
	},
	{
		Name = "Ice Shard",
		Damage = 15,
		Cooldown = 1.5,
		Range = 45,
		Color = Color3.fromRGB(100, 200, 255),
		Description = "Throw a fast ice shard that slows enemies",
	},
	{
		Name = "Thunder Strike",
		Damage = 40,
		Cooldown = 6,
		Range = 30,
		Color = Color3.fromRGB(255, 255, 100),
		Description = "Call down lightning on a target area",
	},
	{
		Name = "Shield Bash",
		Damage = 20,
		Cooldown = 4,
		Range = 10,
		Color = Color3.fromRGB(180, 180, 220),
		Description = "Dash forward with a shield, knockback enemies",
	},
	{
		Name = "Heal Pulse",
		Damage = -30,
		Cooldown = 8,
		Range = 20,
		Color = Color3.fromRGB(80, 255, 120),
		Description = "Heal yourself and nearby allies",
	},
}

BattleConfig.Classes = {
	{
		Name = "Warrior",
		Health = 150,
		Speed = 14,
		Abilities = { "Shield Bash", "Fireball" },
		Description = "Tanky melee fighter with high health",
	},
	{
		Name = "Mage",
		Health = 80,
		Speed = 18,
		Abilities = { "Fireball", "Ice Shard", "Thunder Strike" },
		Description = "Ranged glass cannon with powerful spells",
	},
	{
		Name = "Healer",
		Health = 100,
		Speed = 16,
		Abilities = { "Heal Pulse", "Ice Shard" },
		Description = "Support class that heals allies and slows enemies",
	},
	{
		Name = "Assassin",
		Health = 75,
		Speed = 22,
		Abilities = { "Ice Shard", "Shield Bash" },
		Description = "Fast and deadly, strikes hard then vanishes",
	},
}

BattleConfig.Arenas = {
	{
		Name = "Grassy Plains",
		Size = Vector3.new(100, 1, 100),
		Theme = "outdoor",
	},
	{
		Name = "Lava Pit",
		Size = Vector3.new(80, 1, 80),
		Theme = "lava",
	},
}

BattleConfig.KillReward = 25
BattleConfig.WinReward = 100
BattleConfig.AssistReward = 10

return BattleConfig
`;

export function getBattlegroundsScripts(): ScriptFile[] {
  return [
    { relativePath: "src/client/BattleUI.client.luau", name: "BattleUI", scriptType: "client", content: BATTLEGROUNDS_BATTLEUI_CLIENT_LUAU },
    { relativePath: "src/server/CollisionGroupSetup.server.luau", name: "CollisionGroupSetup", scriptType: "server", content: BATTLEGROUNDS_COLLISIONGROUPSETUP_SERVER_LUAU },
    { relativePath: "src/server/CombatManager.server.luau", name: "CombatManager", scriptType: "server", content: BATTLEGROUNDS_COMBATMANAGER_SERVER_LUAU },
    { relativePath: "src/server/DataManager.server.luau", name: "DataManager", scriptType: "server", content: BATTLEGROUNDS_DATAMANAGER_SERVER_LUAU },
    { relativePath: "src/server/MatchManager.server.luau", name: "MatchManager", scriptType: "server", content: BATTLEGROUNDS_MATCHMANAGER_SERVER_LUAU },
    { relativePath: "src/server/PlatformBehaviors.server.luau", name: "PlatformBehaviors", scriptType: "server", content: PLATFORM_BEHAVIORS },
    { relativePath: "src/shared/BattleConfig.luau", name: "BattleConfig", scriptType: "module", content: BATTLEGROUNDS_BATTLECONFIG_LUAU },
    { relativePath: "src/shared/RateLimit.luau", name: "RateLimit", scriptType: "module", content: RATE_LIMIT },
  ];
}

// ── Rpg Template Scripts ──

const RPG_RPGUI_CLIENT_LUAU = `
-- RPGUI: client-side HUD for RPG game
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "RPGHUD"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Stats panel (top left)
local statsFrame = Instance.new("Frame")
statsFrame.Name = "StatsFrame"
statsFrame.Size = UDim2.new(0, 200, 0, 100)
statsFrame.Position = UDim2.new(0, 12, 0, 12)
statsFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
statsFrame.BackgroundTransparency = 0.15
statsFrame.BorderSizePixel = 0
statsFrame.Parent = screenGui

local statsCorner = Instance.new("UICorner")
statsCorner.CornerRadius = UDim.new(0, 12)
statsCorner.Parent = statsFrame

local levelLabel = Instance.new("TextLabel")
levelLabel.Name = "Level"
levelLabel.Size = UDim2.new(1, -16, 0, 24)
levelLabel.Position = UDim2.new(0, 8, 0, 8)
levelLabel.BackgroundTransparency = 1
levelLabel.Text = "Level 1"
levelLabel.TextColor3 = Color3.fromRGB(255, 220, 100)
levelLabel.TextSize = 18
levelLabel.Font = Enum.Font.GothamBold
levelLabel.TextXAlignment = Enum.TextXAlignment.Left
levelLabel.Parent = statsFrame

local xpFrame = Instance.new("Frame")
xpFrame.Name = "XPBar"
xpFrame.Size = UDim2.new(1, -16, 0, 8)
xpFrame.Position = UDim2.new(0, 8, 0, 36)
xpFrame.BackgroundColor3 = Color3.fromRGB(40, 40, 60)
xpFrame.BorderSizePixel = 0
xpFrame.Parent = statsFrame

local xpBarCorner = Instance.new("UICorner")
xpBarCorner.CornerRadius = UDim.new(0, 4)
xpBarCorner.Parent = xpFrame

local xpFill = Instance.new("Frame")
xpFill.Name = "Fill"
xpFill.Size = UDim2.new(0, 0, 1, 0)
xpFill.BackgroundColor3 = Color3.fromRGB(100, 200, 255)
xpFill.BorderSizePixel = 0
xpFill.Parent = xpFrame

local xpFillCorner = Instance.new("UICorner")
xpFillCorner.CornerRadius = UDim.new(0, 4)
xpFillCorner.Parent = xpFill

local goldLabel = Instance.new("TextLabel")
goldLabel.Name = "Gold"
goldLabel.Size = UDim2.new(1, -16, 0, 20)
goldLabel.Position = UDim2.new(0, 8, 0, 52)
goldLabel.BackgroundTransparency = 1
goldLabel.Text = "Gold: 0"
goldLabel.TextColor3 = Color3.fromRGB(255, 200, 50)
goldLabel.TextSize = 14
goldLabel.Font = Enum.Font.GothamBold
goldLabel.TextXAlignment = Enum.TextXAlignment.Left
goldLabel.Parent = statsFrame

local xpLabel = Instance.new("TextLabel")
xpLabel.Name = "XPText"
xpLabel.Size = UDim2.new(1, -16, 0, 20)
xpLabel.Position = UDim2.new(0, 8, 0, 72)
xpLabel.BackgroundTransparency = 1
xpLabel.Text = "XP: 0 / 100"
xpLabel.TextColor3 = Color3.fromRGB(100, 200, 255)
xpLabel.TextSize = 12
xpLabel.Font = Enum.Font.Gotham
xpLabel.TextXAlignment = Enum.TextXAlignment.Left
xpLabel.Parent = statsFrame

-- Quest tracker (right side)
local questFrame = Instance.new("Frame")
questFrame.Name = "QuestTracker"
questFrame.Size = UDim2.new(0, 220, 0, 150)
questFrame.Position = UDim2.new(1, -232, 0, 12)
questFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
questFrame.BackgroundTransparency = 0.15
questFrame.BorderSizePixel = 0
questFrame.Parent = screenGui

local questCorner = Instance.new("UICorner")
questCorner.CornerRadius = UDim.new(0, 12)
questCorner.Parent = questFrame

local questTitle = Instance.new("TextLabel")
questTitle.Size = UDim2.new(1, 0, 0, 28)
questTitle.BackgroundTransparency = 1
questTitle.Text = "  Active Quests"
questTitle.TextColor3 = Color3.fromRGB(200, 180, 255)
questTitle.TextSize = 14
questTitle.Font = Enum.Font.GothamBold
questTitle.TextXAlignment = Enum.TextXAlignment.Left
questTitle.Parent = questFrame

-- Update stats display
local function updateDisplay()
	local level = player:FindFirstChild("Level")
	local xp = player:FindFirstChild("XP")
	local gold = player:FindFirstChild("Gold")

	if level then
		levelLabel.Text = "Level " .. level.Value
	end
	if gold then
		goldLabel.Text = "Gold: " .. gold.Value
	end
	if xp and level then
		local xpNeeded = math.floor(100 * math.pow(1.5, (level.Value or 1) - 1))
		xpLabel.Text = "XP: " .. xp.Value .. " / " .. xpNeeded
		local pct = math.clamp(xp.Value / math.max(xpNeeded, 1), 0, 1)
		xpFill.Size = UDim2.new(pct, 0, 1, 0)
	end
end

-- Poll for stat updates
task.spawn(function()
	while true do
		task.wait(0.5)
		updateDisplay()
	end
end)

-- Handle click-to-attack enemies
local attackEvent = ReplicatedStorage:WaitForChild("AttackEnemy")
local mouse = player:GetMouse()

mouse.Button1Down:Connect(function()
	local target = mouse.Target
	if target and game:GetService("CollectionService"):HasTag(target, "Enemy") then
		attackEvent:FireServer(target)
	end
end)

-- Listen for loot drops
local lootEvent = ReplicatedStorage:WaitForChild("LootDrop")
lootEvent.OnClientEvent:Connect(function(data)
	-- Show floating loot text
	local label = Instance.new("TextLabel")
	label.Size = UDim2.new(0, 200, 0, 30)
	label.Position = UDim2.new(0.5, -100, 0.4, 0)
	label.BackgroundTransparency = 1
	label.Text = "+" .. data.xp .. " XP  +" .. data.gold .. " Gold"
	label.TextColor3 = Color3.fromRGB(255, 220, 100)
	label.TextSize = 16
	label.Font = Enum.Font.GothamBold
	label.Parent = screenGui

	task.spawn(function()
		for i = 0, 1, 0.02 do
			label.Position = UDim2.new(0.5, -100, 0.4 - i * 0.05, 0)
			label.TextTransparency = i
			task.wait(0.02)
		end
		label:Destroy()
	end)
end)

print("RPGUI loaded")
`;

const RPG_COMBATMANAGER_SERVER_LUAU = `
-- CombatManager: handles enemy spawning, AI, combat, and loot drops
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local RPGConfig = require(ReplicatedStorage:WaitForChild("RPGConfig"))

-- Remote events
local attackEvent = Instance.new("RemoteEvent")
attackEvent.Name = "AttackEnemy"
attackEvent.Parent = ReplicatedStorage

local enemyUpdate = Instance.new("RemoteEvent")
enemyUpdate.Name = "EnemyUpdate"
enemyUpdate.Parent = ReplicatedStorage

local lootEvent = Instance.new("RemoteEvent")
lootEvent.Name = "LootDrop"
lootEvent.Parent = ReplicatedStorage

-- Active enemies
local enemies = {}

local function getEnemyConfig(enemyName)
	for _, e in ipairs(RPGConfig.Enemies) do
		if e.Name == enemyName then
			return e
		end
	end
	return nil
end

local function getPlayerDamage(player)
	local baseDmg = RPGConfig.Stats.BaseDamage
	local level = 1
	local lvl = player:FindFirstChild("Level")
	if lvl then level = lvl.Value end
	local dmgPerLevel = RPGConfig.Stats.DamagePerLevel
	return baseDmg + (level - 1) * dmgPerLevel
end

local function spawnEnemy(spawnPoint, enemyName)
	local config = getEnemyConfig(enemyName)
	if not config then return end

	local enemy = Instance.new("Part")
	enemy.Name = enemyName
	enemy.Size = config.Size
	enemy.Position = spawnPoint.Position + Vector3.new(0, config.Size.Y / 2, 0)
	enemy.Color = config.Color
	enemy.Material = Enum.Material.Neon
	enemy.Anchored = true
	enemy.CanCollide = true
	enemy.Parent = workspace

	CollectionService:AddTag(enemy, "Enemy")
	CollectionService:AddTag(enemy, enemyName)

	local healthVal = Instance.new("NumberValue")
	healthVal.Name = "Health"
	healthVal.Value = config.Health
	healthVal.Parent = enemy

	local maxHealthVal = Instance.new("NumberValue")
	maxHealthVal.Name = "MaxHealth"
	maxHealthVal.Value = config.Health
	maxHealthVal.Parent = enemy

	enemies[enemy] = {
		config = config,
		spawnPoint = spawnPoint,
		alive = true,
	}

	-- Health bar billboard
	local billboard = Instance.new("BillboardGui")
	billboard.Size = UDim2.new(4, 0, 0.5, 0)
	billboard.StudsOffset = Vector3.new(0, config.Size.Y / 2 + 1, 0)
	billboard.AlwaysOnTop = true
	billboard.Parent = enemy

	local bg = Instance.new("Frame")
	bg.Size = UDim2.new(1, 0, 1, 0)
	bg.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
	bg.BorderSizePixel = 0
	bg.Parent = billboard

	local bar = Instance.new("Frame")
	bar.Name = "Bar"
	bar.Size = UDim2.new(1, -2, 1, -2)
	bar.Position = UDim2.new(0, 1, 0, 1)
	bar.BackgroundColor3 = Color3.fromRGB(220, 50, 50)
	bar.BorderSizePixel = 0
	bar.Parent = bg

	local nameLabel = Instance.new("TextLabel")
	nameLabel.Size = UDim2.new(1, 0, 1, 0)
	nameLabel.BackgroundTransparency = 1
	nameLabel.Text = config.Name .. " Lv." .. config.Level
	nameLabel.TextColor3 = Color3.new(1, 1, 1)
	nameLabel.TextSize = 14
	nameLabel.Font = Enum.Font.GothamBold
	nameLabel.Parent = billboard

	return enemy
end

-- Handle player attacks
attackEvent.OnServerEvent:Connect(function(player, enemyInstance)
	if not enemyInstance or not enemyInstance:IsA("BasePart") then return end
	if not CollectionService:HasTag(enemyInstance, "Enemy") then return end

	local data = enemies[enemyInstance]
	if not data or not data.alive then return end

	local health = enemyInstance:FindFirstChild("Health")
	if not health then return end

	-- Calculate damage
	local damage = getPlayerDamage(player)
	health.Value = health.Value - damage

	-- Update health bar
	local maxHealth = enemyInstance:FindFirstChild("MaxHealth")
	if maxHealth then
		local billboard = enemyInstance:FindFirstChildOfClass("BillboardGui")
		if billboard then
			local bg = billboard:FindFirstChild("Frame")
			if bg then
				local bar = bg:FindFirstChild("Bar")
				if bar then
					bar.Size = UDim2.new(math.max(health.Value / maxHealth.Value, 0), -2, 1, -2)
				end
			end
		end
	end

	-- Damage number feedback
	enemyUpdate:FireClient(player, {
		enemy = enemyInstance,
		damage = damage,
		currentHealth = health.Value,
		maxHealth = maxHealth and maxHealth.Value or 100,
	})

	-- Check death
	if health.Value <= 0 then
		data.alive = false

		-- Grant XP and gold
		local xp = player:FindFirstChild("XP")
		if xp then xp.Value = xp.Value + data.config.XPDrop end

		local gold = player:FindFirstChild("Gold")
		if gold then gold.Value = gold.Value + data.config.GoldDrop end

		-- Check level up
		checkLevelUp(player)

		-- Track quest progress
		local trackKill = game.ServerScriptService:FindFirstChild("QuestManager")
			and game.ServerScriptService.QuestManager:FindFirstChild("TrackKill")
		if trackKill then
			trackKill:Fire(player, data.config.Name)
		end

		lootEvent:FireClient(player, {
			enemyName = data.config.Name,
			xp = data.config.XPDrop,
			gold = data.config.GoldDrop,
		})

		-- Death effect
		task.spawn(function()
			for i = 0, 1, 0.1 do
				if enemyInstance and enemyInstance.Parent then
					enemyInstance.Transparency = i
					enemyInstance.Size = enemyInstance.Size * 0.95
				end
				task.wait(0.05)
			end
			if enemyInstance and enemyInstance.Parent then
				enemyInstance:Destroy()
			end
		end)

		-- Respawn after delay
		task.delay(data.config.RespawnTime, function()
			spawnEnemy(data.spawnPoint, data.config.Name)
		end)

		enemies[enemyInstance] = nil
	end
end)

function checkLevelUp(player)
	local xp = player:FindFirstChild("XP")
	local level = player:FindFirstChild("Level")
	if not xp or not level then return end

	local xpNeeded = RPGConfig.XPPerLevel * math.pow(RPGConfig.XPScaling, level.Value - 1)
	while xp.Value >= xpNeeded and level.Value < RPGConfig.MaxLevel do
		xp.Value = xp.Value - math.floor(xpNeeded)
		level.Value = level.Value + 1
		xpNeeded = RPGConfig.XPPerLevel * math.pow(RPGConfig.XPScaling, level.Value - 1)

		-- Update health
		local character = player.Character
		if character then
			local humanoid = character:FindFirstChild("Humanoid")
			if humanoid then
				local newMax = RPGConfig.Stats.BaseHealth + (level.Value - 1) * RPGConfig.Stats.HealthPerLevel
				humanoid.MaxHealth = newMax
				humanoid.Health = newMax
			end
		end

		print(player.Name .. " leveled up to " .. level.Value .. "!")
	end
end

-- Spawn initial enemies from tagged spawn points
for _, point in CollectionService:GetTagged("EnemySpawn") do
	for _, tag in ipairs(CollectionService:GetTags(point)) do
		if tag ~= "EnemySpawn" then
			spawnEnemy(point, tag)
			break
		end
	end
end

-- Player setup
Players.PlayerAdded:Connect(function(player)
	local level = Instance.new("IntValue")
	level.Name = "Level"
	level.Value = RPGConfig.StartingLevel
	level.Parent = player

	local xp = Instance.new("IntValue")
	xp.Name = "XP"
	xp.Value = RPGConfig.StartingXP
	xp.Parent = player

	local gold = Instance.new("IntValue")
	gold.Name = "Gold"
	gold.Value = RPGConfig.StartingGold
	gold.Parent = player

	player.CharacterAdded:Connect(function(character)
		task.wait(0.1)
		local humanoid = character:FindFirstChild("Humanoid")
		if humanoid then
			local hp = RPGConfig.Stats.BaseHealth + (level.Value - 1) * RPGConfig.Stats.HealthPerLevel
			humanoid.MaxHealth = hp
			humanoid.Health = hp
		end
	end)
end)

print("CombatManager loaded")
`;

const RPG_DATAMANAGER_SERVER_LUAU = `
-- DataManager: saves and loads RPG player data
local DataStoreService = game:GetService("DataStoreService")

local MAX_RETRIES = 3
local function withRetry(fn, label)
	for attempt = 1, MAX_RETRIES do
		local success, result = pcall(fn)
		if success then return true, result end
		if attempt < MAX_RETRIES then
			local backoff = math.pow(2, attempt)
			warn(string.format("[DataManager] %s failed (attempt %d/%d): %s", label, attempt, MAX_RETRIES, tostring(result)))
			task.wait(backoff)
		else
			warn(string.format("[DataManager] %s failed after %d attempts: %s", label, MAX_RETRIES, tostring(result)))
			return false, result
		end
	end
	return false, "Max retries"
end
local Players = game:GetService("Players")

local rpgStore = DataStoreService:GetDataStore("RPGData_v1")

local MAX_RETRIES = 3
local function withRetry(fn, label)
	for attempt = 1, MAX_RETRIES do
		local success, result = pcall(fn)
		if success then return true, result end
		if attempt < MAX_RETRIES then
			local backoff = math.pow(2, attempt)
			warn(string.format("[DataManager] %s failed (attempt %d/%d): %s", label, attempt, MAX_RETRIES, tostring(result)))
			task.wait(backoff)
		else
			warn(string.format("[DataManager] %s failed after %d attempts: %s", label, MAX_RETRIES, tostring(result)))
			return false, result
		end
	end
	return false, "Max retries"
end

local function savePlayerData(player)
	local key = "user_" .. player.UserId
	local level = player:FindFirstChild("Level")
	local xp = player:FindFirstChild("XP")
	local gold = player:FindFirstChild("Gold")

	local data = {
		level = level and level.Value or 1,
		xp = xp and xp.Value or 0,
		gold = gold and gold.Value or 0,
	}

	pcall(function()
		rpgStore:SetAsync(key, data)
	end)
end

local function loadPlayerData(player)
	local key = "user_" .. player.UserId
	local success, data = withRetry(function()
		return tycoonStore:GetAsync(key)
	end)

	if success and data then
		task.defer(function()
			local level = player:FindFirstChild("Level")
			if level then level.Value = data.level or 1 end
			local xp = player:FindFirstChild("XP")
			if xp then xp.Value = data.xp or 0 end
			local gold = player:FindFirstChild("Gold")
			if gold then gold.Value = data.gold or 0 end
		end)
	end
end


-- Leaderstats
local function setupLeaderstats(player)
	local folder = Instance.new("Folder")
	folder.Name = "leaderstats"
	folder.Parent = player
	local level = Instance.new("IntValue")
	level.Name = "Level"
	level.Value = 1
	level.Parent = folder
	local gold = Instance.new("IntValue")
	gold.Name = "Gold"
	gold.Value = 0
	gold.Parent = folder
end

Players.PlayerAdded:Connect(function(player)
	task.defer(function()
		loadPlayerData(player)
	end)
end)

Players.PlayerRemoving:Connect(savePlayerData)

task.spawn(function()
	while true do
		task.wait(300)
		for _, player in Players:GetPlayers() do
			savePlayerData(player)
		end
	end
end)

game:BindToClose(function()
	for _, player in Players:GetPlayers() do
		savePlayerData(player)
	end
end)

print("DataManager loaded")
`;

const RPG_ENEMYAI_SERVER_LUAU = `
--[[
	EnemyAI.server.luau
	Drives enemy NPCs using CollectionService tags and PathfindingService.

	Tag: "Enemy"
	Reads Attributes:
	  AIBehavior (string)   — "chase", "patrol", "wander", "stationary" (default: "chase")
	  WalkSpeed (number)    — movement speed (default: 12)
	  AttackRange (number)  — studs to start attacking (default: 5)
	  AttackDamage (number) — damage per hit (default: 10)
	  AttackCooldown (number) — seconds between attacks (default: 1)
	  AggroRange (number)   — studs to detect player (default: 40)
	  MaxHealth (number)    — enemy health (default: 100)
	  RespawnTime (number)  — seconds to respawn (default: 10)
]]

local CollectionService = game:GetService("CollectionService")
local PathfindingService = game:GetService("PathfindingService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local function getAttr(inst: Instance, name: string, default: any): any
	local val = inst:GetAttribute(name)
	return if val ~= nil then val else default
end

--- Convert a tagged Part into a proper NPC Model with Humanoid.
local function makeNPCModel(part: BasePart): Model
	-- If already a Model parent with Humanoid, use it
	if part.Parent and part.Parent:IsA("Model") and part.Parent:FindFirstChildOfClass("Humanoid") then
		return part.Parent :: Model
	end

	-- Build an NPC model from the part
	local model = Instance.new("Model")
	model.Name = part.Name

	-- Create torso (the original part becomes it)
	part.Name = "HumanoidRootPart"
	part.Anchored = false
	part.CanCollide = true

	-- Ensure minimum size for a character
	if part.Size.Y < 4 then
		part.Size = Vector3.new(math.max(part.Size.X, 2), 5, math.max(part.Size.Z, 2))
	end

	local humanoid = Instance.new("Humanoid")
	humanoid.MaxHealth = getAttr(part, "MaxHealth", 100)
	humanoid.Health = humanoid.MaxHealth
	humanoid.WalkSpeed = getAttr(part, "WalkSpeed", 12)
	humanoid.Parent = model

	local parent = part.Parent
	local spawnCFrame = part.CFrame

	part.Parent = model
	model.PrimaryPart = part
	model.Parent = parent

	-- Store spawn position for respawn
	model:SetAttribute("SpawnCFrame", spawnCFrame)

	return model
end

--- Find the nearest player character within range.
local function findNearestPlayer(position: Vector3, range: number): (Model?, number)
	local nearest: Model? = nil
	local nearestDist = range

	for _, player in Players:GetPlayers() do
		local character = player.Character
		if not character then continue end
		local hrp = character:FindFirstChild("HumanoidRootPart") :: BasePart?
		if not hrp then continue end
		local humanoid = character:FindFirstChildOfClass("Humanoid")
		if not humanoid or humanoid.Health <= 0 then continue end

		local dist = (hrp.Position - position).Magnitude
		if dist < nearestDist then
			nearest = character
			nearestDist = dist
		end
	end

	return nearest, nearestDist
end

--- Move to a position using PathfindingService.
local function moveTo(model: Model, humanoid: Humanoid, target: Vector3)
	local hrp = model.PrimaryPart
	if not hrp then return end

	local path = PathfindingService:CreatePath({
		AgentRadius = 2,
		AgentHeight = 5,
		AgentCanJump = true,
		AgentCanClimb = false,
	})

	local success, _ = pcall(function()
		path:ComputeAsync(hrp.Position, target)
	end)

	if not success or path.Status ~= Enum.PathStatus.Success then
		-- Fallback: direct movement
		humanoid:MoveTo(target)
		return
	end

	local waypoints = path:GetWaypoints()
	for _, waypoint in waypoints do
		if not hrp.Parent then return end
		humanoid:MoveTo(waypoint.Position)
		if waypoint.Action == Enum.PathWaypointAction.Jump then
			humanoid.Jump = true
		end
		-- Wait for movement to complete or timeout
		local reached = humanoid.MoveToFinished:Wait()
		if not reached then break end
	end
end

--- Attack a target character.
local function attackTarget(model: Model, target: Model, damage: number)
	local targetHumanoid = target:FindFirstChildOfClass("Humanoid")
	if targetHumanoid and targetHumanoid.Health > 0 then
		targetHumanoid:TakeDamage(damage)
	end
end

--- Run the AI loop for a single enemy.
local function runEnemyAI(part: BasePart)
	local model = makeNPCModel(part)
	local humanoid = model:FindFirstChildOfClass("Humanoid")
	if not humanoid then return end

	local behavior = getAttr(part, "AIBehavior", "chase")
	local attackRange = getAttr(part, "AttackRange", 5)
	local attackDamage = getAttr(part, "AttackDamage", 10)
	local attackCooldown = getAttr(part, "AttackCooldown", 1)
	local aggroRange = getAttr(part, "AggroRange", 40)
	local respawnTime = getAttr(part, "RespawnTime", 10)
	local spawnCFrame = model:GetAttribute("SpawnCFrame") or (model.PrimaryPart and model.PrimaryPart.CFrame)

	local lastAttackTime = 0
	local patrolTarget: Vector3? = nil

	-- Handle death → respawn
	humanoid.Died:Connect(function()
		task.wait(respawnTime)
		-- Respawn: restore health, teleport back
		if model.PrimaryPart then
			humanoid.Health = humanoid.MaxHealth
			model.PrimaryPart.CFrame = spawnCFrame or CFrame.new(0, 10, 0)
		end
	end)

	-- Main AI loop
	while model.Parent and humanoid.Health > 0 do
		local hrp = model.PrimaryPart
		if not hrp then task.wait(1) continue end

		if behavior == "stationary" then
			-- Just stand and attack if player is in range
			local target, dist = findNearestPlayer(hrp.Position, attackRange)
			if target and tick() - lastAttackTime >= attackCooldown then
				attackTarget(model, target, attackDamage)
				lastAttackTime = tick()
			end
			task.wait(0.5)

		elseif behavior == "chase" then
			local target, dist = findNearestPlayer(hrp.Position, aggroRange)
			if target then
				local targetHRP = target:FindFirstChild("HumanoidRootPart") :: BasePart?
				if targetHRP then
					if dist <= attackRange then
						-- In range — attack
						if tick() - lastAttackTime >= attackCooldown then
							attackTarget(model, target, attackDamage)
							lastAttackTime = tick()
						end
						humanoid:MoveTo(targetHRP.Position)
					else
						-- Chase using pathfinding
						moveTo(model, humanoid, targetHRP.Position)
					end
				end
			else
				-- No target — return to spawn
				if spawnCFrame then
					local distFromSpawn = (hrp.Position - spawnCFrame.Position).Magnitude
					if distFromSpawn > 5 then
						humanoid:MoveTo(spawnCFrame.Position)
						humanoid.MoveToFinished:Wait()
					end
				end
			end
			task.wait(0.3)

		elseif behavior == "patrol" then
			-- Pick random nearby point, walk to it, repeat
			if not patrolTarget or (hrp.Position - patrolTarget).Magnitude < 3 then
				local angle = math.random() * math.pi * 2
				local radius = math.random(10, 25)
				local origin = if spawnCFrame then spawnCFrame.Position else hrp.Position
				patrolTarget = origin + Vector3.new(
					math.cos(angle) * radius,
					0,
					math.sin(angle) * radius
				)
			end

			-- Check for aggro while patrolling
			local target, dist = findNearestPlayer(hrp.Position, aggroRange)
			if target then
				local targetHRP = target:FindFirstChild("HumanoidRootPart") :: BasePart?
				if targetHRP then
					if dist <= attackRange then
						if tick() - lastAttackTime >= attackCooldown then
							attackTarget(model, target, attackDamage)
							lastAttackTime = tick()
						end
					else
						moveTo(model, humanoid, targetHRP.Position)
					end
				end
			else
				humanoid:MoveTo(patrolTarget)
				humanoid.MoveToFinished:Wait()
			end
			task.wait(0.5)

		elseif behavior == "wander" then
			-- Random walking, no aggro
			local angle = math.random() * math.pi * 2
			local radius = math.random(5, 15)
			local origin = if spawnCFrame then spawnCFrame.Position else hrp.Position
			local wanderTarget = origin + Vector3.new(
				math.cos(angle) * radius,
				0,
				math.sin(angle) * radius
			)
			humanoid:MoveTo(wanderTarget)
			humanoid.MoveToFinished:Wait()
			task.wait(math.random(1, 3))
		end
	end
end

-- ── Initialize ──

for _, part in CollectionService:GetTagged("Enemy") do
	task.spawn(runEnemyAI, part)
end

CollectionService:GetInstanceAddedSignal("Enemy"):Connect(function(part)
	if part:IsA("BasePart") then
		task.spawn(runEnemyAI, part)
	end
end)
`;

const RPG_INVENTORYMANAGER_SERVER_LUAU = `
-- InventoryManager: handles item buying, equipping, and inventory
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local RPGConfig = require(ReplicatedStorage:WaitForChild("RPGConfig"))

local buyEvent = Instance.new("RemoteEvent")
buyEvent.Name = "BuyItem"
buyEvent.Parent = ReplicatedStorage

local equipEvent = Instance.new("RemoteEvent")
equipEvent.Name = "EquipItem"
equipEvent.Parent = ReplicatedStorage

local inventoryUpdate = Instance.new("RemoteEvent")
inventoryUpdate.Name = "InventoryUpdate"
inventoryUpdate.Parent = ReplicatedStorage

local playerInventories = {}

local function getInventory(player)
	if not playerInventories[player] then
		playerInventories[player] = {
			items = {},
			equipped = { weapon = nil, armor = nil },
		}
	end
	return playerInventories[player]
end

local function getItemConfig(itemName)
	for _, item in ipairs(RPGConfig.Items) do
		if item.Name == itemName then
			return item
		end
	end
	return nil
end

buyEvent.OnServerEvent:Connect(function(player, itemName)
	local config = getItemConfig(itemName)
	if not config then return end

	local level = player:FindFirstChild("Level")
	if level and level.Value < config.MinLevel then
		inventoryUpdate:FireClient(player, {
			type = "error",
			message = "You need level " .. config.MinLevel .. " for this item!",
		})
		return
	end

	local gold = player:FindFirstChild("Gold")
	if not gold or gold.Value < config.Cost then
		inventoryUpdate:FireClient(player, {
			type = "error",
			message = "Not enough gold! Need " .. config.Cost,
		})
		return
	end

	gold.Value = gold.Value - config.Cost

	local inv = getInventory(player)
	table.insert(inv.items, itemName)

	inventoryUpdate:FireClient(player, {
		type = "bought",
		item = itemName,
		itemType = config.Type,
		gold = gold.Value,
	})

	print(player.Name .. " bought " .. itemName)
end)

equipEvent.OnServerEvent:Connect(function(player, itemName)
	local config = getItemConfig(itemName)
	if not config then return end

	local inv = getInventory(player)
	local hasItem = false
	for _, name in ipairs(inv.items) do
		if name == itemName then
			hasItem = true
			break
		end
	end
	if not hasItem then return end

	if config.Type == "weapon" then
		inv.equipped.weapon = itemName
	elseif config.Type == "armor" then
		inv.equipped.armor = itemName
	elseif config.Type == "consumable" then
		-- Use consumable
		local character = player.Character
		if character then
			local humanoid = character:FindFirstChild("Humanoid")
			if humanoid and config.HealAmount then
				humanoid.Health = math.min(humanoid.MaxHealth, humanoid.Health + config.HealAmount)
			end
		end
		-- Remove from inventory
		for i, name in ipairs(inv.items) do
			if name == itemName then
				table.remove(inv.items, i)
				break
			end
		end
	end

	inventoryUpdate:FireClient(player, {
		type = "equipped",
		item = itemName,
		equipped = inv.equipped,
		items = inv.items,
	})
end)

Players.PlayerRemoving:Connect(function(player)
	playerInventories[player] = nil
end)

print("InventoryManager loaded")
`;

const RPG_QUESTMANAGER_SERVER_LUAU = `
-- QuestManager: handles quest tracking, completion, and rewards
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local RPGConfig = require(ReplicatedStorage:WaitForChild("RPGConfig"))

-- Remote events
local questEvent = Instance.new("RemoteEvent")
questEvent.Name = "QuestEvent"
questEvent.Parent = ReplicatedStorage

local acceptQuest = Instance.new("RemoteEvent")
acceptQuest.Name = "AcceptQuest"
acceptQuest.Parent = ReplicatedStorage

-- Player quest data
local playerQuests = {}

local function getPlayerQuests(player)
	if not playerQuests[player] then
		playerQuests[player] = {
			active = {},
			completed = {},
		}
	end
	return playerQuests[player]
end

local function getPlayerLevel(player)
	local lvl = player:FindFirstChild("Level")
	return lvl and lvl.Value or 1
end

-- Accept a quest
acceptQuest.OnServerEvent:Connect(function(player, questId)
	local quests = getPlayerQuests(player)
	local level = getPlayerLevel(player)

	-- Already active or completed?
	if quests.active[questId] or quests.completed[questId] then return end

	-- Find quest config
	local questConfig = nil
	for _, q in ipairs(RPGConfig.Quests) do
		if q.Id == questId then
			questConfig = q
			break
		end
	end
	if not questConfig then return end

	-- Level check
	if level < questConfig.MinLevel then
		questEvent:FireClient(player, {
			type = "error",
			message = "You need level " .. questConfig.MinLevel .. " for this quest!",
		})
		return
	end

	-- Accept
	quests.active[questId] = {
		config = questConfig,
		progress = 0,
	}

	questEvent:FireClient(player, {
		type = "accepted",
		questId = questId,
		name = questConfig.Name,
		description = questConfig.Description,
		target = questConfig.Amount,
		progress = 0,
	})

	print(player.Name .. " accepted quest: " .. questConfig.Name)
end)

-- Track kill progress
function trackKill(player, enemyName)
	local quests = getPlayerQuests(player)
	for questId, data in pairs(quests.active) do
		if data.config.Type == "kill" and data.config.Target == enemyName then
			data.progress = data.progress + 1
			questEvent:FireClient(player, {
				type = "progress",
				questId = questId,
				progress = data.progress,
				target = data.config.Amount,
			})

			if data.progress >= data.config.Amount then
				completeQuest(player, questId)
			end
		end
	end
end

-- Track zone exploration
function trackExplore(player, zoneName)
	local quests = getPlayerQuests(player)
	for questId, data in pairs(quests.active) do
		if data.config.Type == "explore" and data.config.Target == zoneName then
			data.progress = 1
			completeQuest(player, questId)
		end
	end
end

function completeQuest(player, questId)
	local quests = getPlayerQuests(player)
	local data = quests.active[questId]
	if not data then return end

	local config = data.config

	-- Grant rewards
	local gold = player:FindFirstChild("Gold")
	if gold then
		gold.Value = gold.Value + config.GoldReward
	end

	local xp = player:FindFirstChild("XP")
	if xp then
		xp.Value = xp.Value + config.XPReward
	end

	-- Mark complete
	quests.completed[questId] = true
	quests.active[questId] = nil

	questEvent:FireClient(player, {
		type = "completed",
		questId = questId,
		name = config.Name,
		xpReward = config.XPReward,
		goldReward = config.GoldReward,
	})

	print(player.Name .. " completed quest: " .. config.Name)
end

-- Expose for other scripts
local trackKillFunc = Instance.new("BindableEvent")
trackKillFunc.Name = "TrackKill"
trackKillFunc.Parent = script
trackKillFunc.Event:Connect(function(player, enemyName)
	trackKill(player, enemyName)
end)

local trackExploreFunc = Instance.new("BindableEvent")
trackExploreFunc.Name = "TrackExplore"
trackExploreFunc.Parent = script
trackExploreFunc.Event:Connect(function(player, zoneName)
	trackExplore(player, zoneName)
end)

-- Cleanup
Players.PlayerRemoving:Connect(function(player)
	playerQuests[player] = nil
end)

print("QuestManager loaded")
`;

const RPG_RPGCONFIG_LUAU = `
local RPGConfig = {}

RPGConfig.StartingLevel = 1
RPGConfig.StartingGold = 0
RPGConfig.StartingXP = 0
RPGConfig.XPPerLevel = 100
RPGConfig.XPScaling = 1.5
RPGConfig.MaxLevel = 50

RPGConfig.Stats = {
	BaseHealth = 100,
	BaseDamage = 10,
	BaseDefense = 5,
	BaseSpeed = 16,
	HealthPerLevel = 15,
	DamagePerLevel = 3,
	DefensePerLevel = 2,
}

RPGConfig.Quests = {
	{
		Id = "quest_slime_1",
		Name = "Slime Slayer",
		Description = "Defeat 5 slimes in the Starter Meadow",
		Type = "kill",
		Target = "Slime",
		Amount = 5,
		XPReward = 50,
		GoldReward = 25,
		MinLevel = 1,
	},
	{
		Id = "quest_explore_1",
		Name = "Explorer",
		Description = "Visit the Dark Forest zone",
		Type = "explore",
		Target = "DarkForest",
		Amount = 1,
		XPReward = 75,
		GoldReward = 40,
		MinLevel = 3,
	},
	{
		Id = "quest_boss_1",
		Name = "Boss Hunter",
		Description = "Defeat the Forest Guardian",
		Type = "kill",
		Target = "ForestGuardian",
		Amount = 1,
		XPReward = 200,
		GoldReward = 150,
		MinLevel = 5,
	},
}

RPGConfig.Enemies = {
	{
		Name = "Slime",
		Health = 30,
		Damage = 5,
		XPDrop = 15,
		GoldDrop = 5,
		Level = 1,
		Color = Color3.fromRGB(100, 255, 100),
		Size = Vector3.new(3, 3, 3),
		RespawnTime = 10,
	},
	{
		Name = "Goblin",
		Health = 60,
		Damage = 12,
		XPDrop = 30,
		GoldDrop = 12,
		Level = 3,
		Color = Color3.fromRGB(120, 180, 80),
		Size = Vector3.new(3, 5, 2),
		RespawnTime = 15,
	},
	{
		Name = "ForestGuardian",
		Health = 300,
		Damage = 25,
		XPDrop = 200,
		GoldDrop = 100,
		Level = 5,
		Color = Color3.fromRGB(60, 120, 60),
		Size = Vector3.new(6, 8, 6),
		RespawnTime = 60,
		IsBoss = true,
	},
}

RPGConfig.Items = {
	{
		Name = "Wooden Sword",
		Type = "weapon",
		DamageBonus = 5,
		Cost = 50,
		MinLevel = 1,
	},
	{
		Name = "Iron Sword",
		Type = "weapon",
		DamageBonus = 15,
		Cost = 200,
		MinLevel = 5,
	},
	{
		Name = "Leather Armor",
		Type = "armor",
		DefenseBonus = 5,
		Cost = 75,
		MinLevel = 1,
	},
	{
		Name = "Iron Armor",
		Type = "armor",
		DefenseBonus = 15,
		Cost = 300,
		MinLevel = 5,
	},
	{
		Name = "Health Potion",
		Type = "consumable",
		HealAmount = 50,
		Cost = 20,
		MinLevel = 1,
	},
}

RPGConfig.Zones = {
	{
		Name = "Starter Meadow",
		RequiredLevel = 1,
		Enemies = { "Slime" },
	},
	{
		Name = "Dark Forest",
		RequiredLevel = 3,
		Enemies = { "Goblin", "Slime" },
	},
	{
		Name = "Mountain Pass",
		RequiredLevel = 8,
		Enemies = { "Goblin", "ForestGuardian" },
	},
}

return RPGConfig
`;

export function getRpgScripts(): ScriptFile[] {
  return [
    { relativePath: "src/client/RPGUI.client.luau", name: "RPGUI", scriptType: "client", content: RPG_RPGUI_CLIENT_LUAU },
    { relativePath: "src/server/CombatManager.server.luau", name: "CombatManager", scriptType: "server", content: RPG_COMBATMANAGER_SERVER_LUAU },
    { relativePath: "src/server/DataManager.server.luau", name: "DataManager", scriptType: "server", content: RPG_DATAMANAGER_SERVER_LUAU },
    { relativePath: "src/server/EnemyAI.server.luau", name: "EnemyAI", scriptType: "server", content: RPG_ENEMYAI_SERVER_LUAU },
    { relativePath: "src/server/InventoryManager.server.luau", name: "InventoryManager", scriptType: "server", content: RPG_INVENTORYMANAGER_SERVER_LUAU },
    { relativePath: "src/server/PlatformBehaviors.server.luau", name: "PlatformBehaviors", scriptType: "server", content: PLATFORM_BEHAVIORS },
    { relativePath: "src/server/QuestManager.server.luau", name: "QuestManager", scriptType: "server", content: RPG_QUESTMANAGER_SERVER_LUAU },
    { relativePath: "src/shared/RPGConfig.luau", name: "RPGConfig", scriptType: "module", content: RPG_RPGCONFIG_LUAU },
    { relativePath: "src/shared/RateLimit.luau", name: "RateLimit", scriptType: "module", content: RATE_LIMIT },
  ];
}

// ── Horror Template Scripts ──

const HORROR_HORRORUI_CLIENT_LUAU = `
-- HorrorUI: client-side HUD for horror game
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local StarterPlayer = game:GetService("StarterPlayer")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- Force first-person camera for horror immersion
StarterPlayer.CameraMode = Enum.CameraMode.LockFirstPerson
player.CameraMode = Enum.CameraMode.LockFirstPerson
-- Narrow FOV for claustrophobic feel
workspace.CurrentCamera.FieldOfView = 65

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "HorrorHUD"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Battery indicator (top left)
local batteryFrame = Instance.new("Frame")
batteryFrame.Size = UDim2.new(0, 140, 0, 24)
batteryFrame.Position = UDim2.new(0, 12, 0, 12)
batteryFrame.BackgroundColor3 = Color3.fromRGB(15, 15, 20)
batteryFrame.BackgroundTransparency = 0.2
batteryFrame.BorderSizePixel = 0
batteryFrame.Parent = screenGui

local batteryBar = Instance.new("Frame")
batteryBar.Name = "Bar"
batteryBar.Size = UDim2.new(1, -4, 1, -4)
batteryBar.Position = UDim2.new(0, 2, 0, 2)
batteryBar.BackgroundColor3 = Color3.fromRGB(255, 220, 80)
batteryBar.BorderSizePixel = 0
batteryBar.Parent = batteryFrame

local batteryLabel = Instance.new("TextLabel")
batteryLabel.Size = UDim2.new(1, 0, 1, 0)
batteryLabel.BackgroundTransparency = 1
batteryLabel.Text = "Battery: 100%"
batteryLabel.TextColor3 = Color3.new(1, 1, 1)
batteryLabel.TextSize = 11
batteryLabel.Font = Enum.Font.GothamBold
batteryLabel.Parent = batteryFrame

-- Stamina bar (below battery)
local staminaFrame = Instance.new("Frame")
staminaFrame.Size = UDim2.new(0, 140, 0, 12)
staminaFrame.Position = UDim2.new(0, 12, 0, 42)
staminaFrame.BackgroundColor3 = Color3.fromRGB(15, 15, 20)
staminaFrame.BackgroundTransparency = 0.2
staminaFrame.BorderSizePixel = 0
staminaFrame.Parent = screenGui

local staminaBar = Instance.new("Frame")
staminaBar.Name = "Bar"
staminaBar.Size = UDim2.new(1, -4, 1, -4)
staminaBar.Position = UDim2.new(0, 2, 0, 2)
staminaBar.BackgroundColor3 = Color3.fromRGB(80, 200, 120)
staminaBar.BorderSizePixel = 0
staminaBar.Parent = staminaFrame

-- Vignette overlay for horror atmosphere
local vignette = Instance.new("ImageLabel")
vignette.Size = UDim2.new(1, 0, 1, 0)
vignette.BackgroundTransparency = 1
vignette.ImageTransparency = 0.4
vignette.Image = ""
vignette.ImageColor3 = Color3.new(0, 0, 0)
vignette.Parent = screenGui

-- Jumpscare overlay
local jumpscareFrame = Instance.new("Frame")
jumpscareFrame.Name = "Jumpscare"
jumpscareFrame.Size = UDim2.new(1, 0, 1, 0)
jumpscareFrame.BackgroundColor3 = Color3.new(0, 0, 0)
jumpscareFrame.BackgroundTransparency = 1
jumpscareFrame.Visible = false
jumpscareFrame.Parent = screenGui

-- Flashlight toggle (F key)
local toggleFlashlight = ReplicatedStorage:WaitForChild("ToggleFlashlight")
local toggleSprint = ReplicatedStorage:WaitForChild("ToggleSprint")

UserInputService.InputBegan:Connect(function(input, processed)
	if processed then return end
	if input.KeyCode == Enum.KeyCode.F then
		toggleFlashlight:FireServer()
	end
	if input.KeyCode == Enum.KeyCode.LeftShift then
		toggleSprint:FireServer(true)
	end
end)

UserInputService.InputEnded:Connect(function(input)
	if input.KeyCode == Enum.KeyCode.LeftShift then
		toggleSprint:FireServer(false)
	end
end)

-- Listen for horror events
local horrorEvent = ReplicatedStorage:WaitForChild("HorrorEvent")
horrorEvent.OnClientEvent:Connect(function(data)
	if data.type == "stats" then
		local bPct = (data.battery or 100) / 100
		batteryBar.Size = UDim2.new(bPct, -4, 1, -4)
		batteryBar.BackgroundColor3 = bPct > 0.3
			and Color3.fromRGB(255, 220, 80)
			or Color3.fromRGB(255, 80, 50)
		batteryLabel.Text = "Battery: " .. math.floor(data.battery) .. "%"

		local sPct = (data.stamina or 100) / 100
		staminaBar.Size = UDim2.new(sPct, -4, 1, -4)
	end

	if data.type == "jumpscare" then
		jumpscareFrame.Visible = true
		jumpscareFrame.BackgroundTransparency = 0
		task.spawn(function()
			for i = 0, 1, 0.05 do
				jumpscareFrame.BackgroundTransparency = i
				task.wait(0.02)
			end
			jumpscareFrame.Visible = false
		end)
	end
end)

print("HorrorUI loaded")
`;

const HORROR_DATAMANAGER_SERVER_LUAU = `
-- DataManager: saves horror game progress
local DataStoreService = game:GetService("DataStoreService")

local MAX_RETRIES = 3
local function withRetry(fn, label)
	for attempt = 1, MAX_RETRIES do
		local success, result = pcall(fn)
		if success then return true, result end
		if attempt < MAX_RETRIES then
			local backoff = math.pow(2, attempt)
			warn(string.format("[DataManager] %s failed (attempt %d/%d): %s", label, attempt, MAX_RETRIES, tostring(result)))
			task.wait(backoff)
		else
			warn(string.format("[DataManager] %s failed after %d attempts: %s", label, MAX_RETRIES, tostring(result)))
			return false, result
		end
	end
	return false, "Max retries"
end
local Players = game:GetService("Players")

local horrorStore = DataStoreService:GetDataStore("HorrorData_v1")

local MAX_RETRIES = 3
local function withRetry(fn, label)
	for attempt = 1, MAX_RETRIES do
		local success, result = pcall(fn)
		if success then return true, result end
		if attempt < MAX_RETRIES then
			local backoff = math.pow(2, attempt)
			warn(string.format("[DataManager] %s failed (attempt %d/%d): %s", label, attempt, MAX_RETRIES, tostring(result)))
			task.wait(backoff)
		else
			warn(string.format("[DataManager] %s failed after %d attempts: %s", label, MAX_RETRIES, tostring(result)))
			return false, result
		end
	end
	return false, "Max retries"
end

local function savePlayerData(player)
	local key = "user_" .. player.UserId
	pcall(function()
		horrorStore:SetAsync(key, { completedRooms = {}, puzzlesSolved = {} })
	end)
end

Players.PlayerRemoving:Connect(savePlayerData)

game:BindToClose(function()
	for _, player in Players:GetPlayers() do
		savePlayerData(player)
	end
end)

print("DataManager loaded")
`;

const HORROR_ENEMYAI_SERVER_LUAU = `
--[[
	EnemyAI.server.luau
	Drives enemy NPCs using CollectionService tags and PathfindingService.

	Tag: "Enemy"
	Reads Attributes:
	  AIBehavior (string)   — "chase", "patrol", "wander", "stationary" (default: "chase")
	  WalkSpeed (number)    — movement speed (default: 12)
	  AttackRange (number)  — studs to start attacking (default: 5)
	  AttackDamage (number) — damage per hit (default: 10)
	  AttackCooldown (number) — seconds between attacks (default: 1)
	  AggroRange (number)   — studs to detect player (default: 40)
	  MaxHealth (number)    — enemy health (default: 100)
	  RespawnTime (number)  — seconds to respawn (default: 10)
]]

local CollectionService = game:GetService("CollectionService")
local PathfindingService = game:GetService("PathfindingService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local function getAttr(inst: Instance, name: string, default: any): any
	local val = inst:GetAttribute(name)
	return if val ~= nil then val else default
end

--- Convert a tagged Part into a proper NPC Model with Humanoid.
local function makeNPCModel(part: BasePart): Model
	-- If already a Model parent with Humanoid, use it
	if part.Parent and part.Parent:IsA("Model") and part.Parent:FindFirstChildOfClass("Humanoid") then
		return part.Parent :: Model
	end

	-- Build an NPC model from the part
	local model = Instance.new("Model")
	model.Name = part.Name

	-- Create torso (the original part becomes it)
	part.Name = "HumanoidRootPart"
	part.Anchored = false
	part.CanCollide = true

	-- Ensure minimum size for a character
	if part.Size.Y < 4 then
		part.Size = Vector3.new(math.max(part.Size.X, 2), 5, math.max(part.Size.Z, 2))
	end

	local humanoid = Instance.new("Humanoid")
	humanoid.MaxHealth = getAttr(part, "MaxHealth", 100)
	humanoid.Health = humanoid.MaxHealth
	humanoid.WalkSpeed = getAttr(part, "WalkSpeed", 12)
	humanoid.Parent = model

	local parent = part.Parent
	local spawnCFrame = part.CFrame

	part.Parent = model
	model.PrimaryPart = part
	model.Parent = parent

	-- Store spawn position for respawn
	model:SetAttribute("SpawnCFrame", spawnCFrame)

	return model
end

--- Find the nearest player character within range.
local function findNearestPlayer(position: Vector3, range: number): (Model?, number)
	local nearest: Model? = nil
	local nearestDist = range

	for _, player in Players:GetPlayers() do
		local character = player.Character
		if not character then continue end
		local hrp = character:FindFirstChild("HumanoidRootPart") :: BasePart?
		if not hrp then continue end
		local humanoid = character:FindFirstChildOfClass("Humanoid")
		if not humanoid or humanoid.Health <= 0 then continue end

		local dist = (hrp.Position - position).Magnitude
		if dist < nearestDist then
			nearest = character
			nearestDist = dist
		end
	end

	return nearest, nearestDist
end

--- Move to a position using PathfindingService.
local function moveTo(model: Model, humanoid: Humanoid, target: Vector3)
	local hrp = model.PrimaryPart
	if not hrp then return end

	local path = PathfindingService:CreatePath({
		AgentRadius = 2,
		AgentHeight = 5,
		AgentCanJump = true,
		AgentCanClimb = false,
	})

	local success, _ = pcall(function()
		path:ComputeAsync(hrp.Position, target)
	end)

	if not success or path.Status ~= Enum.PathStatus.Success then
		-- Fallback: direct movement
		humanoid:MoveTo(target)
		return
	end

	local waypoints = path:GetWaypoints()
	for _, waypoint in waypoints do
		if not hrp.Parent then return end
		humanoid:MoveTo(waypoint.Position)
		if waypoint.Action == Enum.PathWaypointAction.Jump then
			humanoid.Jump = true
		end
		-- Wait for movement to complete or timeout
		local reached = humanoid.MoveToFinished:Wait()
		if not reached then break end
	end
end

--- Attack a target character.
local function attackTarget(model: Model, target: Model, damage: number)
	local targetHumanoid = target:FindFirstChildOfClass("Humanoid")
	if targetHumanoid and targetHumanoid.Health > 0 then
		targetHumanoid:TakeDamage(damage)
	end
end

--- Run the AI loop for a single enemy.
local function runEnemyAI(part: BasePart)
	local model = makeNPCModel(part)
	local humanoid = model:FindFirstChildOfClass("Humanoid")
	if not humanoid then return end

	local behavior = getAttr(part, "AIBehavior", "chase")
	local attackRange = getAttr(part, "AttackRange", 5)
	local attackDamage = getAttr(part, "AttackDamage", 10)
	local attackCooldown = getAttr(part, "AttackCooldown", 1)
	local aggroRange = getAttr(part, "AggroRange", 40)
	local respawnTime = getAttr(part, "RespawnTime", 10)
	local spawnCFrame = model:GetAttribute("SpawnCFrame") or (model.PrimaryPart and model.PrimaryPart.CFrame)

	local lastAttackTime = 0
	local patrolTarget: Vector3? = nil

	-- Handle death → respawn
	humanoid.Died:Connect(function()
		task.wait(respawnTime)
		-- Respawn: restore health, teleport back
		if model.PrimaryPart then
			humanoid.Health = humanoid.MaxHealth
			model.PrimaryPart.CFrame = spawnCFrame or CFrame.new(0, 10, 0)
		end
	end)

	-- Main AI loop
	while model.Parent and humanoid.Health > 0 do
		local hrp = model.PrimaryPart
		if not hrp then task.wait(1) continue end

		if behavior == "stationary" then
			-- Just stand and attack if player is in range
			local target, dist = findNearestPlayer(hrp.Position, attackRange)
			if target and tick() - lastAttackTime >= attackCooldown then
				attackTarget(model, target, attackDamage)
				lastAttackTime = tick()
			end
			task.wait(0.5)

		elseif behavior == "chase" then
			local target, dist = findNearestPlayer(hrp.Position, aggroRange)
			if target then
				local targetHRP = target:FindFirstChild("HumanoidRootPart") :: BasePart?
				if targetHRP then
					if dist <= attackRange then
						-- In range — attack
						if tick() - lastAttackTime >= attackCooldown then
							attackTarget(model, target, attackDamage)
							lastAttackTime = tick()
						end
						humanoid:MoveTo(targetHRP.Position)
					else
						-- Chase using pathfinding
						moveTo(model, humanoid, targetHRP.Position)
					end
				end
			else
				-- No target — return to spawn
				if spawnCFrame then
					local distFromSpawn = (hrp.Position - spawnCFrame.Position).Magnitude
					if distFromSpawn > 5 then
						humanoid:MoveTo(spawnCFrame.Position)
						humanoid.MoveToFinished:Wait()
					end
				end
			end
			task.wait(0.3)

		elseif behavior == "patrol" then
			-- Pick random nearby point, walk to it, repeat
			if not patrolTarget or (hrp.Position - patrolTarget).Magnitude < 3 then
				local angle = math.random() * math.pi * 2
				local radius = math.random(10, 25)
				local origin = if spawnCFrame then spawnCFrame.Position else hrp.Position
				patrolTarget = origin + Vector3.new(
					math.cos(angle) * radius,
					0,
					math.sin(angle) * radius
				)
			end

			-- Check for aggro while patrolling
			local target, dist = findNearestPlayer(hrp.Position, aggroRange)
			if target then
				local targetHRP = target:FindFirstChild("HumanoidRootPart") :: BasePart?
				if targetHRP then
					if dist <= attackRange then
						if tick() - lastAttackTime >= attackCooldown then
							attackTarget(model, target, attackDamage)
							lastAttackTime = tick()
						end
					else
						moveTo(model, humanoid, targetHRP.Position)
					end
				end
			else
				humanoid:MoveTo(patrolTarget)
				humanoid.MoveToFinished:Wait()
			end
			task.wait(0.5)

		elseif behavior == "wander" then
			-- Random walking, no aggro
			local angle = math.random() * math.pi * 2
			local radius = math.random(5, 15)
			local origin = if spawnCFrame then spawnCFrame.Position else hrp.Position
			local wanderTarget = origin + Vector3.new(
				math.cos(angle) * radius,
				0,
				math.sin(angle) * radius
			)
			humanoid:MoveTo(wanderTarget)
			humanoid.MoveToFinished:Wait()
			task.wait(math.random(1, 3))
		end
	end
end

-- ── Initialize ──

for _, part in CollectionService:GetTagged("Enemy") do
	task.spawn(runEnemyAI, part)
end

CollectionService:GetInstanceAddedSignal("Enemy"):Connect(function(part)
	if part:IsA("BasePart") then
		task.spawn(runEnemyAI, part)
	end
end)
`;

const HORROR_HORRORMANAGER_SERVER_LUAU = `
-- HorrorManager: handles atmosphere, jumpscares, flashlight, and stamina
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")

local HorrorConfig = require(ReplicatedStorage:WaitForChild("HorrorConfig"))

local horrorEvent = Instance.new("RemoteEvent")
horrorEvent.Name = "HorrorEvent"
horrorEvent.Parent = ReplicatedStorage

local playerState = {}

local function initPlayer(player)
	playerState[player] = {
		flashlightOn = false,
		battery = HorrorConfig.FlashlightBattery,
		stamina = HorrorConfig.StaminaMax,
		sprinting = false,
		keys = {},
		roomsVisited = {},
	}
end

-- Flashlight toggle
local flashlightEvent = Instance.new("RemoteEvent")
flashlightEvent.Name = "ToggleFlashlight"
flashlightEvent.Parent = ReplicatedStorage

flashlightEvent.OnServerEvent:Connect(function(player)
	local state = playerState[player]
	if not state then return end
	if state.battery <= 0 then
		horrorEvent:FireClient(player, { type = "no_battery" })
		return
	end
	state.flashlightOn = not state.flashlightOn
	horrorEvent:FireClient(player, {
		type = "flashlight",
		on = state.flashlightOn,
		battery = state.battery,
	})
end)

-- Sprint toggle
local sprintEvent = Instance.new("RemoteEvent")
sprintEvent.Name = "ToggleSprint"
sprintEvent.Parent = ReplicatedStorage

sprintEvent.OnServerEvent:Connect(function(player, sprinting)
	local state = playerState[player]
	if not state then return end
	state.sprinting = sprinting
	local character = player.Character
	if character then
		local humanoid = character:FindFirstChild("Humanoid")
		if humanoid then
			humanoid.WalkSpeed = sprinting and HorrorConfig.SprintSpeed or HorrorConfig.WalkSpeed
		end
	end
end)

-- Battery drain + stamina loop
task.spawn(function()
	while true do
		task.wait(1)
		for player, state in pairs(playerState) do
			if state.flashlightOn then
				state.battery = math.max(0, state.battery - HorrorConfig.BatteryDrainRate)
				if state.battery <= 0 then
					state.flashlightOn = false
					horrorEvent:FireClient(player, { type = "flashlight", on = false, battery = 0 })
				end
			end
			if state.sprinting then
				state.stamina = math.max(0, state.stamina - HorrorConfig.StaminaDrainRate)
				if state.stamina <= 0 then
					state.sprinting = false
					local character = player.Character
					if character then
						local humanoid = character:FindFirstChild("Humanoid")
						if humanoid then
							humanoid.WalkSpeed = HorrorConfig.WalkSpeed
						end
					end
				end
			else
				state.stamina = math.min(HorrorConfig.StaminaMax, state.stamina + HorrorConfig.StaminaRegenRate)
			end
			horrorEvent:FireClient(player, {
				type = "stats",
				battery = state.battery,
				stamina = state.stamina,
			})
		end
	end
end)

-- Flickering lights
for _, light in CollectionService:GetTagged("FlickeringLight") do
	task.spawn(function()
		while light and light.Parent do
			local pointLight = light:FindFirstChildOfClass("PointLight")
			if not pointLight then
				pointLight = Instance.new("PointLight")
				pointLight.Range = 30
				pointLight.Brightness = 1
				pointLight.Color = Color3.fromRGB(255, 220, 150)
				pointLight.Parent = light
			end
			pointLight.Brightness = math.random() > 0.3 and 1 or 0
			light.Transparency = pointLight.Brightness == 0 and 0.8 or 0
			task.wait(math.random() * 0.3 + 0.1)
		end
	end)
end

-- Jumpscare system
local function triggerJumpscare(player, triggerType)
	local state = playerState[player]
	if not state then return end
	for _, js in ipairs(HorrorConfig.Jumpscares) do
		if js.Trigger == triggerType then
			if math.random(1, 100) <= js.Chance then
				horrorEvent:FireClient(player, { type = "jumpscare", trigger = triggerType })
			end
			break
		end
	end
end

-- Door interaction
for _, door in CollectionService:GetTagged("Door") do
	door.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if player then
			triggerJumpscare(player, "door_open")
		end
	end)
end

Players.PlayerAdded:Connect(function(player)
	initPlayer(player)
	player.CharacterAdded:Connect(function(character)
		task.wait(0.1)
		local humanoid = character:FindFirstChild("Humanoid")
		if humanoid then
			humanoid.WalkSpeed = HorrorConfig.WalkSpeed
		end
	end)
end)

Players.PlayerRemoving:Connect(function(player)
	playerState[player] = nil
end)

print("HorrorManager loaded")
`;

const HORROR_PUZZLEMANAGER_SERVER_LUAU = `
-- PuzzleManager: handles puzzles, keys, and item pickups
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local HorrorConfig = require(ReplicatedStorage:WaitForChild("HorrorConfig"))

local puzzleEvent = Instance.new("RemoteEvent")
puzzleEvent.Name = "PuzzleEvent"
puzzleEvent.Parent = ReplicatedStorage

local itemEvent = Instance.new("RemoteEvent")
itemEvent.Name = "ItemEvent"
itemEvent.Parent = ReplicatedStorage

local playerInventory = {}

local function getInventory(player)
	if not playerInventory[player] then
		playerInventory[player] = {}
	end
	return playerInventory[player]
end

local function hasItem(player, itemName)
	local inv = getInventory(player)
	for _, item in ipairs(inv) do
		if item == itemName then return true end
	end
	return false
end

-- Item pickup
itemEvent.OnServerEvent:Connect(function(player, itemName)
	local inv = getInventory(player)
	if hasItem(player, itemName) then return end
	table.insert(inv, itemName)
	itemEvent:FireClient(player, { type = "picked_up", item = itemName })

	-- Trigger jumpscare chance on pickup
	local horrorEvent = ReplicatedStorage:FindFirstChild("HorrorEvent")
	if horrorEvent then
		if math.random(1, 100) <= 15 then
			horrorEvent:FireClient(player, { type = "jumpscare", trigger = "item_pickup" })
		end
	end
end)

-- Puzzle attempt
puzzleEvent.OnServerEvent:Connect(function(player, puzzleId, answer)
	local puzzleConfig = nil
	for _, p in ipairs(HorrorConfig.Puzzles) do
		if p.Id == puzzleId then
			puzzleConfig = p
			break
		end
	end
	if not puzzleConfig then return end

	local correct = false
	if puzzleConfig.Type == "code" then
		correct = tostring(answer) == puzzleConfig.Solution
	elseif puzzleConfig.Type == "sequence" then
		if type(answer) == "table" and #answer == #puzzleConfig.Solution then
			correct = true
			for i, v in ipairs(puzzleConfig.Solution) do
				if answer[i] ~= v then
					correct = false
					break
				end
			end
		end
	end

	if correct then
		local inv = getInventory(player)
		table.insert(inv, puzzleConfig.Reward)
		puzzleEvent:FireClient(player, {
			type = "solved",
			puzzleId = puzzleId,
			reward = puzzleConfig.Reward,
		})
		print(player.Name .. " solved " .. puzzleId .. ", got " .. puzzleConfig.Reward)
	else
		puzzleEvent:FireClient(player, {
			type = "wrong",
			puzzleId = puzzleId,
		})
	end
end)

-- Door key checks
for _, door in CollectionService:GetTagged("LockedDoor") do
	door.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player then return end
		local requiredKey = door:GetAttribute("RequiredKey") or ""
		if requiredKey == "" or hasItem(player, requiredKey) then
			door.Transparency = 1
			door.CanCollide = false
			task.delay(5, function()
				door.Transparency = 0
				door.CanCollide = true
			end)
		else
			puzzleEvent:FireClient(player, { type = "locked", key = requiredKey })
		end
	end)
end

Players.PlayerRemoving:Connect(function(player)
	playerInventory[player] = nil
end)

print("PuzzleManager loaded")
`;

const HORROR_HORRORCONFIG_LUAU = `
local HorrorConfig = {}

HorrorConfig.MaxPlayers = 4
HorrorConfig.FlashlightBattery = 100
HorrorConfig.BatteryDrainRate = 2
HorrorConfig.SprintSpeed = 24
HorrorConfig.WalkSpeed = 12
HorrorConfig.StaminaMax = 100
HorrorConfig.StaminaDrainRate = 20
HorrorConfig.StaminaRegenRate = 10

HorrorConfig.Rooms = {
	{ Name = "Entrance Hall", KeyRequired = false, Dark = false },
	{ Name = "Library", KeyRequired = false, Dark = true },
	{ Name = "Basement", KeyRequired = true, Dark = true },
	{ Name = "Attic", KeyRequired = true, Dark = true },
}

HorrorConfig.Puzzles = {
	{
		Id = "puzzle_library",
		Room = "Library",
		Type = "sequence",
		Description = "Press the books in the correct order",
		Solution = { 3, 1, 4, 2 },
		Reward = "BasementKey",
	},
	{
		Id = "puzzle_basement",
		Room = "Basement",
		Type = "code",
		Description = "Enter the 4-digit code from the clues",
		Solution = "1847",
		Reward = "AtticKey",
	},
}

HorrorConfig.Jumpscares = {
	{ Trigger = "door_open", Chance = 20, Cooldown = 30 },
	{ Trigger = "hallway_walk", Chance = 10, Cooldown = 45 },
	{ Trigger = "item_pickup", Chance = 15, Cooldown = 60 },
}

HorrorConfig.Items = {
	{ Name = "Flashlight", Type = "tool", SpawnRoom = "Entrance Hall" },
	{ Name = "BasementKey", Type = "key", SpawnRoom = "Library" },
	{ Name = "AtticKey", Type = "key", SpawnRoom = "Basement" },
	{ Name = "Battery", Type = "consumable", SpawnRoom = "Library" },
	{ Name = "Note1", Type = "lore", SpawnRoom = "Entrance Hall", Text = "They sealed it below..." },
	{ Name = "Note2", Type = "lore", SpawnRoom = "Basement", Text = "The code is the year it began." },
}

return HorrorConfig
`;

export function getHorrorScripts(): ScriptFile[] {
  return [
    { relativePath: "src/client/HorrorUI.client.luau", name: "HorrorUI", scriptType: "client", content: HORROR_HORRORUI_CLIENT_LUAU },
    { relativePath: "src/server/DataManager.server.luau", name: "DataManager", scriptType: "server", content: HORROR_DATAMANAGER_SERVER_LUAU },
    { relativePath: "src/server/EnemyAI.server.luau", name: "EnemyAI", scriptType: "server", content: HORROR_ENEMYAI_SERVER_LUAU },
    { relativePath: "src/server/HorrorManager.server.luau", name: "HorrorManager", scriptType: "server", content: HORROR_HORRORMANAGER_SERVER_LUAU },
    { relativePath: "src/server/PlatformBehaviors.server.luau", name: "PlatformBehaviors", scriptType: "server", content: PLATFORM_BEHAVIORS },
    { relativePath: "src/server/PuzzleManager.server.luau", name: "PuzzleManager", scriptType: "server", content: HORROR_PUZZLEMANAGER_SERVER_LUAU },
    { relativePath: "src/shared/HorrorConfig.luau", name: "HorrorConfig", scriptType: "module", content: HORROR_HORRORCONFIG_LUAU },
    { relativePath: "src/shared/RateLimit.luau", name: "RateLimit", scriptType: "module", content: RATE_LIMIT },
  ];
}

// ── Racing Template Scripts ──

const RACING_RACINGUI_CLIENT_LUAU = `
-- RacingUI: client-side HUD for racing game
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- Racing camera: wider FOV, follow behind vehicle
workspace.CurrentCamera.FieldOfView = 80

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "RaceHUD"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Speed display (bottom center)
local speedFrame = Instance.new("Frame")
speedFrame.Size = UDim2.new(0, 160, 0, 60)
speedFrame.Position = UDim2.new(0.5, -80, 1, -80)
speedFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
speedFrame.BackgroundTransparency = 0.15
speedFrame.BorderSizePixel = 0
speedFrame.Parent = screenGui

local speedLabel = Instance.new("TextLabel")
speedLabel.Size = UDim2.new(1, 0, 1, 0)
speedLabel.BackgroundTransparency = 1
speedLabel.Text = "0 MPH"
speedLabel.TextColor3 = Color3.new(1, 1, 1)
speedLabel.TextSize = 28
speedLabel.Font = Enum.Font.GothamBold
speedLabel.Parent = speedFrame

-- Lap counter (top center)
local lapLabel = Instance.new("TextLabel")
lapLabel.Size = UDim2.new(0, 200, 0, 40)
lapLabel.Position = UDim2.new(0.5, -100, 0, 12)
lapLabel.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
lapLabel.BackgroundTransparency = 0.15
lapLabel.Text = "Lap 0 / 3"
lapLabel.TextColor3 = Color3.new(1, 1, 1)
lapLabel.TextSize = 20
lapLabel.Font = Enum.Font.GothamBold
lapLabel.BorderSizePixel = 0
lapLabel.Parent = screenGui

-- Position display (top right)
local posLabel = Instance.new("TextLabel")
posLabel.Size = UDim2.new(0, 100, 0, 50)
posLabel.Position = UDim2.new(1, -112, 0, 12)
posLabel.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
posLabel.BackgroundTransparency = 0.15
posLabel.Text = "1st"
posLabel.TextColor3 = Color3.fromRGB(255, 220, 50)
posLabel.TextSize = 32
posLabel.Font = Enum.Font.GothamBold
posLabel.BorderSizePixel = 0
posLabel.Parent = screenGui

-- Countdown overlay
local countdownLabel = Instance.new("TextLabel")
countdownLabel.Name = "Countdown"
countdownLabel.Size = UDim2.new(1, 0, 1, 0)
countdownLabel.BackgroundTransparency = 1
countdownLabel.Text = ""
countdownLabel.TextColor3 = Color3.new(1, 1, 1)
countdownLabel.TextSize = 72
countdownLabel.Font = Enum.Font.GothamBold
countdownLabel.Visible = false
countdownLabel.Parent = screenGui

-- Listen for race events
local raceEvent = ReplicatedStorage:WaitForChild("RaceEvent")
raceEvent.OnClientEvent:Connect(function(data)
	if data.type == "countdown" then
		countdownLabel.Visible = true
		countdownLabel.Text = tostring(data.count)
	elseif data.type == "go" then
		countdownLabel.Text = "GO!"
		task.delay(1, function() countdownLabel.Visible = false end)
	elseif data.type == "lap" then
		lapLabel.Text = "Lap " .. data.lap .. " / " .. data.totalLaps
	elseif data.type == "finished" then
		local suffix = data.place == 1 and "st" or data.place == 2 and "nd" or data.place == 3 and "rd" or "th"
		posLabel.Text = data.place .. suffix
		countdownLabel.Visible = true
		countdownLabel.Text = "FINISHED! " .. string.format("%.1f", data.time) .. "s"
		task.delay(5, function() countdownLabel.Visible = false end)
	end
end)

-- Speed display update
task.spawn(function()
	while true do
		task.wait(0.1)
		local character = player.Character
		if character then
			local root = character:FindFirstChild("HumanoidRootPart")
			if root then
				local speed = math.floor(root.AssemblyLinearVelocity.Magnitude)
				speedLabel.Text = speed .. " MPH"
			end
		end
	end
end)

print("RacingUI loaded")
`;

const RACING_COLLISIONGROUPSETUP_SERVER_LUAU = `
-- CollisionGroupSetup: configure collision groups for racing
-- Players don't collide with each other while in vehicles
-- Prevents bumping/griefing during races

local PhysicsService = game:GetService("PhysicsService")
local Players = game:GetService("Players")

-- Register collision groups
PhysicsService:RegisterCollisionGroup("Players")
PhysicsService:RegisterCollisionGroup("Vehicles")

-- Players don't collide with each other
PhysicsService:CollisionGroupSetCollidable("Players", "Players", false)

-- Vehicles don't collide with other vehicles (ghost racing)
PhysicsService:CollisionGroupSetCollidable("Vehicles", "Vehicles", false)

-- Vehicles still collide with track barriers (Default group)
PhysicsService:CollisionGroupSetCollidable("Vehicles", "Default", true)

-- Assign player characters to the Players collision group
local function assignCollisionGroup(character)
	for _, part in ipairs(character:GetDescendants()) do
		if part:IsA("BasePart") then
			part.CollisionGroup = "Players"
		end
	end

	character.DescendantAdded:Connect(function(descendant)
		if descendant:IsA("BasePart") then
			descendant.CollisionGroup = "Players"
		end
	end)
end

Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(assignCollisionGroup)
	if player.Character then
		assignCollisionGroup(player.Character)
	end
end)

print("CollisionGroupSetup loaded — Players and Vehicles groups configured")
`;

const RACING_DATAMANAGER_SERVER_LUAU = `
-- DataManager: saves racing stats and vehicle ownership
local DataStoreService = game:GetService("DataStoreService")

local MAX_RETRIES = 3
local function withRetry(fn, label)
	for attempt = 1, MAX_RETRIES do
		local success, result = pcall(fn)
		if success then return true, result end
		if attempt < MAX_RETRIES then
			local backoff = math.pow(2, attempt)
			warn(string.format("[DataManager] %s failed (attempt %d/%d): %s", label, attempt, MAX_RETRIES, tostring(result)))
			task.wait(backoff)
		else
			warn(string.format("[DataManager] %s failed after %d attempts: %s", label, MAX_RETRIES, tostring(result)))
			return false, result
		end
	end
	return false, "Max retries"
end
local Players = game:GetService("Players")

local raceStore = DataStoreService:GetDataStore("RaceData_v1")

local MAX_RETRIES = 3
local function withRetry(fn, label)
	for attempt = 1, MAX_RETRIES do
		local success, result = pcall(fn)
		if success then return true, result end
		if attempt < MAX_RETRIES then
			local backoff = math.pow(2, attempt)
			warn(string.format("[DataManager] %s failed (attempt %d/%d): %s", label, attempt, MAX_RETRIES, tostring(result)))
			task.wait(backoff)
		else
			warn(string.format("[DataManager] %s failed after %d attempts: %s", label, MAX_RETRIES, tostring(result)))
			return false, result
		end
	end
	return false, "Max retries"
end

local function savePlayerData(player)
	local key = "user_" .. player.UserId
	pcall(function()
		raceStore:SetAsync(key, { wins = 0, races = 0, bestTime = 0, coins = 0 })
	end)
end

Players.PlayerRemoving:Connect(savePlayerData)
game:BindToClose(function()
	for _, player in Players:GetPlayers() do savePlayerData(player) end
end)

print("DataManager loaded")
`;

const RACING_RACEMANAGER_SERVER_LUAU = `
-- RaceManager: handles race queue, countdown, laps, checkpoints, and results
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local RaceConfig = require(ReplicatedStorage:WaitForChild("RaceConfig"))

local raceEvent = Instance.new("RemoteEvent")
raceEvent.Name = "RaceEvent"
raceEvent.Parent = ReplicatedStorage

local queue = {}
local activeRace = nil

local function addToQueue(player)
	if table.find(queue, player) then return end
	table.insert(queue, player)
	raceEvent:FireClient(player, { type = "queued", position = #queue })
	if #queue >= 2 then startRace() end
end

function startRace()
	if activeRace then return end
	local racers = {}
	local count = math.min(#queue, RaceConfig.MaxPlayersPerRace)
	for i = 1, count do
		table.insert(racers, table.remove(queue, 1))
	end

	activeRace = { racers = racers, laps = {}, checkpoints = {}, startTime = 0, finished = {} }
	for _, racer in ipairs(racers) do
		activeRace.laps[racer] = 0
		activeRace.checkpoints[racer] = 0
	end

	-- Countdown
	for i = RaceConfig.CountdownTime, 1, -1 do
		for _, racer in ipairs(racers) do
			raceEvent:FireClient(racer, { type = "countdown", count = i })
		end
		task.wait(1)
	end

	activeRace.startTime = tick()
	for _, racer in ipairs(racers) do
		raceEvent:FireClient(racer, { type = "go" })
	end

	-- Timeout
	task.delay(RaceConfig.RaceTimeout, function()
		if activeRace then endRace() end
	end)

	print("Race started with " .. #racers .. " racers")
end

function endRace()
	if not activeRace then return end
	local results = {}
	for i, racer in ipairs(activeRace.finished) do
		local reward = i == 1 and RaceConfig.Rewards.First
			or i == 2 and RaceConfig.Rewards.Second
			or i == 3 and RaceConfig.Rewards.Third
			or RaceConfig.Rewards.Finish
		table.insert(results, { player = racer, place = i, reward = reward })
	end

	for _, racer in ipairs(activeRace.racers) do
		local place = nil
		local reward = RaceConfig.Rewards.Finish
		for _, r in ipairs(results) do
			if r.player == racer then
				place = r.place
				reward = r.reward
				break
			end
		end
		raceEvent:FireClient(racer, {
			type = "results",
			place = place or #activeRace.racers,
			reward = reward,
			results = results,
		})
	end

	activeRace = nil
end

-- Checkpoint detection
for _, cp in CollectionService:GetTagged("Checkpoint") do
	cp.Touched:Connect(function(hit)
		if not activeRace then return end
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player then return end
		if not activeRace.checkpoints[player] then return end
		activeRace.checkpoints[player] = activeRace.checkpoints[player] + 1
		raceEvent:FireClient(player, {
			type = "checkpoint",
			checkpoint = activeRace.checkpoints[player],
		})
	end)
end

-- Lap completion (start line)
for _, sl in CollectionService:GetTagged("StartLine") do
	sl.Touched:Connect(function(hit)
		if not activeRace then return end
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player then return end
		if not activeRace.laps[player] then return end
		if activeRace.checkpoints[player] and activeRace.checkpoints[player] >= 2 then
			activeRace.laps[player] = activeRace.laps[player] + 1
			activeRace.checkpoints[player] = 0
			raceEvent:FireClient(player, {
				type = "lap",
				lap = activeRace.laps[player],
				totalLaps = RaceConfig.LapCount,
			})
			if activeRace.laps[player] >= RaceConfig.LapCount then
				table.insert(activeRace.finished, player)
				raceEvent:FireClient(player, {
					type = "finished",
					place = #activeRace.finished,
					time = tick() - activeRace.startTime,
				})
				if #activeRace.finished >= #activeRace.racers then
					endRace()
				end
			end
		end
	end)
end

-- Boost pads
for _, pad in CollectionService:GetTagged("BoostPad") do
	pad.Touched:Connect(function(hit)
		local character = hit.Parent
		if not character then return end
		local humanoid = character:FindFirstChild("Humanoid")
		if humanoid then
			local origSpeed = humanoid.WalkSpeed
			humanoid.WalkSpeed = origSpeed * 1.5
			task.delay(3, function()
				if humanoid and humanoid.Parent then
					humanoid.WalkSpeed = origSpeed
				end
			end)
		end
	end)
end

-- Queue pad
for _, pad in CollectionService:GetTagged("RaceQueue") do
	pad.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if player then addToQueue(player) end
	end)
end

Players.PlayerRemoving:Connect(function(player)
	local idx = table.find(queue, player)
	if idx then table.remove(queue, idx) end
end)

print("RaceManager loaded")
`;

const RACING_VEHICLEMANAGER_SERVER_LUAU = `
--[[
	VehicleManager: handles vehicle selection, spawning, driving, and upgrades.
	Creates actual driveable vehicles using VehicleSeat + BodyVelocity.
]]
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local RaceConfig = require(ReplicatedStorage:WaitForChild("RaceConfig"))
local RateLimit = require(ReplicatedStorage:WaitForChild("RateLimit"))

local vehicleEvent = Instance.new("RemoteEvent")
vehicleEvent.Name = "VehicleEvent"
vehicleEvent.Parent = ReplicatedStorage

local playerVehicles = {} -- { [Player]: { selected, owned, coins } }
local activeVehicles = {} -- { [Player]: Model }

local function getPlayerData(player)
	if not playerVehicles[player] then
		playerVehicles[player] = { selected = "Starter Kart", owned = { "Starter Kart" }, coins = 0 }
	end
	return playerVehicles[player]
end

local function getVehicleConfig(name: string)
	for _, v in ipairs(RaceConfig.Vehicles) do
		if v.Name == name then return v end
	end
	return RaceConfig.Vehicles[1]
end

--- Build a driveable vehicle model from config.
local function buildVehicle(config): Model
	local model = Instance.new("Model")
	model.Name = config.Name

	-- Main body
	local body = Instance.new("Part")
	body.Name = "Body"
	body.Size = Vector3.new(6, 2, 10)
	body.Color = config.Color
	body.Material = Enum.Material.SmoothPlastic
	body.Anchored = false
	body.CanCollide = true
	body.Parent = model

	-- Driver seat
	local seat = Instance.new("VehicleSeat")
	seat.Name = "DriveSeat"
	seat.Size = Vector3.new(2, 1, 2)
	seat.Position = body.Position + Vector3.new(0, 1.5, -1)
	seat.MaxSpeed = config.Speed
	seat.Torque = config.Acceleration * 10
	seat.TurnSpeed = config.Handling * 3
	seat.Anchored = false
	seat.CanCollide = true
	seat.Parent = model

	-- Weld seat to body
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = body
	weld.Part1 = seat
	weld.Parent = seat

	-- Wheels (4 corners)
	local wheelPositions = {
		Vector3.new(-2.5, -1, 3.5),  -- front-left
		Vector3.new(2.5, -1, 3.5),   -- front-right
		Vector3.new(-2.5, -1, -3.5), -- back-left
		Vector3.new(2.5, -1, -3.5),  -- back-right
	}

	for i, offset in ipairs(wheelPositions) do
		local wheel = Instance.new("Part")
		wheel.Name = "Wheel" .. i
		wheel.Shape = Enum.PartType.Cylinder
		wheel.Size = Vector3.new(1.5, 1.5, 1.5)
		wheel.Color = Color3.fromRGB(30, 30, 30)
		wheel.Material = Enum.Material.SmoothPlastic
		wheel.Position = body.Position + offset
		wheel.Anchored = false
		wheel.CanCollide = true
		wheel.Parent = model

		local wheelWeld = Instance.new("WeldConstraint")
		wheelWeld.Part0 = body
		wheelWeld.Part1 = wheel
		wheelWeld.Parent = wheel
	end

	-- Headlights
	for _, side in ipairs({ -2, 2 }) do
		local light = Instance.new("Part")
		light.Name = "Headlight"
		light.Size = Vector3.new(1, 0.8, 0.3)
		light.Color = Color3.fromRGB(255, 255, 200)
		light.Material = Enum.Material.Neon
		light.Position = body.Position + Vector3.new(side, 0.3, 5)
		light.Anchored = false
		light.CanCollide = false
		light.Parent = model

		local lightWeld = Instance.new("WeldConstraint")
		lightWeld.Part0 = body
		lightWeld.Part1 = light
		lightWeld.Parent = light

		local spotlight = Instance.new("SpotLight")
		spotlight.Range = 60
		spotlight.Brightness = 2
		spotlight.Angle = 45
		spotlight.Face = Enum.NormalId.Front
		spotlight.Parent = light
	end

	model.PrimaryPart = body
	return model
end

--- Spawn a vehicle for a player at a spawn pad.
local function spawnVehicle(player: Player, spawnCFrame: CFrame?)
	-- Remove existing vehicle
	if activeVehicles[player] then
		activeVehicles[player]:Destroy()
		activeVehicles[player] = nil
	end

	local data = getPlayerData(player)
	local config = getVehicleConfig(data.selected)

	local vehicle = buildVehicle(config)

	-- Position at spawn or player location
	local spawnPos = spawnCFrame
	if not spawnPos then
		local character = player.Character
		if character and character.PrimaryPart then
			spawnPos = character.PrimaryPart.CFrame + Vector3.new(0, 3, 10)
		else
			spawnPos = CFrame.new(0, 5, 0)
		end
	end

	vehicle:SetPrimaryPartCFrame(spawnPos)
	vehicle.Parent = workspace

	activeVehicles[player] = vehicle

	-- Seat the player
	local seat = vehicle:FindFirstChild("DriveSeat")
	if seat and player.Character then
		local humanoid = player.Character:FindFirstChildOfClass("Humanoid")
		if humanoid then
			seat:Sit(humanoid)
		end
	end

	vehicleEvent:FireClient(player, {
		type = "spawned",
		vehicle = data.selected,
		speed = config.Speed,
	})
end

--- Remove a player's vehicle.
local function despawnVehicle(player: Player)
	if activeVehicles[player] then
		activeVehicles[player]:Destroy()
		activeVehicles[player] = nil
	end
end

-- ── Remote event handler ──

vehicleEvent.OnServerEvent:Connect(function(player, action, vehicleName)
	if not RateLimit.check(player, "vehicle", 0.5) then return end
	local data = getPlayerData(player)

	if action == "select" then
		for _, name in ipairs(data.owned) do
			if name == vehicleName then
				data.selected = vehicleName
				vehicleEvent:FireClient(player, { type = "selected", vehicle = vehicleName })
				return
			end
		end
		vehicleEvent:FireClient(player, { type = "error", message = "You don't own this vehicle!" })

	elseif action == "buy" then
		local config = getVehicleConfig(vehicleName)
		if not config then return end

		for _, name in ipairs(data.owned) do
			if name == vehicleName then
				vehicleEvent:FireClient(player, { type = "error", message = "Already owned!" })
				return
			end
		end

		if data.coins < config.Cost then
			vehicleEvent:FireClient(player, { type = "error", message = "Need " .. config.Cost .. " coins!" })
			return
		end

		data.coins -= config.Cost
		table.insert(data.owned, vehicleName)
		data.selected = vehicleName

		vehicleEvent:FireClient(player, {
			type = "bought",
			vehicle = vehicleName,
			coins = data.coins,
		})

	elseif action == "spawn" then
		spawnVehicle(player)

	elseif action == "despawn" then
		despawnVehicle(player)
	end
end)

-- ── Vehicle spawn pads ──

for _, pad in CollectionService:GetTagged("VehicleSpawn") do
	pad.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player then return end
		if not RateLimit.check(player, "vehicle_spawn", 3) then return end
		spawnVehicle(player, pad.CFrame + Vector3.new(0, 3, 0))
	end)
end

CollectionService:GetInstanceAddedSignal("VehicleSpawn"):Connect(function(pad)
	pad.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player then return end
		if not RateLimit.check(player, "vehicle_spawn", 3) then return end
		spawnVehicle(player, pad.CFrame + Vector3.new(0, 3, 0))
	end)
end)

-- ── Vehicle select pads (garage) ──

for _, pad in CollectionService:GetTagged("VehicleSelect") do
	pad.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player then return end
		if not RateLimit.check(player, "garage", 1) then return end
		local data = getPlayerData(player)
		vehicleEvent:FireClient(player, {
			type = "show_garage",
			owned = data.owned,
			selected = data.selected,
			coins = data.coins,
			vehicles = RaceConfig.Vehicles,
		})
	end)
end

-- ── Cleanup ──

Players.PlayerRemoving:Connect(function(player)
	despawnVehicle(player)
	playerVehicles[player] = nil
end)
`;

const RACING_RACECONFIG_LUAU = `
local RaceConfig = {}

RaceConfig.MaxPlayersPerRace = 8
RaceConfig.CountdownTime = 3
RaceConfig.LapCount = 3
RaceConfig.RaceTimeout = 300

RaceConfig.Vehicles = {
	{
		Name = "Starter Kart",
		Speed = 80,
		Acceleration = 30,
		Handling = 0.8,
		Cost = 0,
		Color = Color3.fromRGB(200, 50, 50),
	},
	{
		Name = "Sport Car",
		Speed = 120,
		Acceleration = 45,
		Handling = 0.7,
		Cost = 500,
		Color = Color3.fromRGB(50, 100, 255),
	},
	{
		Name = "Super Racer",
		Speed = 160,
		Acceleration = 55,
		Handling = 0.6,
		Cost = 2000,
		Color = Color3.fromRGB(255, 200, 0),
	},
	{
		Name = "Hyper GT",
		Speed = 200,
		Acceleration = 70,
		Handling = 0.5,
		Cost = 10000,
		Color = Color3.fromRGB(150, 50, 255),
	},
}

RaceConfig.Tracks = {
	{
		Name = "Sunny Circuit",
		Laps = 3,
		Checkpoints = 8,
		Difficulty = "Easy",
	},
	{
		Name = "Mountain Pass",
		Laps = 2,
		Checkpoints = 12,
		Difficulty = "Medium",
	},
}

RaceConfig.Rewards = {
	First = 200,
	Second = 100,
	Third = 50,
	Finish = 25,
	LapBonus = 10,
}

RaceConfig.Powerups = {
	{ Name = "Boost", Duration = 3, SpeedMultiplier = 1.5 },
	{ Name = "Shield", Duration = 5 },
	{ Name = "Oil Slick", SlowMultiplier = 0.5, SlowDuration = 2 },
}

return RaceConfig
`;

export function getRacingScripts(): ScriptFile[] {
  return [
    { relativePath: "src/client/RacingUI.client.luau", name: "RacingUI", scriptType: "client", content: RACING_RACINGUI_CLIENT_LUAU },
    { relativePath: "src/server/CollisionGroupSetup.server.luau", name: "CollisionGroupSetup", scriptType: "server", content: RACING_COLLISIONGROUPSETUP_SERVER_LUAU },
    { relativePath: "src/server/DataManager.server.luau", name: "DataManager", scriptType: "server", content: RACING_DATAMANAGER_SERVER_LUAU },
    { relativePath: "src/server/PlatformBehaviors.server.luau", name: "PlatformBehaviors", scriptType: "server", content: PLATFORM_BEHAVIORS },
    { relativePath: "src/server/RaceManager.server.luau", name: "RaceManager", scriptType: "server", content: RACING_RACEMANAGER_SERVER_LUAU },
    { relativePath: "src/server/VehicleManager.server.luau", name: "VehicleManager", scriptType: "server", content: RACING_VEHICLEMANAGER_SERVER_LUAU },
    { relativePath: "src/shared/RaceConfig.luau", name: "RaceConfig", scriptType: "module", content: RACING_RACECONFIG_LUAU },
    { relativePath: "src/shared/RateLimit.luau", name: "RateLimit", scriptType: "module", content: RATE_LIMIT },
  ];
}

// ── Minigames Template Scripts ──

const MINIGAMES_MINIGAMEUI_CLIENT_LUAU = `
-- MinigameUI: client-side HUD for minigames
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "MiniHUD"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Status bar (top center)
local statusFrame = Instance.new("Frame")
statusFrame.Size = UDim2.new(0, 300, 0, 50)
statusFrame.Position = UDim2.new(0.5, -150, 0, 12)
statusFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
statusFrame.BackgroundTransparency = 0.15
statusFrame.BorderSizePixel = 0
statusFrame.Parent = screenGui

local statusCorner = Instance.new("UICorner")
statusCorner.CornerRadius = UDim.new(0, 12)
statusCorner.Parent = statusFrame

local statusLabel = Instance.new("TextLabel")
statusLabel.Name = "Status"
statusLabel.Size = UDim2.new(1, 0, 0.6, 0)
statusLabel.BackgroundTransparency = 1
statusLabel.Text = "Waiting for players..."
statusLabel.TextColor3 = Color3.new(1, 1, 1)
statusLabel.TextSize = 18
statusLabel.Font = Enum.Font.GothamBold
statusLabel.Parent = statusFrame

local timerLabel = Instance.new("TextLabel")
timerLabel.Name = "Timer"
timerLabel.Size = UDim2.new(1, 0, 0.4, 0)
timerLabel.Position = UDim2.new(0, 0, 0.6, 0)
timerLabel.BackgroundTransparency = 1
timerLabel.Text = ""
timerLabel.TextColor3 = Color3.fromRGB(255, 220, 100)
timerLabel.TextSize = 14
timerLabel.Font = Enum.Font.Gotham
timerLabel.Parent = statusFrame

-- Coins display (top left)
local coinsLabel = Instance.new("TextLabel")
coinsLabel.Size = UDim2.new(0, 140, 0, 36)
coinsLabel.Position = UDim2.new(0, 12, 0, 12)
coinsLabel.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
coinsLabel.BackgroundTransparency = 0.15
coinsLabel.Text = "  Coins: 0"
coinsLabel.TextColor3 = Color3.fromRGB(255, 220, 50)
coinsLabel.TextSize = 16
coinsLabel.Font = Enum.Font.GothamBold
coinsLabel.TextXAlignment = Enum.TextXAlignment.Left
coinsLabel.BorderSizePixel = 0
coinsLabel.Parent = screenGui

-- Eliminated overlay
local eliminatedFrame = Instance.new("Frame")
eliminatedFrame.Name = "Eliminated"
eliminatedFrame.Size = UDim2.new(1, 0, 1, 0)
eliminatedFrame.BackgroundColor3 = Color3.fromRGB(200, 30, 30)
eliminatedFrame.BackgroundTransparency = 0.7
eliminatedFrame.Visible = false
eliminatedFrame.Parent = screenGui

local eliminatedLabel = Instance.new("TextLabel")
eliminatedLabel.Size = UDim2.new(1, 0, 0, 60)
eliminatedLabel.Position = UDim2.new(0, 0, 0.4, 0)
eliminatedLabel.BackgroundTransparency = 1
eliminatedLabel.Text = "ELIMINATED"
eliminatedLabel.TextColor3 = Color3.new(1, 1, 1)
eliminatedLabel.TextSize = 48
eliminatedLabel.Font = Enum.Font.GothamBold
eliminatedLabel.Parent = eliminatedFrame

-- Results overlay
local resultsFrame = Instance.new("Frame")
resultsFrame.Name = "Results"
resultsFrame.Size = UDim2.new(0, 300, 0, 200)
resultsFrame.Position = UDim2.new(0.5, -150, 0.3, 0)
resultsFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
resultsFrame.BackgroundTransparency = 0.1
resultsFrame.Visible = false
resultsFrame.BorderSizePixel = 0
resultsFrame.Parent = screenGui

local resultsTitle = Instance.new("TextLabel")
resultsTitle.Size = UDim2.new(1, 0, 0, 40)
resultsTitle.BackgroundTransparency = 1
resultsTitle.Text = "Round Over!"
resultsTitle.TextColor3 = Color3.fromRGB(255, 220, 100)
resultsTitle.TextSize = 24
resultsTitle.Font = Enum.Font.GothamBold
resultsTitle.Parent = resultsFrame

local placeLabel = Instance.new("TextLabel")
placeLabel.Name = "Place"
placeLabel.Size = UDim2.new(1, 0, 0, 40)
placeLabel.Position = UDim2.new(0, 0, 0, 50)
placeLabel.BackgroundTransparency = 1
placeLabel.Text = ""
placeLabel.TextColor3 = Color3.new(1, 1, 1)
placeLabel.TextSize = 20
placeLabel.Font = Enum.Font.GothamBold
placeLabel.Parent = resultsFrame

local rewardLabel = Instance.new("TextLabel")
rewardLabel.Name = "Reward"
rewardLabel.Size = UDim2.new(1, 0, 0, 30)
rewardLabel.Position = UDim2.new(0, 0, 0, 100)
rewardLabel.BackgroundTransparency = 1
rewardLabel.Text = ""
rewardLabel.TextColor3 = Color3.fromRGB(100, 255, 100)
rewardLabel.TextSize = 16
rewardLabel.Font = Enum.Font.Gotham
rewardLabel.Parent = resultsFrame

-- Listen for round events
local roundEvent = ReplicatedStorage:WaitForChild("RoundEvent")
roundEvent.OnClientEvent:Connect(function(data)
	eliminatedFrame.Visible = false
	resultsFrame.Visible = false

	if data.type == "intermission" then
		statusLabel.Text = "Intermission"
		timerLabel.Text = data.time .. "s until next round"
	elseif data.type == "vote" then
		statusLabel.Text = "Vote for next minigame!"
		timerLabel.Text = data.time .. "s to vote"
	elseif data.type == "round_start" then
		statusLabel.Text = data.name
		timerLabel.Text = data.description
	elseif data.type == "eliminated" then
		eliminatedFrame.Visible = true
		task.delay(3, function() eliminatedFrame.Visible = false end)
	elseif data.type == "round_end" then
		resultsFrame.Visible = true
		local suffix = data.place == 1 and "st" or data.place == 2 and "nd" or data.place == 3 and "rd" or "th"
		placeLabel.Text = data.place .. suffix .. " place!"
		rewardLabel.Text = "+" .. data.reward .. " coins"
		task.delay(5, function() resultsFrame.Visible = false end)
	end
end)

print("MinigameUI loaded")
`;

const MINIGAMES_DATAMANAGER_SERVER_LUAU = `
-- DataManager: saves minigame wins and coins
local DataStoreService = game:GetService("DataStoreService")

local MAX_RETRIES = 3
local function withRetry(fn, label)
	for attempt = 1, MAX_RETRIES do
		local success, result = pcall(fn)
		if success then return true, result end
		if attempt < MAX_RETRIES then
			local backoff = math.pow(2, attempt)
			warn(string.format("[DataManager] %s failed (attempt %d/%d): %s", label, attempt, MAX_RETRIES, tostring(result)))
			task.wait(backoff)
		else
			warn(string.format("[DataManager] %s failed after %d attempts: %s", label, MAX_RETRIES, tostring(result)))
			return false, result
		end
	end
	return false, "Max retries"
end
local Players = game:GetService("Players")

local miniStore = DataStoreService:GetDataStore("MinigameData_v1")

local MAX_RETRIES = 3
local function withRetry(fn, label)
	for attempt = 1, MAX_RETRIES do
		local success, result = pcall(fn)
		if success then return true, result end
		if attempt < MAX_RETRIES then
			local backoff = math.pow(2, attempt)
			warn(string.format("[DataManager] %s failed (attempt %d/%d): %s", label, attempt, MAX_RETRIES, tostring(result)))
			task.wait(backoff)
		else
			warn(string.format("[DataManager] %s failed after %d attempts: %s", label, MAX_RETRIES, tostring(result)))
			return false, result
		end
	end
	return false, "Max retries"
end

local function savePlayerData(player)
	local key = "user_" .. player.UserId
	pcall(function()
		miniStore:SetAsync(key, { wins = 0, gamesPlayed = 0, coins = 0 })
	end)
end

Players.PlayerRemoving:Connect(savePlayerData)
game:BindToClose(function()
	for _, player in Players:GetPlayers() do savePlayerData(player) end
end)

print("DataManager loaded")
`;

const MINIGAMES_MINIGAMELOADER_SERVER_LUAU = `
--[[
	MinigameLoader.server.luau
	Handles loading/unloading arenas AND running game-specific logic.
	Called by RoundManager via BindableEvents.

	Each minigame:
	  1. Loads its arena (shows/hides parts)
	  2. Teleports players to spawn points
	  3. Runs game-specific mechanics
	  4. Eliminates players via the EliminatePlayer BindableEvent
]]
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerScriptService = game:GetService("ServerScriptService")

local MiniConfig = require(ReplicatedStorage:WaitForChild("MiniConfig"))

local activeArena = nil
local activeCleanup: (() -> ())? = nil

-- Get the RoundManager's eliminate event
local roundManager = ServerScriptService:WaitForChild("RoundManager")
local eliminateEvent = roundManager:WaitForChild("EliminatePlayer")

-- ── Arena management ──

local function loadArena(minigameName: string): Folder?
	unloadArena()
	local gamesFolder = workspace:FindFirstChild("Games")
	if not gamesFolder then return nil end

	local arenaName = minigameName:gsub(" ", "")
	for _, child in gamesFolder:GetChildren() do
		if child.Name == arenaName then
			activeArena = child
			for _, part in child:GetDescendants() do
				if part:IsA("BasePart") then
					part.Transparency = 0
					part.CanCollide = true
				end
			end
			return child
		end
	end
	return nil
end

function unloadArena()
	-- Run cleanup from previous minigame
	if activeCleanup then
		activeCleanup()
		activeCleanup = nil
	end

	if activeArena then
		for _, part in activeArena:GetDescendants() do
			if part:IsA("BasePart") then
				part.Transparency = 1
				part.CanCollide = false
			end
		end
		activeArena = nil
	end
end

local function teleportPlayersToArena(arena: Instance)
	local spawns = {}
	for _, child in arena:GetDescendants() do
		if child:IsA("SpawnLocation") then
			table.insert(spawns, child)
		end
	end

	if #spawns == 0 then
		-- Fallback: teleport to arena center
		for _, player in Players:GetPlayers() do
			local character = player.Character
			if character and character:FindFirstChild("HumanoidRootPart") then
				character.HumanoidRootPart.CFrame = CFrame.new(0, 10, 0)
			end
		end
		return
	end

	for i, player in Players:GetPlayers() do
		local character = player.Character
		if character and character:FindFirstChild("HumanoidRootPart") then
			local spawn = spawns[((i - 1) % #spawns) + 1]
			character.HumanoidRootPart.CFrame = spawn.CFrame + Vector3.new(0, 3, 0)
		end
	end
end

-- ── Minigame implementations ──

local function runFloorIsLava(arena: Instance)
	local floor = nil
	for _, child in arena:GetDescendants() do
		if CollectionService:HasTag(child, "DisappearFloor") or child.Name == "Floor" then
			floor = child
			break
		end
	end

	-- If no tagged floor, create a temporary one
	if not floor then
		floor = Instance.new("Part")
		floor.Name = "Floor"
		floor.Size = Vector3.new(60, 2, 60)
		floor.Position = Vector3.new(0, 0, 0)
		floor.Color = Color3.fromRGB(80, 200, 80)
		floor.Material = Enum.Material.Grass
		floor.Anchored = true
		floor.Parent = arena
	end

	local originalSize = floor.Size
	local running = true

	activeCleanup = function()
		running = false
		if floor and floor.Parent then
			floor.Size = originalSize
			floor.Transparency = 0
			floor.CanCollide = true
		end
	end

	task.spawn(function()
		task.wait(5)
		for i = 1, 20 do
			if not running then break end
			task.wait(2)
			if not floor or not floor.Parent then break end
			local shrink = 1 - (i / 25)
			floor.Size = Vector3.new(originalSize.X * shrink, originalSize.Y, originalSize.Z * shrink)
			floor.Color = Color3.fromRGB(
				math.min(255, 80 + i * 8),
				math.max(0, 200 - i * 10),
				80
			)
		end
		if floor and floor.Parent then
			floor.Transparency = 1
			floor.CanCollide = false
		end
	end)
end

local function runKingOfTheHill(arena: Instance)
	local hill = nil
	for _, child in arena:GetDescendants() do
		if child.Name == "Hill" or CollectionService:HasTag(child, "Hill") then
			hill = child
			break
		end
	end

	if not hill then
		hill = Instance.new("Part")
		hill.Name = "Hill"
		hill.Size = Vector3.new(12, 1, 12)
		hill.Position = Vector3.new(0, 5, 0)
		hill.Color = Color3.fromRGB(255, 215, 0)
		hill.Material = Enum.Material.Neon
		hill.Anchored = true
		hill.Parent = arena
	end

	local scores: { [Player]: number } = {}
	local running = true

	activeCleanup = function() running = false end

	task.spawn(function()
		while running do
			task.wait(1)
			-- Check who's on the hill
			for _, player in Players:GetPlayers() do
				local character = player.Character
				if not character then continue end
				local hrp = character:FindFirstChild("HumanoidRootPart")
				if not hrp then continue end

				local dist = (hrp.Position - hill.Position).Magnitude
				if dist < hill.Size.X then
					scores[player] = (scores[player] or 0) + 1
				end
			end
		end
	end)
end

local function runObbyRace(arena: Instance)
	-- First player to reach the finish line wins
	-- Others get eliminated when time runs out
	local finish = nil
	for _, child in arena:GetDescendants() do
		if child.Name == "FinishLine" or CollectionService:HasTag(child, "FinishLine") then
			finish = child
			break
		end
	end

	if not finish then
		finish = Instance.new("Part")
		finish.Name = "FinishLine"
		finish.Size = Vector3.new(20, 8, 2)
		finish.Position = Vector3.new(0, 4, 100)
		finish.Color = Color3.fromRGB(0, 255, 0)
		finish.Material = Enum.Material.Neon
		finish.Transparency = 0.5
		finish.Anchored = true
		finish.CanCollide = false
		finish.Parent = arena
	end

	local finished: { [Player]: boolean } = {}
	local conn: RBXScriptConnection? = nil

	conn = finish.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player or finished[player] then return end
		finished[player] = true
		-- First to finish is safe, rest get eliminated when time ends
	end)

	activeCleanup = function()
		if conn then conn:Disconnect() end
		-- Eliminate anyone who didn't finish
		for _, player in Players:GetPlayers() do
			if not finished[player] then
				eliminateEvent:Fire(player)
			end
		end
	end
end

local function runSwordFight(arena: Instance)
	-- Give everyone a sword tool, last standing wins
	local swords: { [Player]: Tool } = {}

	for _, player in Players:GetPlayers() do
		local character = player.Character
		if not character then continue end

		local sword = Instance.new("Tool")
		sword.Name = "Sword"
		sword.RequiresHandle = true

		local handle = Instance.new("Part")
		handle.Name = "Handle"
		handle.Size = Vector3.new(1, 0.5, 4)
		handle.Color = Color3.fromRGB(150, 150, 150)
		handle.Material = Enum.Material.Metal
		handle.Parent = sword

		sword.Parent = player.Backpack
		swords[player] = sword

		-- Sword damage on activation
		sword.Activated:Connect(function()
			local hrp = character:FindFirstChild("HumanoidRootPart")
			if not hrp then return end

			-- Damage nearby enemies
			for _, other in Players:GetPlayers() do
				if other == player then continue end
				local otherChar = other.Character
				if not otherChar then continue end
				local otherHRP = otherChar:FindFirstChild("HumanoidRootPart")
				if not otherHRP then continue end

				if (otherHRP.Position - hrp.Position).Magnitude < 8 then
					local humanoid = otherChar:FindFirstChildOfClass("Humanoid")
					if humanoid and humanoid.Health > 0 then
						humanoid:TakeDamage(25)
						if humanoid.Health <= 0 then
							eliminateEvent:Fire(other)
						end
					end
				end
			end
		end)
	end

	activeCleanup = function()
		for _, sword in pairs(swords) do
			if sword and sword.Parent then sword:Destroy() end
		end
	end
end

local function runFreezeTag(arena: Instance)
	-- Pick a random "it" player, they freeze others by touching them
	local players = Players:GetPlayers()
	if #players < 2 then return end

	local itPlayer = players[math.random(1, #players)]
	local frozen: { [Player]: boolean } = {}
	local running = true
	local connections: { RBXScriptConnection } = {}

	-- Notify "it" player
	local roundEvent = ReplicatedStorage:FindFirstChild("RoundEvent")
	if roundEvent then
		for _, player in players do
			roundEvent:FireClient(player, {
				type = "freeze_tag_role",
				isIt = player == itPlayer,
				itPlayer = itPlayer.Name,
			})
		end
	end

	-- Speed boost for "it"
	local itChar = itPlayer.Character
	if itChar then
		local humanoid = itChar:FindFirstChildOfClass("Humanoid")
		if humanoid then humanoid.WalkSpeed = 20 end
	end

	-- Detect "it" touching others
	task.spawn(function()
		while running do
			task.wait(0.2)
			local itCharNow = itPlayer.Character
			if not itCharNow then continue end
			local itHRP = itCharNow:FindFirstChild("HumanoidRootPart")
			if not itHRP then continue end

			for _, player in Players:GetPlayers() do
				if player == itPlayer or frozen[player] then continue end
				local char = player.Character
				if not char then continue end
				local hrp = char:FindFirstChild("HumanoidRootPart")
				if not hrp then continue end

				if (hrp.Position - itHRP.Position).Magnitude < 5 then
					frozen[player] = true
					local humanoid = char:FindFirstChildOfClass("Humanoid")
					if humanoid then
						humanoid.WalkSpeed = 0
						humanoid.JumpPower = 0
					end

					-- Check if all frozen
					local unfrozenCount = 0
					for _, p in Players:GetPlayers() do
						if p ~= itPlayer and not frozen[p] then
							unfrozenCount += 1
						end
					end
					if unfrozenCount == 0 then
						-- "It" wins - eliminate everyone else
						for _, p in Players:GetPlayers() do
							if p ~= itPlayer then
								eliminateEvent:Fire(p)
							end
						end
						break
					end
				end
			end
		end
	end)

	activeCleanup = function()
		running = false
		-- Restore walk speeds
		for _, player in Players:GetPlayers() do
			local char = player.Character
			if char then
				local humanoid = char:FindFirstChildOfClass("Humanoid")
				if humanoid then
					humanoid.WalkSpeed = 16
					humanoid.JumpPower = 50
				end
			end
		end
		for _, conn in connections do conn:Disconnect() end
	end
end

local function runSimonSays(arena: Instance)
	-- Create colored pads, announce a color, players must stand on it
	local padColors = {
		{ name = "Red", color = Color3.fromRGB(255, 50, 50) },
		{ name = "Blue", color = Color3.fromRGB(50, 50, 255) },
		{ name = "Green", color = Color3.fromRGB(50, 255, 50) },
		{ name = "Yellow", color = Color3.fromRGB(255, 255, 50) },
	}

	local pads: { [string]: BasePart } = {}
	local running = true

	-- Create or find color pads
	for i, pc in ipairs(padColors) do
		local existing = nil
		for _, child in arena:GetDescendants() do
			if child.Name == pc.name .. "Pad" then
				existing = child
				break
			end
		end

		if not existing then
			existing = Instance.new("Part")
			existing.Name = pc.name .. "Pad"
			existing.Size = Vector3.new(15, 1, 15)
			existing.Color = pc.color
			existing.Material = Enum.Material.Neon
			existing.Anchored = true
			local angle = (i - 1) * (math.pi * 2 / #padColors)
			existing.Position = Vector3.new(math.cos(angle) * 20, 0, math.sin(angle) * 20)
			existing.Parent = arena
		end

		pads[pc.name] = existing
	end

	local roundEvent = ReplicatedStorage:FindFirstChild("RoundEvent")

	activeCleanup = function() running = false end

	task.spawn(function()
		task.wait(3)
		for round = 1, 10 do
			if not running then break end

			-- Pick a random color
			local target = padColors[math.random(1, #padColors)]

			-- Announce
			if roundEvent then
				for _, player in Players:GetPlayers() do
					roundEvent:FireClient(player, {
						type = "simon_says",
						command = "Stand on " .. target.name .. "!",
						timeLimit = math.max(3, 6 - round * 0.3),
					})
				end
			end

			-- Wait for time limit
			local timeLimit = math.max(3, 6 - round * 0.3)
			task.wait(timeLimit)

			-- Eliminate players NOT on the correct pad
			local pad = pads[target.name]
			if pad then
				for _, player in Players:GetPlayers() do
					local char = player.Character
					if not char then continue end
					local hrp = char:FindFirstChild("HumanoidRootPart")
					if not hrp then continue end

					local dx = math.abs(hrp.Position.X - pad.Position.X)
					local dz = math.abs(hrp.Position.Z - pad.Position.Z)
					if dx > pad.Size.X / 2 + 2 or dz > pad.Size.Z / 2 + 2 then
						eliminateEvent:Fire(player)
					end
				end
			end

			task.wait(2)
		end
	end)
end

-- ── Minigame dispatcher ──

local minigameHandlers = {
	["Floor is Lava"] = runFloorIsLava,
	["King of the Hill"] = runKingOfTheHill,
	["Obby Race"] = runObbyRace,
	["Sword Fight"] = runSwordFight,
	["Freeze Tag"] = runFreezeTag,
	["Simon Says"] = runSimonSays,
}

-- Listen for round lifecycle from RoundManager
local roundStartEvent = Instance.new("BindableEvent")
roundStartEvent.Name = "StartMinigame"
roundStartEvent.Parent = script

roundStartEvent.Event:Connect(function(minigameName)
	local arena = loadArena(minigameName)
	if arena then
		teleportPlayersToArena(arena)
	end

	local handler = minigameHandlers[minigameName]
	if handler then
		if arena then
			handler(arena)
		else
			-- Create temporary arena
			local tempArena = Instance.new("Folder")
			tempArena.Name = "TempArena"
			tempArena.Parent = workspace
			handler(tempArena)
		end
	end
end)

-- Clean up between rounds
local roundEndEvent = Instance.new("BindableEvent")
roundEndEvent.Name = "EndMinigame"
roundEndEvent.Parent = script

roundEndEvent.Event:Connect(function()
	unloadArena()
end)
`;

const MINIGAMES_ROUNDMANAGER_SERVER_LUAU = `
-- RoundManager: handles intermission, voting, round lifecycle, and results
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local MiniConfig = require(ReplicatedStorage:WaitForChild("MiniConfig"))

local roundEvent = Instance.new("RemoteEvent")
roundEvent.Name = "RoundEvent"
roundEvent.Parent = ReplicatedStorage

local voteEvent = Instance.new("RemoteEvent")
voteEvent.Name = "VoteEvent"
voteEvent.Parent = ReplicatedStorage

local currentRound = nil
local votes = {}
local alive = {}

local function getRandomMinigames(count)
	local shuffled = {}
	for _, mg in ipairs(MiniConfig.Minigames) do
		table.insert(shuffled, mg)
	end
	for i = #shuffled, 2, -1 do
		local j = math.random(1, i)
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	end
	local result = {}
	for i = 1, math.min(count, #shuffled) do
		table.insert(result, shuffled[i])
	end
	return result
end

local function startIntermission()
	-- Reset
	currentRound = nil
	votes = {}
	alive = {}

	for _, player in Players:GetPlayers() do
		roundEvent:FireClient(player, { type = "intermission", time = MiniConfig.IntermissionTime })
		-- Teleport to lobby
		local character = player.Character
		if character then
			local root = character:FindFirstChild("HumanoidRootPart")
			if root then
				root.CFrame = CFrame.new(0, 5, 0)
			end
		end
	end

	task.wait(MiniConfig.IntermissionTime - MiniConfig.VotingTime)

	-- Voting phase
	local options = getRandomMinigames(3)
	for _, player in Players:GetPlayers() do
		roundEvent:FireClient(player, {
			type = "vote",
			options = options,
			time = MiniConfig.VotingTime,
		})
	end

	task.wait(MiniConfig.VotingTime)

	-- Tally votes
	local voteCounts = {}
	for _, minigameName in pairs(votes) do
		voteCounts[minigameName] = (voteCounts[minigameName] or 0) + 1
	end

	local winner = options[1]
	local bestCount = 0
	for name, count in pairs(voteCounts) do
		if count > bestCount then
			bestCount = count
			winner = nil
			for _, o in ipairs(options) do
				if o.Name == name then winner = o; break end
			end
		end
	end

	if not winner then winner = options[1] end
	startRound(winner)
end

function startRound(minigame)
	currentRound = {
		minigame = minigame,
		startTime = tick(),
		players = {},
	}

	alive = {}
	for _, player in Players:GetPlayers() do
		table.insert(currentRound.players, player)
		alive[player] = true
	end

	for _, player in Players:GetPlayers() do
		roundEvent:FireClient(player, {
			type = "round_start",
			name = minigame.Name,
			description = minigame.Description,
			duration = minigame.Duration,
		})
	end

	-- Round timer
	task.wait(minigame.Duration)
	endRound()
end

function endRound()
	if not currentRound then return end

	-- Find survivors/winners
	local survivors = {}
	for player, isAlive in pairs(alive) do
		if isAlive then
			table.insert(survivors, player)
		end
	end

	-- Distribute rewards
	for i, player in ipairs(currentRound.players) do
		local reward = MiniConfig.Rewards.Participation
		local place = #currentRound.players
		if alive[player] then
			local rank = 0
			for _, s in ipairs(survivors) do
				rank = rank + 1
				if s == player then break end
			end
			place = rank
			if rank == 1 then reward = MiniConfig.Rewards.Win
			elseif rank == 2 then reward = MiniConfig.Rewards.SecondPlace
			elseif rank == 3 then reward = MiniConfig.Rewards.ThirdPlace end
		end

		roundEvent:FireClient(player, {
			type = "round_end",
			place = place,
			reward = reward,
			minigame = currentRound.minigame.Name,
			totalPlayers = #currentRound.players,
		})
	end

	currentRound = nil
	task.wait(5)
	startIntermission()
end

-- Vote handling
voteEvent.OnServerEvent:Connect(function(player, minigameName)
	votes[player] = minigameName
end)

-- Player elimination (called by minigame scripts)
local eliminateEvent = Instance.new("BindableEvent")
eliminateEvent.Name = "EliminatePlayer"
eliminateEvent.Parent = script
eliminateEvent.Event:Connect(function(player)
	alive[player] = false
	roundEvent:FireClient(player, { type = "eliminated" })
	-- Check if only 1 left
	local aliveCount = 0
	for _, isAlive in pairs(alive) do
		if isAlive then aliveCount = aliveCount + 1 end
	end
	if aliveCount <= 1 and currentRound then
		endRound()
	end
end)

-- Kill brick elimination
local CollectionService = game:GetService("CollectionService")
for _, brick in CollectionService:GetTagged("KillBrick") do
	brick.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if player and alive[player] then
			alive[player] = false
			local humanoid = hit.Parent:FindFirstChild("Humanoid")
			if humanoid then humanoid.Health = 0 end
			roundEvent:FireClient(player, { type = "eliminated" })
		end
	end)
end

-- Start the game loop
task.spawn(function()
	task.wait(3)
	startIntermission()
end)

print("RoundManager loaded")
`;

const MINIGAMES_MINICONFIG_LUAU = `
local MiniConfig = {}

MiniConfig.IntermissionTime = 15
MiniConfig.MinPlayers = 2
MiniConfig.MaxPlayers = 16
MiniConfig.RoundTime = 60
MiniConfig.VotingTime = 10

MiniConfig.Minigames = {
	{
		Name = "Floor is Lava",
		Description = "The floor disappears! Last one standing wins.",
		Duration = 45,
		MinPlayers = 2,
		Type = "survival",
	},
	{
		Name = "King of the Hill",
		Description = "Stay on the platform the longest to win!",
		Duration = 60,
		MinPlayers = 2,
		Type = "survival",
	},
	{
		Name = "Freeze Tag",
		Description = "One player is 'it' — freeze everyone to win!",
		Duration = 90,
		MinPlayers = 3,
		Type = "tag",
	},
	{
		Name = "Obby Race",
		Description = "Race through the obstacle course — first to finish wins!",
		Duration = 60,
		MinPlayers = 2,
		Type = "race",
	},
	{
		Name = "Sword Fight",
		Description = "Last player standing in a sword duel wins!",
		Duration = 60,
		MinPlayers = 2,
		Type = "combat",
	},
	{
		Name = "Simon Says",
		Description = "Follow the commands — do the wrong thing and you're out!",
		Duration = 90,
		MinPlayers = 3,
		Type = "elimination",
	},
}

MiniConfig.Rewards = {
	Win = 100,
	SecondPlace = 50,
	ThirdPlace = 25,
	Participation = 10,
}

MiniConfig.Titles = {
	{ Name = "Rookie", WinsRequired = 0 },
	{ Name = "Competitor", WinsRequired = 10 },
	{ Name = "Champion", WinsRequired = 50 },
	{ Name = "Legend", WinsRequired = 100 },
	{ Name = "Minigame God", WinsRequired = 500 },
}

return MiniConfig
`;

export function getMinigamesScripts(): ScriptFile[] {
  return [
    { relativePath: "src/client/MinigameUI.client.luau", name: "MinigameUI", scriptType: "client", content: MINIGAMES_MINIGAMEUI_CLIENT_LUAU },
    { relativePath: "src/server/DataManager.server.luau", name: "DataManager", scriptType: "server", content: MINIGAMES_DATAMANAGER_SERVER_LUAU },
    { relativePath: "src/server/MinigameLoader.server.luau", name: "MinigameLoader", scriptType: "server", content: MINIGAMES_MINIGAMELOADER_SERVER_LUAU },
    { relativePath: "src/server/PlatformBehaviors.server.luau", name: "PlatformBehaviors", scriptType: "server", content: PLATFORM_BEHAVIORS },
    { relativePath: "src/server/RoundManager.server.luau", name: "RoundManager", scriptType: "server", content: MINIGAMES_ROUNDMANAGER_SERVER_LUAU },
    { relativePath: "src/shared/MiniConfig.luau", name: "MiniConfig", scriptType: "module", content: MINIGAMES_MINICONFIG_LUAU },
    { relativePath: "src/shared/RateLimit.luau", name: "RateLimit", scriptType: "module", content: RATE_LIMIT },
  ];
}

// ── Incremental Template Scripts ──

const INCREMENTAL_CONFIG = `
local IncrementalConfig = {}

IncrementalConfig.GameName = "My Incremental"

IncrementalConfig.Currencies = {
	{ name = "Coins", startAmount = 0, icon = "coin" },
	{ name = "PrestigePoints", startAmount = 0, icon = "star" },
	{ name = "AscensionTokens", startAmount = 0, icon = "gem" },
}

IncrementalConfig.BaseClickValue = 1

IncrementalConfig.Upgrades = {
	{
		id = "clickPower",
		name = "Click Power",
		description = "Increase coins per click",
		baseCost = 10,
		costMultiplier = 1.15,
		effect = "clickValue",
		effectPerLevel = 1,
	},
	{
		id = "autoClicker",
		name = "Auto Clicker",
		description = "Earn coins automatically every second",
		baseCost = 50,
		costMultiplier = 1.2,
		effect = "autoClickRate",
		effectPerLevel = 0.5,
	},
	{
		id = "autoFarm",
		name = "Auto Farm",
		description = "Earn coins from unlocked zones passively",
		baseCost = 500,
		costMultiplier = 1.25,
		effect = "autoFarmRate",
		effectPerLevel = 1,
	},
	{
		id = "multiplier",
		name = "Multiplier",
		description = "Multiply all coin earnings",
		baseCost = 1000,
		costMultiplier = 1.5,
		effect = "multiplier",
		effectPerLevel = 0.1,
	},
}

IncrementalConfig.PrestigeLayers = {
	{
		name = "Prestige",
		currency = "Coins",
		requirement = 1000000,
		reward = "PrestigePoints",
		rewardAmount = 1,
		multiplierBonus = 0.5,
		resets = { "Coins", "upgrades" },
	},
	{
		name = "Ascension",
		currency = "PrestigePoints",
		requirement = 100,
		reward = "AscensionTokens",
		rewardAmount = 1,
		multiplierBonus = 2.0,
		resets = { "Coins", "PrestigePoints", "upgrades" },
	},
	{
		name = "Transcendence",
		currency = "AscensionTokens",
		requirement = 10,
		reward = nil,
		rewardAmount = 0,
		multiplierBonus = 10.0,
		resets = { "Coins", "PrestigePoints", "AscensionTokens", "upgrades" },
	},
}

IncrementalConfig.OfflineEarnings = {
	Enabled = true,
	MaxHours = 8,
	RateMultiplier = 0.5,
}

IncrementalConfig.Zones = {
	{ name = "Starter Field", coinThreshold = 0, multiplier = 1 },
	{ name = "Crystal Mine", coinThreshold = 10000, multiplier = 3 },
	{ name = "Lava Forge", coinThreshold = 100000, multiplier = 10 },
	{ name = "Sky Islands", coinThreshold = 1000000, multiplier = 50 },
	{ name = "Void Realm", coinThreshold = 100000000, multiplier = 500 },
}

return IncrementalConfig
`;

const INCREMENTAL_MANAGER = `
-- IncrementalManager: core idle game loop
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local CollectionService = game:GetService("CollectionService")

local IncrementalConfig = require(ReplicatedStorage:WaitForChild("IncrementalConfig"))
local RateLimit = require(ReplicatedStorage:WaitForChild("RateLimit"))

-- RemoteEvents
local clickEvent = Instance.new("RemoteEvent")
clickEvent.Name = "Click"
clickEvent.Parent = ReplicatedStorage

local upgradeEvent = Instance.new("RemoteEvent")
upgradeEvent.Name = "BuyUpgrade"
upgradeEvent.Parent = ReplicatedStorage

local unlockZoneEvent = Instance.new("RemoteEvent")
unlockZoneEvent.Name = "UnlockZone"
unlockZoneEvent.Parent = ReplicatedStorage

local updateStatsEvent = Instance.new("RemoteEvent")
updateStatsEvent.Name = "UpdateStats"
updateStatsEvent.Parent = ReplicatedStorage

-- Player data
local playerData: { [Player]: {
	coins: number,
	prestigePoints: number,
	ascensionTokens: number,
	upgradeLevels: { [string]: number },
	unlockedZones: { [string]: boolean },
	prestigeCount: { [number]: number },
	totalMultiplier: number,
} } = {}

local function getUpgradeCost(upgradeId: string, currentLevel: number): number
	for _, upgrade in IncrementalConfig.Upgrades do
		if upgrade.id == upgradeId then
			return math.floor(upgrade.baseCost * upgrade.costMultiplier ^ currentLevel)
		end
	end
	return math.huge
end

local function calculateMultiplier(data: any): number
	local mult = 1.0
	-- Upgrade multiplier
	local multLevel = data.upgradeLevels["multiplier"] or 0
	mult = mult + multLevel * 0.1
	-- Prestige multipliers
	for i, layer in IncrementalConfig.PrestigeLayers do
		local count = data.prestigeCount[i] or 0
		mult = mult + count * layer.multiplierBonus
	end
	return mult
end

local function getClickValue(data: any): number
	local base = IncrementalConfig.BaseClickValue
	local clickLevel = data.upgradeLevels["clickPower"] or 0
	return (base + clickLevel) * data.totalMultiplier
end

local function getAutoRate(data: any): number
	local autoLevel = data.upgradeLevels["autoClicker"] or 0
	return autoLevel * 0.5 * data.totalMultiplier
end

local function getAutoFarmRate(data: any): number
	local farmLevel = data.upgradeLevels["autoFarm"] or 0
	if farmLevel == 0 then return 0 end
	local zoneMultiplier = 0
	for _, zone in IncrementalConfig.Zones do
		if data.unlockedZones[zone.name] then
			zoneMultiplier = zoneMultiplier + zone.multiplier
		end
	end
	return farmLevel * zoneMultiplier * data.totalMultiplier
end

local function sendStats(player: Player)
	local data = playerData[player]
	if not data then return end
	updateStatsEvent:FireClient(player, {
		coins = data.coins,
		prestigePoints = data.prestigePoints,
		ascensionTokens = data.ascensionTokens,
		upgradeLevels = data.upgradeLevels,
		unlockedZones = data.unlockedZones,
		multiplier = data.totalMultiplier,
		clickValue = getClickValue(data),
		autoRate = getAutoRate(data),
		farmRate = getAutoFarmRate(data),
	})
end

local function setupPlayer(player: Player)
	local data = {
		coins = 0,
		prestigePoints = 0,
		ascensionTokens = 0,
		upgradeLevels = {},
		unlockedZones = { ["Starter Field"] = true },
		prestigeCount = {},
		totalMultiplier = 1.0,
	}
	data.totalMultiplier = calculateMultiplier(data)
	playerData[player] = data

	-- Leaderstats
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	leaderstats.Parent = player

	local coinsVal = Instance.new("IntValue")
	coinsVal.Name = "Coins"
	coinsVal.Value = 0
	coinsVal.Parent = leaderstats

	sendStats(player)
end

-- Click handler
clickEvent.OnServerEvent:Connect(function(player)
	if not RateLimit.check(player, "click", 0.05) then return end
	local data = playerData[player]
	if not data then return end

	local earned = getClickValue(data)
	data.coins = data.coins + earned

	local leaderstats = player:FindFirstChild("leaderstats")
	if leaderstats then
		local cv = leaderstats:FindFirstChild("Coins")
		if cv then cv.Value = math.floor(data.coins) end
	end

	sendStats(player)
end)

-- Upgrade handler
upgradeEvent.OnServerEvent:Connect(function(player, upgradeId: string)
	if not RateLimit.check(player, "upgrade", 0.2) then return end
	local data = playerData[player]
	if not data then return end

	local currentLevel = data.upgradeLevels[upgradeId] or 0
	local cost = getUpgradeCost(upgradeId, currentLevel)

	if data.coins >= cost then
		data.coins = data.coins - cost
		data.upgradeLevels[upgradeId] = currentLevel + 1
		data.totalMultiplier = calculateMultiplier(data)
		sendStats(player)
	end
end)

-- Zone unlock handler
unlockZoneEvent.OnServerEvent:Connect(function(player, zoneName: string)
	if not RateLimit.check(player, "zone", 0.5) then return end
	local data = playerData[player]
	if not data then return end
	if data.unlockedZones[zoneName] then return end

	for _, zone in IncrementalConfig.Zones do
		if zone.name == zoneName and data.coins >= zone.coinThreshold then
			data.unlockedZones[zoneName] = true
			sendStats(player)
			break
		end
	end
end)

-- Auto-click loop (every 1 second)
task.spawn(function()
	while true do
		task.wait(1)
		for player, data in playerData do
			local autoRate = getAutoRate(data)
			if autoRate > 0 then
				data.coins = data.coins + autoRate
				local leaderstats = player:FindFirstChild("leaderstats")
				if leaderstats then
					local cv = leaderstats:FindFirstChild("Coins")
					if cv then cv.Value = math.floor(data.coins) end
				end
			end
		end
	end
end)

-- Auto-farm loop (every 5 seconds)
task.spawn(function()
	while true do
		task.wait(5)
		for player, data in playerData do
			local farmRate = getAutoFarmRate(data)
			if farmRate > 0 then
				data.coins = data.coins + farmRate * 5
				local leaderstats = player:FindFirstChild("leaderstats")
				if leaderstats then
					local cv = leaderstats:FindFirstChild("Coins")
					if cv then cv.Value = math.floor(data.coins) end
				end
			end
		end
	end
end)

-- Expose data for other scripts
local getDataFunction = Instance.new("BindableFunction")
getDataFunction.Name = "GetPlayerData"
getDataFunction.Parent = ReplicatedStorage
getDataFunction.OnInvoke = function(player)
	return playerData[player]
end

Players.PlayerAdded:Connect(setupPlayer)
Players.PlayerRemoving:Connect(function(player)
	playerData[player] = nil
end)

print("IncrementalManager loaded")
`;

const INCREMENTAL_PRESTIGE_MANAGER = `
-- PrestigeManager: multi-layer prestige/ascension system
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local IncrementalConfig = require(ReplicatedStorage:WaitForChild("IncrementalConfig"))
local RateLimit = require(ReplicatedStorage:WaitForChild("RateLimit"))

local prestigeEvent = Instance.new("RemoteEvent")
prestigeEvent.Name = "Prestige"
prestigeEvent.Parent = ReplicatedStorage

local updateStatsEvent = ReplicatedStorage:WaitForChild("UpdateStats")

local function getPlayerData(player: Player)
	local getData = ReplicatedStorage:FindFirstChild("GetPlayerData")
	if getData and getData:IsA("BindableFunction") then
		return getData:Invoke(player)
	end
	return nil
end

local function getCurrencyValue(data: any, currencyName: string): number
	if currencyName == "Coins" then return data.coins end
	if currencyName == "PrestigePoints" then return data.prestigePoints end
	if currencyName == "AscensionTokens" then return data.ascensionTokens end
	return 0
end

local function setCurrencyValue(data: any, currencyName: string, value: number)
	if currencyName == "Coins" then data.coins = value end
	if currencyName == "PrestigePoints" then data.prestigePoints = value end
	if currencyName == "AscensionTokens" then data.ascensionTokens = value end
end

prestigeEvent.OnServerEvent:Connect(function(player, layerIndex: number)
	if not RateLimit.check(player, "prestige", 1) then return end

	local data = getPlayerData(player)
	if not data then return end

	local layer = IncrementalConfig.PrestigeLayers[layerIndex]
	if not layer then return end

	local currentAmount = getCurrencyValue(data, layer.currency)
	if currentAmount < layer.requirement then return end

	-- Award prestige reward
	if layer.reward then
		local currentReward = getCurrencyValue(data, layer.reward)
		setCurrencyValue(data, layer.reward, currentReward + layer.rewardAmount)
	end

	-- Track prestige count
	data.prestigeCount[layerIndex] = (data.prestigeCount[layerIndex] or 0) + 1

	-- Reset specified currencies and upgrades
	for _, resetTarget in layer.resets do
		if resetTarget == "upgrades" then
			data.upgradeLevels = {}
		else
			setCurrencyValue(data, resetTarget, 0)
		end
	end

	-- Recalculate multiplier
	local mult = 1.0
	for i, l in IncrementalConfig.PrestigeLayers do
		local count = data.prestigeCount[i] or 0
		mult = mult + count * l.multiplierBonus
	end
	local multLevel = data.upgradeLevels["multiplier"] or 0
	mult = mult + multLevel * 0.1
	data.totalMultiplier = mult

	-- Update leaderstats
	local leaderstats = player:FindFirstChild("leaderstats")
	if leaderstats then
		local cv = leaderstats:FindFirstChild("Coins")
		if cv then cv.Value = math.floor(data.coins) end
	end

	-- Notify client
	updateStatsEvent:FireClient(player, {
		coins = data.coins,
		prestigePoints = data.prestigePoints,
		ascensionTokens = data.ascensionTokens,
		upgradeLevels = data.upgradeLevels,
		unlockedZones = data.unlockedZones,
		multiplier = data.totalMultiplier,
		prestigeComplete = true,
		layerName = layer.name,
	})
end)

print("PrestigeManager loaded")
`;

const INCREMENTAL_OFFLINE_EARNINGS = `
-- OfflineEarnings: calculates and awards earnings while player was away
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local IncrementalConfig = require(ReplicatedStorage:WaitForChild("IncrementalConfig"))

local offlineEvent = Instance.new("RemoteEvent")
offlineEvent.Name = "OfflineEarnings"
offlineEvent.Parent = ReplicatedStorage

local function getPlayerData(player: Player)
	local getData = ReplicatedStorage:WaitForChild("GetPlayerData", 10)
	if getData and getData:IsA("BindableFunction") then
		return getData:Invoke(player)
	end
	return nil
end

Players.PlayerAdded:Connect(function(player)
	if not IncrementalConfig.OfflineEarnings.Enabled then return end

	task.wait(2) -- Wait for data to load

	local data = getPlayerData(player)
	if not data or not data._lastLoginTime then return end

	local elapsed = os.time() - data._lastLoginTime
	local maxSeconds = IncrementalConfig.OfflineEarnings.MaxHours * 3600
	elapsed = math.min(elapsed, maxSeconds)

	if elapsed < 60 then return end -- Less than a minute, skip

	-- Calculate offline earnings based on auto rates
	local autoLevel = data.upgradeLevels["autoClicker"] or 0
	local farmLevel = data.upgradeLevels["autoFarm"] or 0
	local autoRate = autoLevel * 0.5 * data.totalMultiplier

	local zoneMultiplier = 0
	for _, zone in IncrementalConfig.Zones do
		if data.unlockedZones[zone.name] then
			zoneMultiplier = zoneMultiplier + zone.multiplier
		end
	end
	local farmRate = farmLevel * zoneMultiplier * data.totalMultiplier

	local totalRate = autoRate + farmRate
	if totalRate <= 0 then return end

	local earnings = math.floor(totalRate * elapsed * IncrementalConfig.OfflineEarnings.RateMultiplier)
	if earnings <= 0 then return end

	data.coins = data.coins + earnings
	local leaderstats = player:FindFirstChild("leaderstats")
	if leaderstats then
		local cv = leaderstats:FindFirstChild("Coins")
		if cv then cv.Value = math.floor(data.coins) end
	end

	-- Notify client for welcome back popup
	offlineEvent:FireClient(player, {
		earnings = earnings,
		elapsedMinutes = math.floor(elapsed / 60),
	})
end)

-- Save login time on leave
Players.PlayerRemoving:Connect(function(player)
	local data = getPlayerData(player)
	if data then
		data._lastLoginTime = os.time()
	end
end)

print("OfflineEarnings loaded")
`;

const INCREMENTAL_DATA_MANAGER = `
-- DataManager: saves and loads incremental game progress
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local store = DataStoreService:GetDataStore("IncrementalData_v1")

local function withRetry(fn, maxRetries: number?)
	local retries = maxRetries or 3
	for i = 1, retries do
		local ok, result = pcall(fn)
		if ok then return result end
		if i < retries then task.wait(1) end
	end
	return nil
end

local function getPlayerData(player: Player)
	local getData = ReplicatedStorage:FindFirstChild("GetPlayerData")
	if getData and getData:IsA("BindableFunction") then
		return getData:Invoke(player)
	end
	return nil
end

local function savePlayer(player: Player)
	local data = getPlayerData(player)
	if not data then return end

	local saveData = {
		coins = data.coins,
		prestigePoints = data.prestigePoints,
		ascensionTokens = data.ascensionTokens,
		upgradeLevels = data.upgradeLevels,
		unlockedZones = data.unlockedZones,
		prestigeCount = data.prestigeCount,
		lastLoginTime = os.time(),
	}

	withRetry(function()
		store:SetAsync("player_" .. player.UserId, saveData)
	end)
end

local function loadPlayer(player: Player)
	local saved = withRetry(function()
		return store:GetAsync("player_" .. player.UserId)
	end)

	if not saved then return end

	-- Wait for IncrementalManager to set up player data
	task.wait(1)
	local data = getPlayerData(player)
	if not data then return end

	data.coins = saved.coins or 0
	data.prestigePoints = saved.prestigePoints or 0
	data.ascensionTokens = saved.ascensionTokens or 0
	data.upgradeLevels = saved.upgradeLevels or {}
	data.unlockedZones = saved.unlockedZones or { ["Starter Field"] = true }
	data.prestigeCount = saved.prestigeCount or {}
	data._lastLoginTime = saved.lastLoginTime

	-- Recalculate multiplier from loaded data
	local mult = 1.0
	local IncrementalConfig = require(ReplicatedStorage:WaitForChild("IncrementalConfig"))
	for i, layer in IncrementalConfig.PrestigeLayers do
		local count = data.prestigeCount[i] or 0
		mult = mult + count * layer.multiplierBonus
	end
	local multLevel = data.upgradeLevels["multiplier"] or 0
	mult = mult + multLevel * 0.1
	data.totalMultiplier = mult

	-- Update leaderstats
	local leaderstats = player:FindFirstChild("leaderstats")
	if leaderstats then
		local cv = leaderstats:FindFirstChild("Coins")
		if cv then cv.Value = math.floor(data.coins) end
	end
end

Players.PlayerAdded:Connect(function(player)
	task.spawn(loadPlayer, player)
end)

Players.PlayerRemoving:Connect(savePlayer)

-- Auto-save every 5 minutes
task.spawn(function()
	while true do
		task.wait(300)
		for _, player in Players:GetPlayers() do
			task.spawn(savePlayer, player)
		end
	end
end)

-- Save all on shutdown
game:BindToClose(function()
	for _, player in Players:GetPlayers() do
		savePlayer(player)
	end
end)

print("DataManager (Incremental) loaded")
`;

const INCREMENTAL_UI = `
-- IncrementalUI: client-side HUD for incremental game
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local updateStatsEvent = ReplicatedStorage:WaitForChild("UpdateStats")
local clickEvent = ReplicatedStorage:WaitForChild("Click")
local upgradeEvent = ReplicatedStorage:WaitForChild("BuyUpgrade")
local prestigeEvent = ReplicatedStorage:WaitForChild("Prestige")
local offlineEvent = ReplicatedStorage:WaitForChild("OfflineEarnings")

-- Create HUD
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "IncrementalHUD"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Currency display
local topBar = Instance.new("Frame")
topBar.Size = UDim2.new(1, 0, 0, 40)
topBar.Position = UDim2.new(0, 0, 0, 0)
topBar.BackgroundColor3 = Color3.fromRGB(20, 20, 30)
topBar.BackgroundTransparency = 0.3
topBar.BorderSizePixel = 0
topBar.Parent = screenGui

local coinsLabel = Instance.new("TextLabel")
coinsLabel.Size = UDim2.new(0.3, 0, 1, 0)
coinsLabel.Position = UDim2.new(0.05, 0, 0, 0)
coinsLabel.BackgroundTransparency = 1
coinsLabel.Text = "Coins: 0"
coinsLabel.TextColor3 = Color3.fromRGB(255, 215, 0)
coinsLabel.TextSize = 18
coinsLabel.Font = Enum.Font.GothamBold
coinsLabel.TextXAlignment = Enum.TextXAlignment.Left
coinsLabel.Parent = topBar

local multiplierLabel = Instance.new("TextLabel")
multiplierLabel.Size = UDim2.new(0.2, 0, 1, 0)
multiplierLabel.Position = UDim2.new(0.7, 0, 0, 0)
multiplierLabel.BackgroundTransparency = 1
multiplierLabel.Text = "x1.0"
multiplierLabel.TextColor3 = Color3.fromRGB(100, 255, 100)
multiplierLabel.TextSize = 16
multiplierLabel.Font = Enum.Font.GothamBold
multiplierLabel.TextXAlignment = Enum.TextXAlignment.Right
multiplierLabel.Parent = topBar

local function formatNumber(n: number): string
	if n >= 1e12 then return string.format("%.1fT", n / 1e12) end
	if n >= 1e9 then return string.format("%.1fB", n / 1e9) end
	if n >= 1e6 then return string.format("%.1fM", n / 1e6) end
	if n >= 1e3 then return string.format("%.1fK", n / 1e3) end
	return tostring(math.floor(n))
end

-- Update HUD on stat changes
updateStatsEvent.OnClientEvent:Connect(function(stats)
	coinsLabel.Text = "Coins: " .. formatNumber(stats.coins)
	multiplierLabel.Text = string.format("x%.1f", stats.multiplier)

	if stats.prestigeComplete then
		-- Flash screen gold for prestige celebration
		local flash = Instance.new("Frame")
		flash.Size = UDim2.new(1, 0, 1, 0)
		flash.BackgroundColor3 = Color3.fromRGB(255, 215, 0)
		flash.BackgroundTransparency = 0.5
		flash.Parent = screenGui
		task.delay(0.5, function() flash:Destroy() end)
	end
end)

-- Offline earnings popup
offlineEvent.OnClientEvent:Connect(function(info)
	local popup = Instance.new("Frame")
	popup.Size = UDim2.new(0.4, 0, 0.2, 0)
	popup.Position = UDim2.new(0.3, 0, 0.4, 0)
	popup.BackgroundColor3 = Color3.fromRGB(30, 30, 50)
	popup.BorderSizePixel = 0
	popup.Parent = screenGui

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 12)
	corner.Parent = popup

	local title = Instance.new("TextLabel")
	title.Size = UDim2.new(1, 0, 0.4, 0)
	title.BackgroundTransparency = 1
	title.Text = "Welcome Back!"
	title.TextColor3 = Color3.fromRGB(255, 215, 0)
	title.TextSize = 24
	title.Font = Enum.Font.GothamBold
	title.Parent = popup

	local body = Instance.new("TextLabel")
	body.Size = UDim2.new(1, 0, 0.4, 0)
	body.Position = UDim2.new(0, 0, 0.4, 0)
	body.BackgroundTransparency = 1
	body.Text = "You earned " .. formatNumber(info.earnings) .. " coins while away! (" .. info.elapsedMinutes .. " min)"
	body.TextColor3 = Color3.fromRGB(200, 200, 200)
	body.TextSize = 16
	body.Font = Enum.Font.Gotham
	body.TextWrapped = true
	body.Parent = popup

	task.delay(5, function() popup:Destroy() end)
end)

-- Click on orbs
local mouse = player:GetMouse()
mouse.Button1Down:Connect(function()
	local target = mouse.Target
	if target and game:GetService("CollectionService"):HasTag(target, "ClickOrb") then
		clickEvent:FireServer()
	end
end)

print("IncrementalUI loaded")
`;

export function getIncrementalScripts(): ScriptFile[] {
  return [
    { relativePath: "src/shared/IncrementalConfig.luau", name: "IncrementalConfig", scriptType: "module", content: INCREMENTAL_CONFIG },
    { relativePath: "src/server/IncrementalManager.server.luau", name: "IncrementalManager", scriptType: "server", content: INCREMENTAL_MANAGER },
    { relativePath: "src/server/PrestigeManager.server.luau", name: "PrestigeManager", scriptType: "server", content: INCREMENTAL_PRESTIGE_MANAGER },
    { relativePath: "src/server/OfflineEarnings.server.luau", name: "OfflineEarnings", scriptType: "server", content: INCREMENTAL_OFFLINE_EARNINGS },
    { relativePath: "src/server/DataManager.server.luau", name: "DataManager", scriptType: "server", content: INCREMENTAL_DATA_MANAGER },
    { relativePath: "src/client/IncrementalUI.client.luau", name: "IncrementalUI", scriptType: "client", content: INCREMENTAL_UI },
    { relativePath: "src/server/PlatformBehaviors.server.luau", name: "PlatformBehaviors", scriptType: "server", content: PLATFORM_BEHAVIORS },
    { relativePath: "src/shared/RateLimit.luau", name: "RateLimit", scriptType: "module", content: RATE_LIMIT },
  ];
}

// ── Blank/Custom Template Scripts ──

export function getBlankScripts(): ScriptFile[] {
  return [
    { relativePath: "src/shared/RateLimit.luau", name: "RateLimit", scriptType: "module", content: RATE_LIMIT },
    { relativePath: "src/server/DataManager.server.luau", name: "DataManager", scriptType: "server", content: INCREMENTAL_DATA_MANAGER },
  ];
}

// ── Script Lookup ──

const TEMPLATE_SCRIPTS: Record<string, () => ScriptFile[]> = {
  obby: getObbyScripts,
  tycoon: getTycoonScripts,
  simulator: getSimulatorScripts,
  battlegrounds: getBattlegroundsScripts,
  rpg: getRpgScripts,
  horror: getHorrorScripts,
  racing: getRacingScripts,
  minigames: getMinigamesScripts,
  incremental: getIncrementalScripts,
  blank: getBlankScripts,
};

export function getTemplateScripts(templateId: string): ScriptFile[] {
  const factory = TEMPLATE_SCRIPTS[templateId];
  if (!factory) return [];
  return factory();
}
