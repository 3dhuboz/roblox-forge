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
