--[[
	EnemyAI.server.luau
	Drives enemy NPCs using CollectionService tags and PathfindingService.

	Tag: "Enemy"
	Reads Attributes:
	  AIBehavior (string)   — "chase", "patrol", "wander", "stationary" (default: "chase")
	  WalkSpeed (number)    — movement speed (default: 12)
	  AttackRange (number)  — studs to start attacking (default: 5)
	  AttackDamage (number) — damage per hit (default: 10)
	  AttackCooldown (number) — seconds between attacks (default: 1)
	  AggroRange (number)   — studs to detect player (default: 40)
	  MaxHealth (number)    — enemy health (default: 100)
	  RespawnTime (number)  — seconds to respawn (default: 10)
]]

local CollectionService = game:GetService("CollectionService")
local PathfindingService = game:GetService("PathfindingService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local function getAttr(inst: Instance, name: string, default: any): any
	local val = inst:GetAttribute(name)
	return if val ~= nil then val else default
end

--- Convert a tagged Part into a proper NPC Model with Humanoid.
local function makeNPCModel(part: BasePart): Model
	-- If already a Model parent with Humanoid, use it
	if part.Parent and part.Parent:IsA("Model") and part.Parent:FindFirstChildOfClass("Humanoid") then
		return part.Parent :: Model
	end

	-- Build an NPC model from the part
	local model = Instance.new("Model")
	model.Name = part.Name

	-- Create torso (the original part becomes it)
	part.Name = "HumanoidRootPart"
	part.Anchored = false
	part.CanCollide = true

	-- Ensure minimum size for a character
	if part.Size.Y < 4 then
		part.Size = Vector3.new(math.max(part.Size.X, 2), 5, math.max(part.Size.Z, 2))
	end

	local humanoid = Instance.new("Humanoid")
	humanoid.MaxHealth = getAttr(part, "MaxHealth", 100)
	humanoid.Health = humanoid.MaxHealth
	humanoid.WalkSpeed = getAttr(part, "WalkSpeed", 12)
	humanoid.Parent = model

	local parent = part.Parent
	local spawnCFrame = part.CFrame

	part.Parent = model
	model.PrimaryPart = part
	model.Parent = parent

	-- Store spawn position for respawn
	model:SetAttribute("SpawnCFrame", spawnCFrame)

	return model
end

--- Find the nearest player character within range.
local function findNearestPlayer(position: Vector3, range: number): (Model?, number)
	local nearest: Model? = nil
	local nearestDist = range

	for _, player in Players:GetPlayers() do
		local character = player.Character
		if not character then continue end
		local hrp = character:FindFirstChild("HumanoidRootPart") :: BasePart?
		if not hrp then continue end
		local humanoid = character:FindFirstChildOfClass("Humanoid")
		if not humanoid or humanoid.Health <= 0 then continue end

		local dist = (hrp.Position - position).Magnitude
		if dist < nearestDist then
			nearest = character
			nearestDist = dist
		end
	end

	return nearest, nearestDist
end

--- Move to a position using PathfindingService.
local function moveTo(model: Model, humanoid: Humanoid, target: Vector3)
	local hrp = model.PrimaryPart
	if not hrp then return end

	local path = PathfindingService:CreatePath({
		AgentRadius = 2,
		AgentHeight = 5,
		AgentCanJump = true,
		AgentCanClimb = false,
	})

	local success, _ = pcall(function()
		path:ComputeAsync(hrp.Position, target)
	end)

	if not success or path.Status ~= Enum.PathStatus.Success then
		-- Fallback: direct movement
		humanoid:MoveTo(target)
		return
	end

	local waypoints = path:GetWaypoints()
	for _, waypoint in waypoints do
		if not hrp.Parent then return end
		humanoid:MoveTo(waypoint.Position)
		if waypoint.Action == Enum.PathWaypointAction.Jump then
			humanoid.Jump = true
		end
		-- Wait for movement to complete or timeout
		local reached = humanoid.MoveToFinished:Wait()
		if not reached then break end
	end
end

--- Attack a target character.
local function attackTarget(model: Model, target: Model, damage: number)
	local targetHumanoid = target:FindFirstChildOfClass("Humanoid")
	if targetHumanoid and targetHumanoid.Health > 0 then
		targetHumanoid:TakeDamage(damage)
	end
end

--- Run the AI loop for a single enemy.
local function runEnemyAI(part: BasePart)
	local model = makeNPCModel(part)
	local humanoid = model:FindFirstChildOfClass("Humanoid")
	if not humanoid then return end

	local behavior = getAttr(part, "AIBehavior", "chase")
	local attackRange = getAttr(part, "AttackRange", 5)
	local attackDamage = getAttr(part, "AttackDamage", 10)
	local attackCooldown = getAttr(part, "AttackCooldown", 1)
	local aggroRange = getAttr(part, "AggroRange", 40)
	local respawnTime = getAttr(part, "RespawnTime", 10)
	local spawnCFrame = model:GetAttribute("SpawnCFrame") or (model.PrimaryPart and model.PrimaryPart.CFrame)

	local lastAttackTime = 0
	local patrolTarget: Vector3? = nil

	-- Handle death → respawn
	humanoid.Died:Connect(function()
		task.wait(respawnTime)
		-- Respawn: restore health, teleport back
		if model.PrimaryPart then
			humanoid.Health = humanoid.MaxHealth
			model.PrimaryPart.CFrame = spawnCFrame or CFrame.new(0, 10, 0)
		end
	end)

	-- Main AI loop
	while model.Parent and humanoid.Health > 0 do
		local hrp = model.PrimaryPart
		if not hrp then task.wait(1) continue end

		if behavior == "stationary" then
			-- Just stand and attack if player is in range
			local target, dist = findNearestPlayer(hrp.Position, attackRange)
			if target and tick() - lastAttackTime >= attackCooldown then
				attackTarget(model, target, attackDamage)
				lastAttackTime = tick()
			end
			task.wait(0.5)

		elseif behavior == "chase" then
			local target, dist = findNearestPlayer(hrp.Position, aggroRange)
			if target then
				local targetHRP = target:FindFirstChild("HumanoidRootPart") :: BasePart?
				if targetHRP then
					if dist <= attackRange then
						-- In range — attack
						if tick() - lastAttackTime >= attackCooldown then
							attackTarget(model, target, attackDamage)
							lastAttackTime = tick()
						end
						humanoid:MoveTo(targetHRP.Position)
					else
						-- Chase using pathfinding
						moveTo(model, humanoid, targetHRP.Position)
					end
				end
			else
				-- No target — return to spawn
				if spawnCFrame then
					local distFromSpawn = (hrp.Position - spawnCFrame.Position).Magnitude
					if distFromSpawn > 5 then
						humanoid:MoveTo(spawnCFrame.Position)
						humanoid.MoveToFinished:Wait()
					end
				end
			end
			task.wait(0.3)

		elseif behavior == "patrol" then
			-- Pick random nearby point, walk to it, repeat
			if not patrolTarget or (hrp.Position - patrolTarget).Magnitude < 3 then
				local angle = math.random() * math.pi * 2
				local radius = math.random(10, 25)
				local origin = if spawnCFrame then spawnCFrame.Position else hrp.Position
				patrolTarget = origin + Vector3.new(
					math.cos(angle) * radius,
					0,
					math.sin(angle) * radius
				)
			end

			-- Check for aggro while patrolling
			local target, dist = findNearestPlayer(hrp.Position, aggroRange)
			if target then
				local targetHRP = target:FindFirstChild("HumanoidRootPart") :: BasePart?
				if targetHRP then
					if dist <= attackRange then
						if tick() - lastAttackTime >= attackCooldown then
							attackTarget(model, target, attackDamage)
							lastAttackTime = tick()
						end
					else
						moveTo(model, humanoid, targetHRP.Position)
					end
				end
			else
				humanoid:MoveTo(patrolTarget)
				humanoid.MoveToFinished:Wait()
			end
			task.wait(0.5)

		elseif behavior == "wander" then
			-- Random walking, no aggro
			local angle = math.random() * math.pi * 2
			local radius = math.random(5, 15)
			local origin = if spawnCFrame then spawnCFrame.Position else hrp.Position
			local wanderTarget = origin + Vector3.new(
				math.cos(angle) * radius,
				0,
				math.sin(angle) * radius
			)
			humanoid:MoveTo(wanderTarget)
			humanoid.MoveToFinished:Wait()
			task.wait(math.random(1, 3))
		end
	end
end

-- ── Initialize ──

for _, part in CollectionService:GetTagged("Enemy") do
	task.spawn(runEnemyAI, part)
end

CollectionService:GetInstanceAddedSignal("Enemy"):Connect(function(part)
	if part:IsA("BasePart") then
		task.spawn(runEnemyAI, part)
	end
end)
