-- DataManager: saves minigame wins and coins
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local miniStore = DataStoreService:GetDataStore("MinigameData_v1")

local function savePlayerData(player)
	local key = "user_" .. player.UserId
	pcall(function()
		miniStore:SetAsync(key, { wins = 0, gamesPlayed = 0, coins = 0 })
	end)
end

Players.PlayerRemoving:Connect(savePlayerData)
game:BindToClose(function()
	for _, player in Players:GetPlayers() do savePlayerData(player) end
end)

print("DataManager loaded")
