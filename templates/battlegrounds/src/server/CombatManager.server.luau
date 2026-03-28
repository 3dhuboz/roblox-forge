-- CombatManager: handles abilities, damage, and combat mechanics
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local BattleConfig = require(ReplicatedStorage:WaitForChild("BattleConfig"))
local RateLimit = require(ReplicatedStorage:WaitForChild("RateLimit"))

-- Remote events
local useAbility = Instance.new("RemoteEvent")
useAbility.Name = "UseAbility"
useAbility.Parent = ReplicatedStorage

local selectClassEvent = Instance.new("RemoteEvent")
selectClassEvent.Name = "SelectClass"
selectClassEvent.Parent = ReplicatedStorage

local playerStatsEvent = Instance.new("RemoteEvent")
playerStatsEvent.Name = "PlayerStats"
playerStatsEvent.Parent = ReplicatedStorage

local damageEvent = Instance.new("RemoteEvent")
damageEvent.Name = "DamageEvent"
damageEvent.Parent = ReplicatedStorage

local killFeedEvent = Instance.new("RemoteEvent")
killFeedEvent.Name = "KillFeed"
killFeedEvent.Parent = ReplicatedStorage

-- Player state
local playerState = {}
local cooldowns = {}

local function getAbilityConfig(abilityName)
	for _, ability in ipairs(BattleConfig.Abilities) do
		if ability.Name == abilityName then
			return ability
		end
	end
	return nil
end

local function getClassConfig(className)
	for _, class in ipairs(BattleConfig.Classes) do
		if class.Name == className then
			return class
		end
	end
	return nil
end

local function initPlayer(player)
	playerState[player] = {
		class = "Warrior",
		kills = 0,
		deaths = 0,
		assists = 0,
		coins = 0,
		inMatch = false,
	}
	cooldowns[player] = {}
end

local function applyClassStats(player)
	local state = playerState[player]
	if not state then return end

	local classConfig = getClassConfig(state.class)
	if not classConfig then return end

	local character = player.Character
	if not character then return end

	local humanoid = character:FindFirstChild("Humanoid")
	if humanoid then
		humanoid.MaxHealth = classConfig.Health
		humanoid.Health = classConfig.Health
		humanoid.WalkSpeed = classConfig.Speed
		humanoid.JumpPower = BattleConfig.JumpPower
	end
end

-- Handle class selection
selectClassEvent.OnServerEvent:Connect(function(player, className)
	if not RateLimit.check(player, "class_select", 1) then return end
	local state = playerState[player]
	if not state then return end

	local classConfig = getClassConfig(className)
	if not classConfig then
		selectClassEvent:FireClient(player, { type = "error", message = "Unknown class: " .. tostring(className) })
		return
	end

	state.class = className
	applyClassStats(player)

	selectClassEvent:FireClient(player, {
		type = "class_selected",
		class = className,
		health = classConfig.Health,
		speed = classConfig.Speed,
		abilities = classConfig.Abilities,
	})

	-- Broadcast updated stats
	playerStatsEvent:FireAllClients(player.Name, {
		class = className,
		kills = state.kills,
		deaths = state.deaths,
	})
end)

-- Leaderstats (visible on player list)
local function setupLeaderstats(player)
	local folder = Instance.new("Folder")
	folder.Name = "leaderstats"
	folder.Parent = player

	local kills = Instance.new("IntValue")
	kills.Name = "Kills"
	kills.Value = 0
	kills.Parent = folder

	local deaths = Instance.new("IntValue")
	deaths.Name = "Deaths"
	deaths.Value = 0
	deaths.Parent = folder

	local classVal = Instance.new("StringValue")
	classVal.Name = "Class"
	classVal.Value = "Warrior"
	classVal.Parent = folder
end

local function updateLeaderstats(player)
	local state = playerState[player]
	if not state then return end
	local stats = player:FindFirstChild("leaderstats")
	if not stats then return end
	local killsVal = stats:FindFirstChild("Kills")
	if killsVal then killsVal.Value = state.kills end
	local deathsVal = stats:FindFirstChild("Deaths")
	if deathsVal then deathsVal.Value = state.deaths end
	local classVal = stats:FindFirstChild("Class")
	if classVal then classVal.Value = state.class end
end

