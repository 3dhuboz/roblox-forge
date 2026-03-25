-- RebirthManager: handles rebirth system for permanent multipliers
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local SimConfig = require(ReplicatedStorage:WaitForChild("SimConfig"))

local rebirthEvent = Instance.new("RemoteEvent")
rebirthEvent.Name = "Rebirth"
rebirthEvent.Parent = ReplicatedStorage

local function getPlayerData(player)
	local getDataFunc = game.ServerScriptService.ClickManager:FindFirstChild("GetPlayerData")
	if getDataFunc then
		return getDataFunc:Invoke(player)
	end
	return nil
end

rebirthEvent.OnServerEvent:Connect(function(player)
	local data = getPlayerData(player)
	if not data then return end

	local nextLevel = data.rebirthLevel + 1
	local rebirthInfo = nil

	for _, r in ipairs(SimConfig.Rebirths) do
		if r.Level == nextLevel then
			rebirthInfo = r
			break
		end
	end

	if not rebirthInfo then
		local updateStats = ReplicatedStorage:FindFirstChild("UpdateStats")
		if updateStats then
			updateStats:FireClient(player, {
				error = "Max rebirth level reached!",
				coins = data.coins,
				gems = data.gems,
				clickPower = data.clickPower,
				rebirthLevel = data.rebirthLevel,
				petCount = #data.pets,
			})
		end
		return
	end

	if data.coins < rebirthInfo.RequiredCoins then return end

	-- Reset coins, keep gems and pets
	data.coins = 0
	data.clickPower = SimConfig.ClickPower
	data.rebirthLevel = nextLevel
	data.gems = data.gems + rebirthInfo.GemsReward
	data.coinMultiplier = 1
	data.autoClick = false
	data.upgrades = {}

	local updateStats = ReplicatedStorage:FindFirstChild("UpdateStats")
	if updateStats then
		updateStats:FireClient(player, {
			coins = data.coins,
			gems = data.gems,
			clickPower = data.clickPower,
			rebirthLevel = data.rebirthLevel,
			petCount = #data.pets,
			rebirthComplete = true,
			gemsEarned = rebirthInfo.GemsReward,
		})
	end

	print(player.Name .. " rebirthed to level " .. nextLevel .. "! Earned " .. rebirthInfo.GemsReward .. " gems")
end)

print("RebirthManager loaded")
