local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")

local DATA_STORE_NAME = "ObbyPlayerData_v1"
local dataStore = DataStoreService:GetDataStore(DATA_STORE_NAME)

local playerData: { [Player]: { stage: number, deaths: number, bestTime: number? } } = {}

local function loadPlayerData(player: Player)
	local key = "Player_" .. player.UserId
	local success, data = pcall(function()
		return dataStore:GetAsync(key)
	end)

	if success and data then
		playerData[player] = data
	else
		playerData[player] = {
			stage = 0,
			deaths = 0,
			bestTime = nil,
		}
	end
end

local function savePlayerData(player: Player)
	local data = playerData[player]
	if not data then
		return
	end

	local key = "Player_" .. player.UserId
	local success, err = pcall(function()
		dataStore:UpdateAsync(key, function()
			return data
		end)
	end)

	if not success then
		warn("Failed to save data for " .. player.Name .. ": " .. tostring(err))
	end
end

local function onPlayerAdded(player: Player)
	loadPlayerData(player)
end

local function onPlayerRemoving(player: Player)
	savePlayerData(player)
	playerData[player] = nil
end

Players.PlayerAdded:Connect(onPlayerAdded)
Players.PlayerRemoving:Connect(onPlayerRemoving)

game:BindToClose(function()
	for _, player in Players:GetPlayers() do
		savePlayerData(player)
	end
end)
