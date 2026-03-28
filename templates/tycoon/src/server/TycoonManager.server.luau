-- TycoonManager: handles plot claiming, droppers, conveyors, and collectors
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local TycoonConfig = require(ReplicatedStorage:WaitForChild("TycoonConfig"))

-- Track which player owns which plot
local plotOwners = {} -- [plotFolder] = player
local playerPlots = {} -- [player] = plotFolder
local playerCash = {} -- [player] = number

-- Find all plots
local plotsFolder = workspace:WaitForChild("Plots")

-- Claim button handling
local function setupClaimButton(button)
	button.Touched:Connect(function(hit)
		local character = hit.Parent
		local player = Players:GetPlayerFromCharacter(character)
		if not player then return end
		if playerPlots[player] then return end

		local plot = button.Parent
		if plotOwners[plot] then return end

		-- Claim the plot
		plotOwners[plot] = player
		playerPlots[player] = plot
		playerCash[player] = TycoonConfig.StartingCash

		-- Hide claim button
		button.Transparency = 1
		button.CanCollide = false

		-- Change plot base color to show ownership
		local base = plot:FindFirstChild("PlotBase")
		if base then
			base.Color = Color3.fromRGB(150, 200, 150)
		end

		print(player.Name .. " claimed plot " .. plot.Name)
	end)
end

for _, button in CollectionService:GetTagged("ClaimButton") do
	setupClaimButton(button)
end

-- Dropper system
local dropperTimers = {}

local function createDrop(dropper)
	local plot = dropper.Parent
	local owner = plotOwners[plot]
	if not owner then return end

	local drop = Instance.new("Part")
	drop.Name = "Drop"
	drop.Size = Vector3.new(1, 1, 1)
	drop.Position = dropper.Position + Vector3.new(0, 3, 0)
	drop.Color = Color3.fromRGB(0, 180, 255)
	drop.Material = Enum.Material.Neon
	drop.Anchored = false
	drop.CanCollide = true
	drop.Parent = workspace

	-- Tag with value
	local valueTag = Instance.new("IntValue")
	valueTag.Name = "DropValue"
	valueTag.Value = TycoonConfig.BaseDropValue
	valueTag.Parent = drop

	-- Auto-destroy after 30 seconds
	task.delay(30, function()
		if drop and drop.Parent then
			drop:Destroy()
		end
	end)
end

RunService.Heartbeat:Connect(function(dt)
	for _, dropper in CollectionService:GetTagged("Dropper") do
		if not dropperTimers[dropper] then
			dropperTimers[dropper] = 0
		end
		dropperTimers[dropper] = dropperTimers[dropper] + dt
		if dropperTimers[dropper] >= TycoonConfig.DropperInterval then
			dropperTimers[dropper] = 0
			createDrop(dropper)
		end
	end
end)

-- Conveyor system (reads direction from Attributes, fallback to Z-axis)
for _, conveyor in CollectionService:GetTagged("Conveyor") do
	local speed = conveyor:GetAttribute("ConveyorSpeed") or TycoonConfig.ConveyorSpeed
	local dir = conveyor:GetAttribute("ConveyorDirection") or "forward"

	if dir == "left" then
		conveyor.AssemblyLinearVelocity = Vector3.new(-speed, 0, 0)
	elseif dir == "right" then
		conveyor.AssemblyLinearVelocity = Vector3.new(speed, 0, 0)
	elseif dir == "backward" then
		conveyor.AssemblyLinearVelocity = Vector3.new(0, 0, -speed)
	else
		conveyor.AssemblyLinearVelocity = Vector3.new(0, 0, speed)
	end
end

