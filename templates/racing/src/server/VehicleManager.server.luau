--[[
	VehicleManager: handles vehicle selection, spawning, driving, and upgrades.
	Creates actual driveable vehicles using VehicleSeat + BodyVelocity.
]]
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local RaceConfig = require(ReplicatedStorage:WaitForChild("RaceConfig"))
local RateLimit = require(ReplicatedStorage:WaitForChild("RateLimit"))

local vehicleEvent = Instance.new("RemoteEvent")
vehicleEvent.Name = "VehicleEvent"
vehicleEvent.Parent = ReplicatedStorage

local playerVehicles = {} -- { [Player]: { selected, owned, coins } }
local activeVehicles = {} -- { [Player]: Model }

local function getPlayerData(player)
	if not playerVehicles[player] then
		playerVehicles[player] = { selected = "Starter Kart", owned = { "Starter Kart" }, coins = 0 }
	end
	return playerVehicles[player]
end

local function getVehicleConfig(name: string)
	for _, v in ipairs(RaceConfig.Vehicles) do
		if v.Name == name then return v end
	end
	return RaceConfig.Vehicles[1]
end

--- Build a driveable vehicle model from config.
local function buildVehicle(config): Model
	local model = Instance.new("Model")
	model.Name = config.Name

	-- Main body
	local body = Instance.new("Part")
	body.Name = "Body"
	body.Size = Vector3.new(6, 2, 10)
	body.Color = config.Color
	body.Material = Enum.Material.SmoothPlastic
	body.Anchored = false
	body.CanCollide = true
	body.Parent = model

	-- Driver seat
	local seat = Instance.new("VehicleSeat")
	seat.Name = "DriveSeat"
	seat.Size = Vector3.new(2, 1, 2)
	seat.Position = body.Position + Vector3.new(0, 1.5, -1)
	seat.MaxSpeed = config.Speed
	seat.Torque = config.Acceleration * 10
	seat.TurnSpeed = config.Handling * 3
	seat.Anchored = false
	seat.CanCollide = true
	seat.Parent = model

	-- Weld seat to body
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = body
	weld.Part1 = seat
	weld.Parent = seat

	-- Wheels (4 corners)
	local wheelPositions = {
		Vector3.new(-2.5, -1, 3.5),  -- front-left
		Vector3.new(2.5, -1, 3.5),   -- front-right
		Vector3.new(-2.5, -1, -3.5), -- back-left
		Vector3.new(2.5, -1, -3.5),  -- back-right
	}

	for i, offset in ipairs(wheelPositions) do
		local wheel = Instance.new("Part")
		wheel.Name = "Wheel" .. i
		wheel.Shape = Enum.PartType.Cylinder
		wheel.Size = Vector3.new(1.5, 1.5, 1.5)
		wheel.Color = Color3.fromRGB(30, 30, 30)
		wheel.Material = Enum.Material.SmoothPlastic
		wheel.Position = body.Position + offset
		wheel.Anchored = false
		wheel.CanCollide = true
		wheel.Parent = model

		local wheelWeld = Instance.new("WeldConstraint")
		wheelWeld.Part0 = body
		wheelWeld.Part1 = wheel
		wheelWeld.Parent = wheel
	end

	-- Headlights
	for _, side in ipairs({ -2, 2 }) do
		local light = Instance.new("Part")
		light.Name = "Headlight"
		light.Size = Vector3.new(1, 0.8, 0.3)
		light.Color = Color3.fromRGB(255, 255, 200)
		light.Material = Enum.Material.Neon
		light.Position = body.Position + Vector3.new(side, 0.3, 5)
		light.Anchored = false
		light.CanCollide = false
		light.Parent = model

		local lightWeld = Instance.new("WeldConstraint")
		lightWeld.Part0 = body
		lightWeld.Part1 = light
		lightWeld.Parent = light

		local spotlight = Instance.new("SpotLight")
		spotlight.Range = 60
		spotlight.Brightness = 2
		spotlight.Angle = 45
		spotlight.Face = Enum.NormalId.Front
		spotlight.Parent = light
	end

	model.PrimaryPart = body
	return model
end

--- Spawn a vehicle for a player at a spawn pad.
local function spawnVehicle(player: Player, spawnCFrame: CFrame?)
	-- Remove existing vehicle
	if activeVehicles[player] then
		activeVehicles[player]:Destroy()
		activeVehicles[player] = nil
	end

	local data = getPlayerData(player)
	local config = getVehicleConfig(data.selected)

	local vehicle = buildVehicle(config)

	-- Position at spawn or player location
	local spawnPos = spawnCFrame
	if not spawnPos then
		local character = player.Character
		if character and character.PrimaryPart then
			spawnPos = character.PrimaryPart.CFrame + Vector3.new(0, 3, 10)
		else
			spawnPos = CFrame.new(0, 5, 0)
		end
	end

	vehicle:SetPrimaryPartCFrame(spawnPos)
	vehicle.Parent = workspace

	activeVehicles[player] = vehicle

	-- Seat the player
	local seat = vehicle:FindFirstChild("DriveSeat")
	if seat and player.Character then
		local humanoid = player.Character:FindFirstChildOfClass("Humanoid")
		if humanoid then
			seat:Sit(humanoid)
		end
	end

	vehicleEvent:FireClient(player, {
		type = "spawned",
		vehicle = data.selected,
		speed = config.Speed,
	})
end

--- Remove a player's vehicle.
local function despawnVehicle(player: Player)
	if activeVehicles[player] then
		activeVehicles[player]:Destroy()
		activeVehicles[player] = nil
	end
end

-- ── Remote event handler ──

vehicleEvent.OnServerEvent:Connect(function(player, action, vehicleName)
	if not RateLimit.check(player, "vehicle", 0.5) then return end
	local data = getPlayerData(player)

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
		local config = getVehicleConfig(vehicleName)
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

		data.coins -= config.Cost
		table.insert(data.owned, vehicleName)
		data.selected = vehicleName

		vehicleEvent:FireClient(player, {
			type = "bought",
			vehicle = vehicleName,
			coins = data.coins,
		})

	elseif action == "spawn" then
		spawnVehicle(player)

	elseif action == "despawn" then
		despawnVehicle(player)
	end
end)

-- ── Vehicle spawn pads ──

for _, pad in CollectionService:GetTagged("VehicleSpawn") do
	pad.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player then return end
		if not RateLimit.check(player, "vehicle_spawn", 3) then return end
		spawnVehicle(player, pad.CFrame + Vector3.new(0, 3, 0))
	end)
end

CollectionService:GetInstanceAddedSignal("VehicleSpawn"):Connect(function(pad)
	pad.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player then return end
		if not RateLimit.check(player, "vehicle_spawn", 3) then return end
		spawnVehicle(player, pad.CFrame + Vector3.new(0, 3, 0))
	end)
end)

-- ── Vehicle select pads (garage) ──

for _, pad in CollectionService:GetTagged("VehicleSelect") do
	pad.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player then return end
		if not RateLimit.check(player, "garage", 1) then return end
		local data = getPlayerData(player)
		vehicleEvent:FireClient(player, {
			type = "show_garage",
			owned = data.owned,
			selected = data.selected,
			coins = data.coins,
			vehicles = RaceConfig.Vehicles,
		})
	end)
end

-- ── Cleanup ──

Players.PlayerRemoving:Connect(function(player)
	despawnVehicle(player)
	playerVehicles[player] = nil
end)
