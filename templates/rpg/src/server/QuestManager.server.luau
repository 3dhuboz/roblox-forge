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
