-- DataManager: saves and loads simulator player data
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local simStore = DataStoreService:GetDataStore("SimulatorData_v1")

local function loadPlayerData(player)
	local key = "user_" .. player.UserId
	local success, data = pcall(function()
		return simStore:GetAsync(key)
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

	local success, err = pcall(function()
		simStore:SetAsync(key, saveData)
	end)

	if not success then
		warn("Failed to save data for " .. player.Name .. ": " .. tostring(err))
	end
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
