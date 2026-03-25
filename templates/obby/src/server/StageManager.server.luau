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
