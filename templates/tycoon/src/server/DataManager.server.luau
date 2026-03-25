-- DataManager: saves and loads tycoon player data
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local tycoonStore = DataStoreService:GetDataStore("TycoonData_v1")

local function loadPlayerData(player)
	local key = "user_" .. player.UserId
	local success, data = pcall(function()
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

	local success, err = pcall(function()
		tycoonStore:SetAsync(key, data)
	end)

	if not success then
		warn("Failed to save data for " .. player.Name .. ": " .. tostring(err))
	else
		print("Saved data for " .. player.Name)
	end
end

Players.PlayerAdded:Connect(loadPlayerData)
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
