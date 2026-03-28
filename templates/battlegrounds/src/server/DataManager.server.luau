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
