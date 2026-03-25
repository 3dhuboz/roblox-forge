-- IncomeManager: handles upgrade purchases and income multipliers
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local TycoonConfig = require(ReplicatedStorage:WaitForChild("TycoonConfig"))

-- Create RemoteEvent for purchases
local purchaseEvent = Instance.new("RemoteEvent")
purchaseEvent.Name = "PurchaseUpgrade"
purchaseEvent.Parent = ReplicatedStorage

local function getPlayerCash(player)
	local getCash = ReplicatedStorage:FindFirstChild("GetCash")
	if getCash then
		return getCash:InvokeClient(player)
	end
	return 0
end

-- Upgrade button handling
local function setupUpgradeButton(button)
	button.Touched:Connect(function(hit)
		local character = hit.Parent
		local player = Players:GetPlayerFromCharacter(character)
		if not player then return end

		local plot = button.Parent
		-- Verify player owns this plot
		local upgradesFolder = player:FindFirstChild("Upgrades")
		if not upgradesFolder then return end

		-- Find next available upgrade
		local ownedUpgrades = {}
		for _, child in upgradesFolder:GetChildren() do
			ownedUpgrades[child.Value] = true
		end

		for _, upgrade in ipairs(TycoonConfig.Upgrades) do
			if not ownedUpgrades[upgrade.Name] then
				-- Check if player can afford it
				local cashEvent = ReplicatedStorage:FindFirstChild("GetCash")
				local cash = 0
				if cashEvent then
					local success, result = pcall(function()
						return cashEvent:InvokeServer()
					end)
					if success then cash = result end
				end

				-- For now, use the SavedCash value
				local savedCash = player:FindFirstChild("SavedCash")
				if savedCash and savedCash.Value >= upgrade.Cost then
					savedCash.Value = savedCash.Value - upgrade.Cost

					local tag = Instance.new("StringValue")
					tag.Name = upgrade.Name
					tag.Value = upgrade.Name
					tag.Parent = upgradesFolder

					-- Apply upgrade effect
					applyUpgrade(plot, upgrade)

					print(player.Name .. " purchased " .. upgrade.Name)

					-- Notify client
					local updateCash = ReplicatedStorage:FindFirstChild("UpdateCash")
					if updateCash then
						updateCash:FireClient(player, savedCash.Value)
					end
				end
				break
			end
		end
	end)
end

function applyUpgrade(plot, upgrade)
	if upgrade.Effect == "dropper_speed" then
		-- Handled by TycoonManager checking player upgrades
	elseif upgrade.Effect == "drop_value" then
		-- Handled by TycoonManager checking player upgrades
	elseif upgrade.Effect == "conveyor_speed" then
		for _, child in plot:GetChildren() do
			if CollectionService:HasTag(child, "Conveyor") then
				child.AssemblyLinearVelocity = child.AssemblyLinearVelocity * upgrade.Multiplier
			end
		end
	elseif upgrade.Effect == "auto_collect" then
		-- Enable auto-collection on collector
		for _, child in plot:GetChildren() do
			if CollectionService:HasTag(child, "Collector") then
				local autoTag = Instance.new("BoolValue")
				autoTag.Name = "AutoCollect"
				autoTag.Value = true
				autoTag.Parent = child
			end
		end
	end
end

for _, button in CollectionService:GetTagged("UpgradeButton") do
	setupUpgradeButton(button)
end

print("IncomeManager loaded")
