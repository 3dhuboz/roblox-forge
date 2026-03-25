-- CombatManager: handles enemy spawning, AI, combat, and loot drops
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local RPGConfig = require(ReplicatedStorage:WaitForChild("RPGConfig"))

-- Remote events
local attackEvent = Instance.new("RemoteEvent")
attackEvent.Name = "AttackEnemy"
attackEvent.Parent = ReplicatedStorage

local enemyUpdate = Instance.new("RemoteEvent")
enemyUpdate.Name = "EnemyUpdate"
enemyUpdate.Parent = ReplicatedStorage

local lootEvent = Instance.new("RemoteEvent")
lootEvent.Name = "LootDrop"
lootEvent.Parent = ReplicatedStorage

-- Active enemies
local enemies = {}

local function getEnemyConfig(enemyName)
	for _, e in ipairs(RPGConfig.Enemies) do
		if e.Name == enemyName then
			return e
		end
	end
	return nil
end

local function getPlayerDamage(player)
	local baseDmg = RPGConfig.Stats.BaseDamage
	local level = 1
	local lvl = player:FindFirstChild("Level")
	if lvl then level = lvl.Value end
	local dmgPerLevel = RPGConfig.Stats.DamagePerLevel
	return baseDmg + (level - 1) * dmgPerLevel
end

local function spawnEnemy(spawnPoint, enemyName)
	local config = getEnemyConfig(enemyName)
	if not config then return end

	local enemy = Instance.new("Part")
	enemy.Name = enemyName
	enemy.Size = config.Size
	enemy.Position = spawnPoint.Position + Vector3.new(0, config.Size.Y / 2, 0)
	enemy.Color = config.Color
	enemy.Material = Enum.Material.Neon
	enemy.Anchored = true
	enemy.CanCollide = true
	enemy.Parent = workspace

	CollectionService:AddTag(enemy, "Enemy")
	CollectionService:AddTag(enemy, enemyName)

	local healthVal = Instance.new("NumberValue")
	healthVal.Name = "Health"
	healthVal.Value = config.Health
	healthVal.Parent = enemy

	local maxHealthVal = Instance.new("NumberValue")
	maxHealthVal.Name = "MaxHealth"
	maxHealthVal.Value = config.Health
	maxHealthVal.Parent = enemy

	enemies[enemy] = {
		config = config,
		spawnPoint = spawnPoint,
		alive = true,
	}

	-- Health bar billboard
	local billboard = Instance.new("BillboardGui")
	billboard.Size = UDim2.new(4, 0, 0.5, 0)
	billboard.StudsOffset = Vector3.new(0, config.Size.Y / 2 + 1, 0)
	billboard.AlwaysOnTop = true
	billboard.Parent = enemy

	local bg = Instance.new("Frame")
	bg.Size = UDim2.new(1, 0, 1, 0)
	bg.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
	bg.BorderSizePixel = 0
	bg.Parent = billboard

	local bar = Instance.new("Frame")
	bar.Name = "Bar"
	bar.Size = UDim2.new(1, -2, 1, -2)
	bar.Position = UDim2.new(0, 1, 0, 1)
	bar.BackgroundColor3 = Color3.fromRGB(220, 50, 50)
	bar.BorderSizePixel = 0
	bar.Parent = bg

	local nameLabel = Instance.new("TextLabel")
	nameLabel.Size = UDim2.new(1, 0, 1, 0)
	nameLabel.BackgroundTransparency = 1
	nameLabel.Text = config.Name .. " Lv." .. config.Level
	nameLabel.TextColor3 = Color3.new(1, 1, 1)
	nameLabel.TextSize = 14
	nameLabel.Font = Enum.Font.GothamBold
	nameLabel.Parent = billboard

	return enemy
end

