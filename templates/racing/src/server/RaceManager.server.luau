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
