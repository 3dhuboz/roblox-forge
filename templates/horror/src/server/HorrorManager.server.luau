-- HorrorManager: handles atmosphere, jumpscares, flashlight, and stamina
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")

local HorrorConfig = require(ReplicatedStorage:WaitForChild("HorrorConfig"))

local horrorEvent = Instance.new("RemoteEvent")
horrorEvent.Name = "HorrorEvent"
horrorEvent.Parent = ReplicatedStorage

local playerState = {}

local function initPlayer(player)
	playerState[player] = {
		flashlightOn = false,
		battery = HorrorConfig.FlashlightBattery,
		stamina = HorrorConfig.StaminaMax,
		sprinting = false,
		keys = {},
		roomsVisited = {},
	}
end

-- Flashlight toggle
local flashlightEvent = Instance.new("RemoteEvent")
flashlightEvent.Name = "ToggleFlashlight"
flashlightEvent.Parent = ReplicatedStorage

flashlightEvent.OnServerEvent:Connect(function(player)
	local state = playerState[player]
	if not state then return end
	if state.battery <= 0 then
		horrorEvent:FireClient(player, { type = "no_battery" })
		return
	end
	state.flashlightOn = not state.flashlightOn
	horrorEvent:FireClient(player, {
		type = "flashlight",
		on = state.flashlightOn,
		battery = state.battery,
	})
end)

-- Sprint toggle
local sprintEvent = Instance.new("RemoteEvent")
sprintEvent.Name = "ToggleSprint"
sprintEvent.Parent = ReplicatedStorage

sprintEvent.OnServerEvent:Connect(function(player, sprinting)
	local state = playerState[player]
	if not state then return end
	state.sprinting = sprinting
	local character = player.Character
	if character then
		local humanoid = character:FindFirstChild("Humanoid")
		if humanoid then
			humanoid.WalkSpeed = sprinting and HorrorConfig.SprintSpeed or HorrorConfig.WalkSpeed
		end
	end
end)

-- Battery drain + stamina loop
task.spawn(function()
	while true do
		task.wait(1)
		for player, state in pairs(playerState) do
			if state.flashlightOn then
				state.battery = math.max(0, state.battery - HorrorConfig.BatteryDrainRate)
				if state.battery <= 0 then
					state.flashlightOn = false
					horrorEvent:FireClient(player, { type = "flashlight", on = false, battery = 0 })
				end
			end
			if state.sprinting then
				state.stamina = math.max(0, state.stamina - HorrorConfig.StaminaDrainRate)
				if state.stamina <= 0 then
					state.sprinting = false
					local character = player.Character
					if character then
						local humanoid = character:FindFirstChild("Humanoid")
						if humanoid then
							humanoid.WalkSpeed = HorrorConfig.WalkSpeed
						end
					end
				end
			else
				state.stamina = math.min(HorrorConfig.StaminaMax, state.stamina + HorrorConfig.StaminaRegenRate)
			end
			horrorEvent:FireClient(player, {
				type = "stats",
				battery = state.battery,
				stamina = state.stamina,
			})
		end
	end
end)

-- Flickering lights
for _, light in CollectionService:GetTagged("FlickeringLight") do
	task.spawn(function()
		while light and light.Parent do
			local pointLight = light:FindFirstChildOfClass("PointLight")
			if not pointLight then
				pointLight = Instance.new("PointLight")
				pointLight.Range = 30
				pointLight.Brightness = 1
				pointLight.Color = Color3.fromRGB(255, 220, 150)
				pointLight.Parent = light
			end
			pointLight.Brightness = math.random() > 0.3 and 1 or 0
			light.Transparency = pointLight.Brightness == 0 and 0.8 or 0
			task.wait(math.random() * 0.3 + 0.1)
		end
	end)
end

-- Jumpscare system
local function triggerJumpscare(player, triggerType)
	local state = playerState[player]
	if not state then return end
	for _, js in ipairs(HorrorConfig.Jumpscares) do
		if js.Trigger == triggerType then
			if math.random(1, 100) <= js.Chance then
				horrorEvent:FireClient(player, { type = "jumpscare", trigger = triggerType })
			end
			break
		end
	end
end

-- Door interaction
for _, door in CollectionService:GetTagged("Door") do
	door.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if player then
			triggerJumpscare(player, "door_open")
		end
	end)
end

Players.PlayerAdded:Connect(function(player)
	initPlayer(player)
	player.CharacterAdded:Connect(function(character)
		task.wait(0.1)
		local humanoid = character:FindFirstChild("Humanoid")
		if humanoid then
			humanoid.WalkSpeed = HorrorConfig.WalkSpeed
		end
	end)
end)

Players.PlayerRemoving:Connect(function(player)
	playerState[player] = nil
end)

print("HorrorManager loaded")