-- Collector system
local function setupCollector(collector)
	collector.Touched:Connect(function(hit)
		if hit.Name ~= "Drop" then return end

		local plot = collector.Parent
		local owner = plotOwners[plot]
		if not owner then return end

		local valueTag = hit:FindFirstChild("DropValue")
		local value = valueTag and valueTag.Value or TycoonConfig.BaseDropValue

		playerCash[owner] = (playerCash[owner] or 0) + value
		hit:Destroy()

		-- Update cash display (via remote event if exists)
		local cashEvent = ReplicatedStorage:FindFirstChild("UpdateCash")
		if cashEvent then
			cashEvent:FireClient(owner, playerCash[owner])
		end
	end)
end

for _, collector in CollectionService:GetTagged("Collector") do
	setupCollector(collector)
end

-- Create RemoteEvent for cash updates
local cashEvent = Instance.new("RemoteEvent")
cashEvent.Name = "UpdateCash"
cashEvent.Parent = ReplicatedStorage

-- Create RemoteFunction for getting cash
local getCash = Instance.new("RemoteFunction")
getCash.Name = "GetCash"
getCash.Parent = ReplicatedStorage

getCash.OnServerInvoke = function(player)
	return playerCash[player] or 0
end

-- Upgrade button system
local upgradeEvent = Instance.new("RemoteEvent")
upgradeEvent.Name = "UpgradeEvent"
upgradeEvent.Parent = ReplicatedStorage

local function setupUpgradeButton(button)
	local upgradeName = button:GetAttribute("UpgradeName") or button.Name
	local upgradeCost = button:GetAttribute("UpgradeCost") or 100
	local upgradeMultiplier = button:GetAttribute("UpgradeMultiplier") or 2

	button.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player then return end

		local plot = button.Parent
		if plotOwners[plot] ~= player then return end

		local cash = playerCash[player] or 0
		if cash < upgradeCost then
			upgradeEvent:FireClient(player, {
				type = "error",
				message = "Need $" .. upgradeCost .. " (you have $" .. cash .. ")",
			})
			return
		end

		-- Check if already purchased
		local upgradesFolder = player:FindFirstChild("Upgrades")
		if not upgradesFolder then
			upgradesFolder = Instance.new("Folder")
			upgradesFolder.Name = "Upgrades"
			upgradesFolder.Parent = player
		end

		if upgradesFolder:FindFirstChild(upgradeName) then
			upgradeEvent:FireClient(player, { type = "error", message = "Already purchased!" })
			return
		end

		-- Purchase
		playerCash[player] = cash - upgradeCost
		local tag = Instance.new("StringValue")
		tag.Name = upgradeName
		tag.Value = upgradeName
		tag.Parent = upgradesFolder

		-- Hide the button
		button.Transparency = 1
		button.CanCollide = false

		-- Apply upgrade effect (e.g., faster dropper)
		if upgradeName:find("Speed") then
			-- Reduce dropper interval
			for _, dropper in CollectionService:GetTagged("Dropper") do
				if dropper.Parent == plot then
					local attr = dropper:GetAttribute("DropInterval")
					if attr then
						dropper:SetAttribute("DropInterval", attr / upgradeMultiplier)
					end
				end
			end
		end

		upgradeEvent:FireClient(player, {
			type = "purchased",
			name = upgradeName,
			cost = upgradeCost,
			cash = playerCash[player],
		})

		cashEvent:FireClient(player, playerCash[player])
	end)
end

for _, button in CollectionService:GetTagged("UpgradeButton") do
	setupUpgradeButton(button)
end
CollectionService:GetInstanceAddedSignal("UpgradeButton"):Connect(setupUpgradeButton)

-- Cleanup on player leaving
Players.PlayerRemoving:Connect(function(player)
	local plot = playerPlots[player]
	if plot then
		plotOwners[plot] = nil
		playerPlots[player] = nil

		-- Show claim button again
		for _, child in plot:GetChildren() do
			if CollectionService:HasTag(child, "ClaimButton") then
				child.Transparency = 0
				child.CanCollide = true
			end
		end

		local base = plot:FindFirstChild("PlotBase")
		if base then
			base.Color = Color3.fromRGB(200, 200, 200)
		end
	end
	playerCash[player] = nil
end)

print("TycoonManager loaded")
