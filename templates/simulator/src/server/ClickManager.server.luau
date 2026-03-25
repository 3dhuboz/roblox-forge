-- ClickManager: handles clicking orbs to earn coins
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local SimConfig = require(ReplicatedStorage:WaitForChild("SimConfig"))

-- Remote events
local clickEvent = Instance.new("RemoteEvent")
clickEvent.Name = "ClickOrb"
clickEvent.Parent = ReplicatedStorage

local updateStats = Instance.new("RemoteEvent")
updateStats.Name = "UpdateStats"
updateStats.Parent = ReplicatedStorage

-- Player data (in-memory, DataManager handles persistence)
local playerData = {}

local function getPlayerData(player)
	if not playerData[player] then
		playerData[player] = {
			coins = SimConfig.StartingCoins,
			gems = SimConfig.StartingGems,
			clickPower = SimConfig.ClickPower,
			coinMultiplier = 1,
			rebirthLevel = 0,
			pets = {},
			maxPets = 3,
			autoClick = false,
			upgrades = {},
		}
	end
	return playerData[player]
end

-- Handle click events from client
clickEvent.OnServerEvent:Connect(function(player, orbInstance)
	if not orbInstance or not orbInstance:IsA("BasePart") then return end
	if not CollectionService:HasTag(orbInstance, "ClickOrb") then return end

	local data = getPlayerData(player)

	-- Calculate coins earned
	local baseCoins = data.clickPower
	local multiplier = data.coinMultiplier

	-- Apply pet boosts
	for _, pet in ipairs(data.pets) do
		multiplier = multiplier * (pet.CoinBoost or 1)
	end

	-- Apply rebirth multiplier
	if data.rebirthLevel > 0 then
		for _, rebirth in ipairs(SimConfig.Rebirths) do
			if data.rebirthLevel >= rebirth.Level then
				multiplier = multiplier * rebirth.Multiplier
			end
		end
	end

	local earned = math.floor(baseCoins * multiplier)
	data.coins = data.coins + earned

	-- Visual feedback on the orb
	task.spawn(function()
		local originalSize = orbInstance.Size
		local originalColor = orbInstance.Color
		orbInstance.Size = originalSize * 0.85
		orbInstance.Color = Color3.fromRGB(255, 255, 200)
		task.wait(0.1)
		orbInstance.Size = originalSize
		orbInstance.Color = originalColor
	end)

	-- Update client
	updateStats:FireClient(player, {
		coins = data.coins,
		gems = data.gems,
		clickPower = data.clickPower,
		rebirthLevel = data.rebirthLevel,
		petCount = #data.pets,
	})
end)

-- Auto-click system
task.spawn(function()
	while true do
		task.wait(1)
		for _, player in Players:GetPlayers() do
			local data = getPlayerData(player)
			if data.autoClick then
				local earned = math.floor(data.clickPower * data.coinMultiplier * 0.5)
				data.coins = data.coins + earned
				updateStats:FireClient(player, {
					coins = data.coins,
					gems = data.gems,
					clickPower = data.clickPower,
					rebirthLevel = data.rebirthLevel,
					petCount = #data.pets,
				})
			end
		end
	end
end)

-- Expose data for other scripts
local getDataFunc = Instance.new("BindableFunction")
getDataFunc.Name = "GetPlayerData"
getDataFunc.Parent = script
getDataFunc.OnInvoke = function(player)
	return getPlayerData(player)
end

-- Cleanup
Players.PlayerRemoving:Connect(function(player)
	playerData[player] = nil
end)

print("ClickManager loaded")
