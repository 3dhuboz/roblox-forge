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

		-- Spawn visible pet model
		spawnPetModel(player, {
			Name = newPet.Name,
			Rarity = newPet.Rarity,
			CoinBoost = newPet.CoinBoost,
		})
	end
end)

-- ── Visible pet models ──

local activePetModels: { [Player]: { Model } } = {}

local RARITY_COLORS = {
	Common = Color3.fromRGB(150, 150, 150),
	Uncommon = Color3.fromRGB(50, 200, 50),
	Rare = Color3.fromRGB(50, 100, 255),
	Epic = Color3.fromRGB(180, 50, 255),
	Legendary = Color3.fromRGB(255, 200, 0),
}

local function spawnPetModel(player: Player, petData: { Name: string, Rarity: string, CoinBoost: number })
	local character = player.Character
	if not character then return end
	local hrp = character:FindFirstChild("HumanoidRootPart")
	if not hrp then return end

	local model = Instance.new("Model")
	model.Name = petData.Name .. "_Pet"

	-- Pet body
	local body = Instance.new("Part")
	body.Name = "Body"
	body.Size = Vector3.new(2, 2, 2)
	body.Shape = Enum.PartType.Ball
	body.Color = RARITY_COLORS[petData.Rarity] or RARITY_COLORS.Common
	body.Material = Enum.Material.SmoothPlastic
	body.Anchored = true
	body.CanCollide = false
	body.Parent = model

	-- Name label
	local billboard = Instance.new("BillboardGui")
	billboard.Size = UDim2.new(0, 80, 0, 20)
	billboard.StudsOffset = Vector3.new(0, 2, 0)
	billboard.AlwaysOnTop = true
	billboard.Parent = body

	local nameLabel = Instance.new("TextLabel")
	nameLabel.Size = UDim2.new(1, 0, 1, 0)
	nameLabel.BackgroundTransparency = 1
	nameLabel.Text = petData.Name
	nameLabel.TextColor3 = RARITY_COLORS[petData.Rarity] or Color3.new(1, 1, 1)
	nameLabel.TextScaled = true
	nameLabel.Font = Enum.Font.GothamBold
	nameLabel.Parent = billboard

	-- Glow for rare+
	if petData.Rarity == "Epic" or petData.Rarity == "Legendary" then
		local light = Instance.new("PointLight")
		light.Color = RARITY_COLORS[petData.Rarity]
		light.Range = 8
		light.Brightness = 1
		light.Parent = body
	end

	model.PrimaryPart = body
	model.Parent = workspace

	-- Track
	if not activePetModels[player] then
		activePetModels[player] = {}
	end
	table.insert(activePetModels[player], model)

	-- Follow loop
	local petIndex = #activePetModels[player]
	task.spawn(function()
		while model.Parent and character.Parent do
			local targetHRP = character:FindFirstChild("HumanoidRootPart")
			if not targetHRP then break end

			-- Orbit behind player at different angles per pet
			local angle = tick() * 1.5 + petIndex * (math.pi * 2 / math.max(1, #(activePetModels[player] or {})))
			local radius = 4
			local offset = Vector3.new(
				math.cos(angle) * radius,
				1.5 + math.sin(tick() * 2) * 0.3, -- gentle bob
				math.sin(angle) * radius
			)
			local targetPos = targetHRP.Position + offset
			body.CFrame = body.CFrame:Lerp(CFrame.new(targetPos), 0.1)
			task.wait(0.03)
		end

		if model.Parent then model:Destroy() end
	end)
end

local function despawnPets(player: Player)
	local pets = activePetModels[player]
	if pets then
		for _, model in pets do
			if model.Parent then model:Destroy() end
		end
	end
	activePetModels[player] = nil
end

-- Spawn pet model after hatching
hatchEvent.OnServerEvent:Connect(function(player, eggPad)
	-- (Existing hatch logic above handles the data side)
	-- This secondary listener spawns the visible model
	-- The main listener fires first due to connection order
end)

-- Respawn pets when character loads
Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(function()
		task.wait(1) -- Wait for character to fully load
		local data = getPlayerData(player)
		if data and data.pets then
			despawnPets(player)
			for _, petData in ipairs(data.pets) do
				spawnPetModel(player, petData)
			end
		end
	end)
end)

Players.PlayerRemoving:Connect(function(player)
	despawnPets(player)
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
