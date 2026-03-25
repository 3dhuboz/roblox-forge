-- VehicleManager: handles vehicle selection, spawning, and upgrades
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local RaceConfig = require(ReplicatedStorage:WaitForChild("RaceConfig"))

local vehicleEvent = Instance.new("RemoteEvent")
vehicleEvent.Name = "VehicleEvent"
vehicleEvent.Parent = ReplicatedStorage

local playerVehicles = {}

local function getPlayerVehicle(player)
	if not playerVehicles[player] then
		playerVehicles[player] = { selected = "Starter Kart", owned = { "Starter Kart" }, coins = 0 }
	end
	return playerVehicles[player]
end

vehicleEvent.OnServerEvent:Connect(function(player, action, vehicleName)
	local data = getPlayerVehicle(player)

	if action == "select" then
		for _, name in ipairs(data.owned) do
			if name == vehicleName then
				data.selected = vehicleName
				vehicleEvent:FireClient(player, { type = "selected", vehicle = vehicleName })
				return
			end
		end
		vehicleEvent:FireClient(player, { type = "error", message = "You don't own this vehicle!" })

	elseif action == "buy" then
		local config = nil
		for _, v in ipairs(RaceConfig.Vehicles) do
			if v.Name == vehicleName then config = v; break end
		end
		if not config then return end

		for _, name in ipairs(data.owned) do
			if name == vehicleName then
				vehicleEvent:FireClient(player, { type = "error", message = "Already owned!" })
				return
			end
		end

		if data.coins < config.Cost then
			vehicleEvent:FireClient(player, { type = "error", message = "Need " .. config.Cost .. " coins!" })
			return
		end

		data.coins = data.coins - config.Cost
		table.insert(data.owned, vehicleName)
		data.selected = vehicleName

		vehicleEvent:FireClient(player, {
			type = "bought",
			vehicle = vehicleName,
			coins = data.coins,
		})
		print(player.Name .. " bought " .. vehicleName)
	end
end)

-- Vehicle select pad
for _, pad in CollectionService:GetTagged("VehicleSelect") do
	pad.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player then return end
		local data = getPlayerVehicle(player)
		vehicleEvent:FireClient(player, {
			type = "show_garage",
			owned = data.owned,
			selected = data.selected,
			coins = data.coins,
			vehicles = RaceConfig.Vehicles,
		})
	end)
end

Players.PlayerRemoving:Connect(function(player)
	playerVehicles[player] = nil
end)

print("VehicleManager loaded")
