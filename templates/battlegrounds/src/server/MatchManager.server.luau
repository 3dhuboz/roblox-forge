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
