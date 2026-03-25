-- InventoryManager: handles item buying, equipping, and inventory
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local RPGConfig = require(ReplicatedStorage:WaitForChild("RPGConfig"))

local buyEvent = Instance.new("RemoteEvent")
buyEvent.Name = "BuyItem"
buyEvent.Parent = ReplicatedStorage

local equipEvent = Instance.new("RemoteEvent")
equipEvent.Name = "EquipItem"
equipEvent.Parent = ReplicatedStorage

local inventoryUpdate = Instance.new("RemoteEvent")
inventoryUpdate.Name = "InventoryUpdate"
inventoryUpdate.Parent = ReplicatedStorage

local playerInventories = {}

local function getInventory(player)
	if not playerInventories[player] then
		playerInventories[player] = {
			items = {},
			equipped = { weapon = nil, armor = nil },
		}
	end
	return playerInventories[player]
end

local function getItemConfig(itemName)
	for _, item in ipairs(RPGConfig.Items) do
		if item.Name == itemName then
			return item
		end
	end
	return nil
end

buyEvent.OnServerEvent:Connect(function(player, itemName)
	local config = getItemConfig(itemName)
	if not config then return end

	local level = player:FindFirstChild("Level")
	if level and level.Value < config.MinLevel then
		inventoryUpdate:FireClient(player, {
			type = "error",
			message = "You need level " .. config.MinLevel .. " for this item!",
		})
		return
	end

	local gold = player:FindFirstChild("Gold")
	if not gold or gold.Value < config.Cost then
		inventoryUpdate:FireClient(player, {
			type = "error",
			message = "Not enough gold! Need " .. config.Cost,
		})
		return
	end

	gold.Value = gold.Value - config.Cost

	local inv = getInventory(player)
	table.insert(inv.items, itemName)

	inventoryUpdate:FireClient(player, {
		type = "bought",
		item = itemName,
		itemType = config.Type,
		gold = gold.Value,
	})

	print(player.Name .. " bought " .. itemName)
end)

equipEvent.OnServerEvent:Connect(function(player, itemName)
	local config = getItemConfig(itemName)
	if not config then return end

	local inv = getInventory(player)
	local hasItem = false
	for _, name in ipairs(inv.items) do
		if name == itemName then
			hasItem = true
			break
		end
	end
	if not hasItem then return end

	if config.Type == "weapon" then
		inv.equipped.weapon = itemName
	elseif config.Type == "armor" then
		inv.equipped.armor = itemName
	elseif config.Type == "consumable" then
		-- Use consumable
		local character = player.Character
		if character then
			local humanoid = character:FindFirstChild("Humanoid")
			if humanoid and config.HealAmount then
				humanoid.Health = math.min(humanoid.MaxHealth, humanoid.Health + config.HealAmount)
			end
		end
		-- Remove from inventory
		for i, name in ipairs(inv.items) do
			if name == itemName then
				table.remove(inv.items, i)
				break
			end
		end
	end

	inventoryUpdate:FireClient(player, {
		type = "equipped",
		item = itemName,
		equipped = inv.equipped,
		items = inv.items,
	})
end)

Players.PlayerRemoving:Connect(function(player)
	playerInventories[player] = nil
end)

print("InventoryManager loaded")
