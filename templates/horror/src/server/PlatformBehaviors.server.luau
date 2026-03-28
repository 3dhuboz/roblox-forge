--[[
	PlatformBehaviors.server.luau
	Drives ALL dynamic platform mechanics using CollectionService tags.

	Tags handled:
	  MovingPlatform   → tweens back and forth
	  DisappearPlatform → fades out on touch, reappears after delay
	  BouncyPlatform   → launches player upward on touch
	  Spinner          → rotates continuously
	  Conveyor         → pushes parts/players in a direction
	  KillBrick        → kills player on touch (backup for StageManager)

	Each part reads its behavior from Attributes set in the model file:
	  MoveDistance (number)   — how far to move (studs)
	  MoveSpeed (number)     — movement speed (studs/sec)
	  MoveDirection (string) — "x", "y", "z", or "horizontal"/"vertical"
	  DisappearDelay (number)  — seconds before disappearing after touch
	  ReappearDelay (number)   — seconds before reappearing
	  BounceForce (number)     — upward velocity applied
	  SpinSpeed (number)       — radians per second
	  ConveyorSpeed (number)   — studs per second
	  ConveyorDirection (string) — "left","right","forward","backward"
]]

local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Players = game:GetService("Players")

-- ── Helper ──

local function getAttr(part: BasePart, name: string, default: any): any
	local val = part:GetAttribute(name)
	if val ~= nil then
		return val
	end
	return default
end

local function getCharacterFromPart(hit: BasePart): (Model?, Humanoid?)
	local character = hit.Parent
	if not character then return nil, nil end
	local humanoid = character:FindFirstChildOfClass("Humanoid")
	if not humanoid then return nil, nil end
	if not Players:GetPlayerFromCharacter(character) then return nil, nil end
	return character, humanoid
end

-- ── Moving Platform ──

local function setupMovingPlatform(part: BasePart)
	local distance = getAttr(part, "MoveDistance", 20)
	local speed = getAttr(part, "MoveSpeed", 4)
	local direction = getAttr(part, "MoveDirection", "x")

	local startCFrame = part.CFrame
	local moveVector: Vector3

	if direction == "y" or direction == "vertical" then
		moveVector = Vector3.new(0, distance, 0)
	elseif direction == "z" or direction == "forward" then
		moveVector = Vector3.new(0, 0, distance)
	else -- "x" or "horizontal" or default
		moveVector = Vector3.new(distance, 0, 0)
	end

	local endCFrame = startCFrame + moveVector
	local tweenTime = distance / math.max(speed, 0.1)

	local tweenInfo = TweenInfo.new(tweenTime, Enum.EasingStyle.Linear, Enum.EasingDirection.InOut, -1, true)
	local tween = TweenService:Create(part, tweenInfo, { CFrame = endCFrame })
	tween:Play()
end

for _, part in CollectionService:GetTagged("MovingPlatform") do
	task.spawn(setupMovingPlatform, part)
end
CollectionService:GetInstanceAddedSignal("MovingPlatform"):Connect(function(part)
	task.spawn(setupMovingPlatform, part)
end)

-- ── Disappearing Platform ──

local function setupDisappearPlatform(part: BasePart)
	local disappearDelay = getAttr(part, "DisappearDelay", 1.5)
	local reappearDelay = getAttr(part, "ReappearDelay", 3)
	local originalTransparency = part.Transparency
	local debounce = false

	part.Touched:Connect(function(hit)
		if debounce then return end
		local _, humanoid = getCharacterFromPart(hit)
		if not humanoid then return end

		debounce = true

		-- Flash warning
		for i = 1, 3 do
			part.Transparency = 0.5
			task.wait(disappearDelay / 6)
			part.Transparency = originalTransparency
			task.wait(disappearDelay / 6)
		end

		-- Disappear
		part.Transparency = 1
		part.CanCollide = false

		-- Reappear after delay
		task.wait(reappearDelay)
		part.Transparency = originalTransparency
		part.CanCollide = true
		debounce = false
	end)
end

for _, part in CollectionService:GetTagged("DisappearPlatform") do
	task.spawn(setupDisappearPlatform, part)
end
CollectionService:GetInstanceAddedSignal("DisappearPlatform"):Connect(function(part)
	task.spawn(setupDisappearPlatform, part)
end)

-- ── Bouncy Platform ──

local function setupBouncyPlatform(part: BasePart)
	local bounceForce = getAttr(part, "BounceForce", 80)

	part.Touched:Connect(function(hit)
		local character, humanoid = getCharacterFromPart(hit)
		if not humanoid then return end

		local hrp = character:FindFirstChild("HumanoidRootPart") :: BasePart?
		if hrp then
			hrp.AssemblyLinearVelocity = Vector3.new(
				hrp.AssemblyLinearVelocity.X,
				bounceForce,
				hrp.AssemblyLinearVelocity.Z
			)
		end
	end)
end

for _, part in CollectionService:GetTagged("BouncyPlatform") do
	task.spawn(setupBouncyPlatform, part)
end
CollectionService:GetInstanceAddedSignal("BouncyPlatform"):Connect(function(part)
	task.spawn(setupBouncyPlatform, part)
end)

-- ── Spinner ──

local function setupSpinner(part: BasePart)
	local spinSpeed = getAttr(part, "SpinSpeed", 3) -- radians/sec

	RunService.Heartbeat:Connect(function(dt)
		if not part.Parent then return end
		part.CFrame = part.CFrame * CFrame.Angles(0, spinSpeed * dt, 0)
	end)
end

for _, part in CollectionService:GetTagged("Spinner") do
	task.spawn(setupSpinner, part)
end
CollectionService:GetInstanceAddedSignal("Spinner"):Connect(function(part)
	task.spawn(setupSpinner, part)
end)

-- ── Conveyor ──

local function setupConveyor(part: BasePart)
	local speed = getAttr(part, "ConveyorSpeed", 12)
	local direction = getAttr(part, "ConveyorDirection", "forward")

	local directionVector: Vector3
	if direction == "left" then
		directionVector = Vector3.new(-speed, 0, 0)
	elseif direction == "right" then
		directionVector = Vector3.new(speed, 0, 0)
	elseif direction == "backward" then
		directionVector = Vector3.new(0, 0, -speed)
	else -- "forward" or default
		directionVector = Vector3.new(0, 0, speed)
	end

	part.AssemblyLinearVelocity = directionVector
end

for _, part in CollectionService:GetTagged("Conveyor") do
	task.spawn(setupConveyor, part)
end
CollectionService:GetInstanceAddedSignal("Conveyor"):Connect(function(part)
	task.spawn(setupConveyor, part)
end)
