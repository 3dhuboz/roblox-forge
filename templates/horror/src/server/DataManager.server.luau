-- DataManager: saves horror game progress
local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local horrorStore = DataStoreService:GetDataStore("HorrorData_v1")

local function savePlayerData(player)
	local key = "user_" .. player.UserId
	pcall(function()
		horrorStore:SetAsync(key, { completedRooms = {}, puzzlesSolved = {} })
	end)
end

Players.PlayerRemoving:Connect(savePlayerData)

game:BindToClose(function()
	for _, player in Players:GetPlayers() do
		savePlayerData(player)
	end
end)

print("DataManager loaded")