-- Handle player attacks
attackEvent.OnServerEvent:Connect(function(player, enemyInstance)
	if not enemyInstance or not enemyInstance:IsA("BasePart") then return end
	if not CollectionService:HasTag(enemyInstance, "Enemy") then return end

	local data = enemies[enemyInstance]
	if not data or not data.alive then return end

	local health = enemyInstance:FindFirstChild("Health")
	if not health then return end

	-- Calculate damage
	local damage = getPlayerDamage(player)
	health.Value = health.Value - damage

	-- Update health bar
	local maxHealth = enemyInstance:FindFirstChild("MaxHealth")
	if maxHealth then
		local billboard = enemyInstance:FindFirstChildOfClass("BillboardGui")
		if billboard then
			local bg = billboard:FindFirstChild("Frame")
			if bg then
				local bar = bg:FindFirstChild("Bar")
				if bar then
					bar.Size = UDim2.new(math.max(health.Value / maxHealth.Value, 0), -2, 1, -2)
				end
			end
		end
	end

	-- Damage number feedback
	enemyUpdate:FireClient(player, {
		enemy = enemyInstance,
		damage = damage,
		currentHealth = health.Value,
		maxHealth = maxHealth and maxHealth.Value or 100,
	})

	-- Check death
	if health.Value <= 0 then
		data.alive = false

		-- Grant XP and gold
		local xp = player:FindFirstChild("XP")
		if xp then xp.Value = xp.Value + data.config.XPDrop end

		local gold = player:FindFirstChild("Gold")
		if gold then gold.Value = gold.Value + data.config.GoldDrop end

		-- Check level up
		checkLevelUp(player)

		-- Track quest progress
		local trackKill = game.ServerScriptService:FindFirstChild("QuestManager")
			and game.ServerScriptService.QuestManager:FindFirstChild("TrackKill")
		if trackKill then
			trackKill:Fire(player, data.config.Name)
		end

		lootEvent:FireClient(player, {
			enemyName = data.config.Name,
			xp = data.config.XPDrop,
			gold = data.config.GoldDrop,
		})

		-- Death effect
		task.spawn(function()
			for i = 0, 1, 0.1 do
				if enemyInstance and enemyInstance.Parent then
					enemyInstance.Transparency = i
					enemyInstance.Size = enemyInstance.Size * 0.95
				end
				task.wait(0.05)
			end
			if enemyInstance and enemyInstance.Parent then
				enemyInstance:Destroy()
			end
		end)

		-- Respawn after delay
		task.delay(data.config.RespawnTime, function()
			spawnEnemy(data.spawnPoint, data.config.Name)
		end)

		enemies[enemyInstance] = nil
	end
end)

function checkLevelUp(player)
	local xp = player:FindFirstChild("XP")
	local level = player:FindFirstChild("Level")
	if not xp or not level then return end

	local xpNeeded = RPGConfig.XPPerLevel * math.pow(RPGConfig.XPScaling, level.Value - 1)
	while xp.Value >= xpNeeded and level.Value < RPGConfig.MaxLevel do
		xp.Value = xp.Value - math.floor(xpNeeded)
		level.Value = level.Value + 1
		xpNeeded = RPGConfig.XPPerLevel * math.pow(RPGConfig.XPScaling, level.Value - 1)

		-- Update health
		local character = player.Character
		if character then
			local humanoid = character:FindFirstChild("Humanoid")
			if humanoid then
				local newMax = RPGConfig.Stats.BaseHealth + (level.Value - 1) * RPGConfig.Stats.HealthPerLevel
				humanoid.MaxHealth = newMax
				humanoid.Health = newMax
			end
		end

		print(player.Name .. " leveled up to " .. level.Value .. "!")
	end
end

-- Spawn initial enemies from tagged spawn points
for _, point in CollectionService:GetTagged("EnemySpawn") do
	for _, tag in ipairs(CollectionService:GetTags(point)) do
		if tag ~= "EnemySpawn" then
			spawnEnemy(point, tag)
			break
		end
	end
end

-- Player setup
Players.PlayerAdded:Connect(function(player)
	local level = Instance.new("IntValue")
	level.Name = "Level"
	level.Value = RPGConfig.StartingLevel
	level.Parent = player

	local xp = Instance.new("IntValue")
	xp.Name = "XP"
	xp.Value = RPGConfig.StartingXP
	xp.Parent = player

	local gold = Instance.new("IntValue")
	gold.Name = "Gold"
	gold.Value = RPGConfig.StartingGold
	gold.Parent = player

	player.CharacterAdded:Connect(function(character)
		task.wait(0.1)
		local humanoid = character:FindFirstChild("Humanoid")
		if humanoid then
			local hp = RPGConfig.Stats.BaseHealth + (level.Value - 1) * RPGConfig.Stats.HealthPerLevel
			humanoid.MaxHealth = hp
			humanoid.Health = hp
		end
	end)
end)

print("CombatManager loaded")
