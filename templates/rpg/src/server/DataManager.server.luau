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