-- Handle ability usage
useAbility.OnServerEvent:Connect(function(player, abilityName, targetPosition)
	if not RateLimit.check(player, "ability", 0.1) then return end
	local state = playerState[player]
	if not state or not state.inMatch then return end

	local classConfig = getClassConfig(state.class)
	if not classConfig then return end

	-- Check if class has this ability
	local hasAbility = false
	for _, name in ipairs(classConfig.Abilities) do
		if name == abilityName then
			hasAbility = true
			break
		end
	end
	if not hasAbility then return end

	-- Check cooldown
	local now = tick()
	if cooldowns[player][abilityName] and now < cooldowns[player][abilityName] then
		return
	end

	local abilityConfig = getAbilityConfig(abilityName)
	if not abilityConfig then return end

	-- Set cooldown
	cooldowns[player][abilityName] = now + abilityConfig.Cooldown

	local character = player.Character
	if not character then return end
	local rootPart = character:FindFirstChild("HumanoidRootPart")
	if not rootPart then return end

	-- Create projectile or area effect
	if abilityConfig.Range > 15 then
		-- Ranged projectile
		local projectile = Instance.new("Part")
		projectile.Name = "Projectile_" .. abilityName
		projectile.Size = Vector3.new(2, 2, 2)
		projectile.Shape = Enum.PartType.Ball
		projectile.Color = abilityConfig.Color
		projectile.Material = Enum.Material.Neon
		projectile.Anchored = false
		projectile.CanCollide = false
		projectile.Position = rootPart.Position + rootPart.CFrame.LookVector * 3
		projectile.Parent = workspace

		local direction = (targetPosition - rootPart.Position).Unit
		local velocity = Instance.new("BodyVelocity")
		velocity.Velocity = direction * 80
		velocity.MaxForce = Vector3.new(math.huge, math.huge, math.huge)
		velocity.Parent = projectile

		-- Damage on hit
		projectile.Touched:Connect(function(hit)
			local hitCharacter = hit.Parent
			local hitPlayer = Players:GetPlayerFromCharacter(hitCharacter)
			if hitPlayer and hitPlayer ~= player then
				local humanoid = hitCharacter:FindFirstChild("Humanoid")
				if humanoid and humanoid.Health > 0 then
					humanoid:TakeDamage(abilityConfig.Damage)
					damageEvent:FireAllClients(hitPlayer, abilityConfig.Damage, abilityName)

					if humanoid.Health <= 0 then
						state.kills = state.kills + 1
						state.coins = state.coins + BattleConfig.KillReward
						local victimState = playerState[hitPlayer]
						if victimState then
							victimState.deaths = victimState.deaths + 1
						end
						killFeedEvent:FireAllClients(player.Name, hitPlayer.Name, abilityName)
					end
				end
				projectile:Destroy()
			end
		end)

		-- Auto-destroy after 3 seconds
		task.delay(3, function()
			if projectile and projectile.Parent then
				projectile:Destroy()
			end
		end)
	else
		-- Melee / area ability
		for _, otherPlayer in Players:GetPlayers() do
			if otherPlayer ~= player and playerState[otherPlayer] and playerState[otherPlayer].inMatch then
				local otherChar = otherPlayer.Character
				if otherChar then
					local otherRoot = otherChar:FindFirstChild("HumanoidRootPart")
					if otherRoot then
						local dist = (otherRoot.Position - rootPart.Position).Magnitude
						if dist <= abilityConfig.Range then
							local humanoid = otherChar:FindFirstChild("Humanoid")
							if humanoid then
								if abilityConfig.Damage < 0 then
									-- Heal
									humanoid.Health = math.min(humanoid.MaxHealth, humanoid.Health - abilityConfig.Damage)
								else
									humanoid:TakeDamage(abilityConfig.Damage)
									if humanoid.Health <= 0 then
										state.kills = state.kills + 1
										state.coins = state.coins + BattleConfig.KillReward
										killFeedEvent:FireAllClients(player.Name, otherPlayer.Name, abilityName)
									end
								end
							end
						end
					end
				end
			end
		end
	end
end)

-- Setup
Players.PlayerAdded:Connect(function(player)
	initPlayer(player)
	setupLeaderstats(player)
	player.CharacterAdded:Connect(function()
		task.wait(0.1)
		applyClassStats(player)
	end)
end)

Players.PlayerRemoving:Connect(function(player)
	playerState[player] = nil
	cooldowns[player] = nil
end)

for _, player in Players:GetPlayers() do
	initPlayer(player)
	setupLeaderstats(player)
end

-- Update leaderstats every 2 seconds
task.spawn(function()
	while true do
		task.wait(2)
		for _, player in Players:GetPlayers() do
			updateLeaderstats(player)
		end
	end
end)

print("CombatManager loaded")
