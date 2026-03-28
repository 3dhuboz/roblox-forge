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
