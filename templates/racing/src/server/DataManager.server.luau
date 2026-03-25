-- DataManager: saves racing stats and vehicle ownership
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local raceStore = DataStoreService:GetDataStore("RaceData_v1")

local function savePlayerData(player)
	local key = "user_" .. player.UserId
	pcall(function()
		raceStore:SetAsync(key, { wins = 0, races = 0, bestTime = 0, coins = 0 })
	end)
end

Players.PlayerRemoving:Connect(savePlayerData)
game:BindToClose(function()
	for _, player in Players:GetPlayers() do savePlayerData(player) end
end)

print("DataManager loaded")
