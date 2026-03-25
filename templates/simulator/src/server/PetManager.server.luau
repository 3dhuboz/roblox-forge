-- PetManager: handles egg hatching, pet equipping, and pet effects
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local SimConfig = require(ReplicatedStorage:WaitForChild("SimConfig"))

local hatchEvent = Instance.new("RemoteEvent")
hatchEvent.Name = "HatchEgg"
hatchEvent.Parent = ReplicatedStorage

local petUpdateEvent = Instance.new("RemoteEvent")
petUpdateEvent.Name = "PetUpdate"
petUpdateEvent.Parent = ReplicatedStorage

local function getPlayerData(player)
	local getDataFunc = game.ServerScriptService.ClickManager:FindFirstChild("GetPlayerData")
	if getDataFunc then
		return getDataFunc:Invoke(player)
	end
	return nil
end

local function rollPet(hatchCost)
	local eligiblePets = {}
	for _, pet in ipairs(SimConfig.Pets) do
		if pet.HatchCost <= hatchCost then
			table.insert(eligiblePets, pet)
		end
	end

	if #eligiblePets == 0 then return nil end

	local roll = math.random(1, 100)
	local cumulative = 0
	for _, pet in ipairs(eligiblePets) do
		cumulative = cumulative + pet.HatchChance
		if roll <= cumulative then
			return pet
		end
	end

	return eligiblePets[1]
end

hatchEvent.OnServerEvent:Connect(function(player, eggPad)
	if not eggPad or not CollectionService:HasTag(eggPad, "EggHatchPad") then return end

	local data = getPlayerData(player)
	if not data then return end

	local hatchCost = 100
	if data.coins < hatchCost then return end

	if #data.pets >= data.maxPets then
		petUpdateEvent:FireClient(player, { error = "Pet slots full! Buy more slots or release a pet." })
		return
	end

	data.coins = data.coins - hatchCost

	local newPet = rollPet(hatchCost)
	if newPet then
		table.insert(data.pets, {
			Name = newPet.Name,
			Rarity = newPet.Rarity,
			CoinBoost = newPet.CoinBoost,
		})

		petUpdateEvent:FireClient(player, {
			hatched = newPet.Name,
			rarity = newPet.Rarity,
			coinBoost = newPet.CoinBoost,
			pets = data.pets,
			coins = data.coins,
		})

		print(player.Name .. " hatched a " .. newPet.Rarity .. " " .. newPet.Name)
	end
end)

-- Egg pad visual animation
for _, pad in CollectionService:GetTagged("EggHatchPad") do
	task.spawn(function()
		local basePos = pad.Position
		while pad and pad.Parent do
			for i = 0, math.pi * 2, 0.05 do
				if not pad or not pad.Parent then break end
				pad.Position = basePos + Vector3.new(0, math.sin(i) * 0.3, 0)
				task.wait(0.03)
			end
		end
	end)
end

print("PetManager loaded")
