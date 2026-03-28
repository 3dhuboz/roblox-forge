--[[
	MinigameLoader.server.luau
	Handles loading/unloading arenas AND running game-specific logic.
	Called by RoundManager via BindableEvents.

	Each minigame:
	  1. Loads its arena (shows/hides parts)
	  2. Teleports players to spawn points
	  3. Runs game-specific mechanics
	  4. Eliminates players via the EliminatePlayer BindableEvent
]]
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerScriptService = game:GetService("ServerScriptService")

local MiniConfig = require(ReplicatedStorage:WaitForChild("MiniConfig"))

local activeArena = nil
local activeCleanup: (() -> ())? = nil

-- Get the RoundManager's eliminate event
local roundManager = ServerScriptService:WaitForChild("RoundManager")
local eliminateEvent = roundManager:WaitForChild("EliminatePlayer")

-- ── Arena management ──

local function loadArena(minigameName: string): Folder?
	unloadArena()
	local gamesFolder = workspace:FindFirstChild("Games")
	if not gamesFolder then return nil end

	local arenaName = minigameName:gsub(" ", "")
	for _, child in gamesFolder:GetChildren() do
		if child.Name == arenaName then
			activeArena = child
			for _, part in child:GetDescendants() do
				if part:IsA("BasePart") then
					part.Transparency = 0
					part.CanCollide = true
				end
			end
			return child
		end
	end
	return nil
end

function unloadArena()
	-- Run cleanup from previous minigame
	if activeCleanup then
		activeCleanup()
		activeCleanup = nil
	end

	if activeArena then
		for _, part in activeArena:GetDescendants() do
			if part:IsA("BasePart") then
				part.Transparency = 1
				part.CanCollide = false
			end
		end
		activeArena = nil
	end
end

local function teleportPlayersToArena(arena: Instance)
	local spawns = {}
	for _, child in arena:GetDescendants() do
		if child:IsA("SpawnLocation") then
			table.insert(spawns, child)
		end
	end

	if #spawns == 0 then
		-- Fallback: teleport to arena center
		for _, player in Players:GetPlayers() do
			local character = player.Character
			if character and character:FindFirstChild("HumanoidRootPart") then
				character.HumanoidRootPart.CFrame = CFrame.new(0, 10, 0)
			end
		end
		return
	end

	for i, player in Players:GetPlayers() do
		local character = player.Character
		if character and character:FindFirstChild("HumanoidRootPart") then
			local spawn = spawns[((i - 1) % #spawns) + 1]
			character.HumanoidRootPart.CFrame = spawn.CFrame + Vector3.new(0, 3, 0)
		end
	end
end

-- ── Minigame implementations ──

local function runFloorIsLava(arena: Instance)
	local floor = nil
	for _, child in arena:GetDescendants() do
		if CollectionService:HasTag(child, "DisappearFloor") or child.Name == "Floor" then
			floor = child
			break
		end
	end

	-- If no tagged floor, create a temporary one
	if not floor then
		floor = Instance.new("Part")
		floor.Name = "Floor"
		floor.Size = Vector3.new(60, 2, 60)
		floor.Position = Vector3.new(0, 0, 0)
		floor.Color = Color3.fromRGB(80, 200, 80)
		floor.Material = Enum.Material.Grass
		floor.Anchored = true
		floor.Parent = arena
	end

	local originalSize = floor.Size
	local running = true

	activeCleanup = function()
		running = false
		if floor and floor.Parent then
			floor.Size = originalSize
			floor.Transparency = 0
			floor.CanCollide = true
		end
	end

	task.spawn(function()
		task.wait(5)
		for i = 1, 20 do
			if not running then break end
			task.wait(2)
			if not floor or not floor.Parent then break end
			local shrink = 1 - (i / 25)
			floor.Size = Vector3.new(originalSize.X * shrink, originalSize.Y, originalSize.Z * shrink)
			floor.Color = Color3.fromRGB(
				math.min(255, 80 + i * 8),
				math.max(0, 200 - i * 10),
				80
			)
		end
		if floor and floor.Parent then
			floor.Transparency = 1
			floor.CanCollide = false
		end
	end)
end

local function runKingOfTheHill(arena: Instance)
	local hill = nil
	for _, child in arena:GetDescendants() do
		if child.Name == "Hill" or CollectionService:HasTag(child, "Hill") then
			hill = child
			break
		end
	end

	if not hill then
		hill = Instance.new("Part")
		hill.Name = "Hill"
		hill.Size = Vector3.new(12, 1, 12)
		hill.Position = Vector3.new(0, 5, 0)
		hill.Color = Color3.fromRGB(255, 215, 0)
		hill.Material = Enum.Material.Neon
		hill.Anchored = true
		hill.Parent = arena
	end

	local scores: { [Player]: number } = {}
	local running = true

	activeCleanup = function() running = false end

	task.spawn(function()
		while running do
			task.wait(1)
			-- Check who's on the hill
			for _, player in Players:GetPlayers() do
				local character = player.Character
				if not character then continue end
				local hrp = character:FindFirstChild("HumanoidRootPart")
				if not hrp then continue end

				local dist = (hrp.Position - hill.Position).Magnitude
				if dist < hill.Size.X then
					scores[player] = (scores[player] or 0) + 1
				end
			end
		end
	end)
end

local function runObbyRace(arena: Instance)
	-- First player to reach the finish line wins
	-- Others get eliminated when time runs out
	local finish = nil
	for _, child in arena:GetDescendants() do
		if child.Name == "FinishLine" or CollectionService:HasTag(child, "FinishLine") then
			finish = child
			break
		end
	end

	if not finish then
		finish = Instance.new("Part")
		finish.Name = "FinishLine"
		finish.Size = Vector3.new(20, 8, 2)
		finish.Position = Vector3.new(0, 4, 100)
		finish.Color = Color3.fromRGB(0, 255, 0)
		finish.Material = Enum.Material.Neon
		finish.Transparency = 0.5
		finish.Anchored = true
		finish.CanCollide = false
		finish.Parent = arena
	end

	local finished: { [Player]: boolean } = {}
	local conn: RBXScriptConnection? = nil

	conn = finish.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player or finished[player] then return end
		finished[player] = true
		-- First to finish is safe, rest get eliminated when time ends
	end)

	activeCleanup = function()
		if conn then conn:Disconnect() end
		-- Eliminate anyone who didn't finish
		for _, player in Players:GetPlayers() do
			if not finished[player] then
				eliminateEvent:Fire(player)
			end
		end
	end
end

local function runSwordFight(arena: Instance)
	-- Give everyone a sword tool, last standing wins
	local swords: { [Player]: Tool } = {}

	for _, player in Players:GetPlayers() do
		local character = player.Character
		if not character then continue end

		local sword = Instance.new("Tool")
		sword.Name = "Sword"
		sword.RequiresHandle = true

		local handle = Instance.new("Part")
		handle.Name = "Handle"
		handle.Size = Vector3.new(1, 0.5, 4)
		handle.Color = Color3.fromRGB(150, 150, 150)
		handle.Material = Enum.Material.Metal
		handle.Parent = sword

		sword.Parent = player.Backpack
		swords[player] = sword

		-- Sword damage on activation
		sword.Activated:Connect(function()
			local hrp = character:FindFirstChild("HumanoidRootPart")
			if not hrp then return end

			-- Damage nearby enemies
			for _, other in Players:GetPlayers() do
				if other == player then continue end
				local otherChar = other.Character
				if not otherChar then continue end
				local otherHRP = otherChar:FindFirstChild("HumanoidRootPart")
				if not otherHRP then continue end

				if (otherHRP.Position - hrp.Position).Magnitude < 8 then
					local humanoid = otherChar:FindFirstChildOfClass("Humanoid")
					if humanoid and humanoid.Health > 0 then
						humanoid:TakeDamage(25)
						if humanoid.Health <= 0 then
							eliminateEvent:Fire(other)
						end
					end
				end
			end
		end)
	end

	activeCleanup = function()
		for _, sword in pairs(swords) do
			if sword and sword.Parent then sword:Destroy() end
		end
	end
end

local function runFreezeTag(arena: Instance)
	-- Pick a random "it" player, they freeze others by touching them
	local players = Players:GetPlayers()
	if #players < 2 then return end

	local itPlayer = players[math.random(1, #players)]
	local frozen: { [Player]: boolean } = {}
	local running = true
	local connections: { RBXScriptConnection } = {}

	-- Notify "it" player
	local roundEvent = ReplicatedStorage:FindFirstChild("RoundEvent")
	if roundEvent then
		for _, player in players do
			roundEvent:FireClient(player, {
				type = "freeze_tag_role",
				isIt = player == itPlayer,
				itPlayer = itPlayer.Name,
			})
		end
	end

	-- Speed boost for "it"
	local itChar = itPlayer.Character
	if itChar then
		local humanoid = itChar:FindFirstChildOfClass("Humanoid")
		if humanoid then humanoid.WalkSpeed = 20 end
	end

	-- Detect "it" touching others
	task.spawn(function()
		while running do
			task.wait(0.2)
			local itCharNow = itPlayer.Character
			if not itCharNow then continue end
			local itHRP = itCharNow:FindFirstChild("HumanoidRootPart")
			if not itHRP then continue end

			for _, player in Players:GetPlayers() do
				if player == itPlayer or frozen[player] then continue end
				local char = player.Character
				if not char then continue end
				local hrp = char:FindFirstChild("HumanoidRootPart")
				if not hrp then continue end

				if (hrp.Position - itHRP.Position).Magnitude < 5 then
					frozen[player] = true
					local humanoid = char:FindFirstChildOfClass("Humanoid")
					if humanoid then
						humanoid.WalkSpeed = 0
						humanoid.JumpPower = 0
					end

					-- Check if all frozen
					local unfrozenCount = 0
					for _, p in Players:GetPlayers() do
						if p ~= itPlayer and not frozen[p] then
							unfrozenCount += 1
						end
					end
					if unfrozenCount == 0 then
						-- "It" wins - eliminate everyone else
						for _, p in Players:GetPlayers() do
							if p ~= itPlayer then
								eliminateEvent:Fire(p)
							end
						end
						break
					end
				end
			end
		end
	end)

	activeCleanup = function()
		running = false
		-- Restore walk speeds
		for _, player in Players:GetPlayers() do
			local char = player.Character
			if char then
				local humanoid = char:FindFirstChildOfClass("Humanoid")
				if humanoid then
					humanoid.WalkSpeed = 16
					humanoid.JumpPower = 50
				end
			end
		end
		for _, conn in connections do conn:Disconnect() end
	end
end

local function runSimonSays(arena: Instance)
	-- Create colored pads, announce a color, players must stand on it
	local padColors = {
		{ name = "Red", color = Color3.fromRGB(255, 50, 50) },
		{ name = "Blue", color = Color3.fromRGB(50, 50, 255) },
		{ name = "Green", color = Color3.fromRGB(50, 255, 50) },
		{ name = "Yellow", color = Color3.fromRGB(255, 255, 50) },
	}

	local pads: { [string]: BasePart } = {}
	local running = true

	-- Create or find color pads
	for i, pc in ipairs(padColors) do
		local existing = nil
		for _, child in arena:GetDescendants() do
			if child.Name == pc.name .. "Pad" then
				existing = child
				break
			end
		end

		if not existing then
			existing = Instance.new("Part")
			existing.Name = pc.name .. "Pad"
			existing.Size = Vector3.new(15, 1, 15)
			existing.Color = pc.color
			existing.Material = Enum.Material.Neon
			existing.Anchored = true
			local angle = (i - 1) * (math.pi * 2 / #padColors)
			existing.Position = Vector3.new(math.cos(angle) * 20, 0, math.sin(angle) * 20)
			existing.Parent = arena
		end

		pads[pc.name] = existing
	end

	local roundEvent = ReplicatedStorage:FindFirstChild("RoundEvent")

	activeCleanup = function() running = false end

	task.spawn(function()
		task.wait(3)
		for round = 1, 10 do
			if not running then break end

			-- Pick a random color
			local target = padColors[math.random(1, #padColors)]

			-- Announce
			if roundEvent then
				for _, player in Players:GetPlayers() do
					roundEvent:FireClient(player, {
						type = "simon_says",
						command = "Stand on " .. target.name .. "!",
						timeLimit = math.max(3, 6 - round * 0.3),
					})
				end
			end

			-- Wait for time limit
			local timeLimit = math.max(3, 6 - round * 0.3)
			task.wait(timeLimit)

			-- Eliminate players NOT on the correct pad
			local pad = pads[target.name]
			if pad then
				for _, player in Players:GetPlayers() do
					local char = player.Character
					if not char then continue end
					local hrp = char:FindFirstChild("HumanoidRootPart")
					if not hrp then continue end

					local dx = math.abs(hrp.Position.X - pad.Position.X)
					local dz = math.abs(hrp.Position.Z - pad.Position.Z)
					if dx > pad.Size.X / 2 + 2 or dz > pad.Size.Z / 2 + 2 then
						eliminateEvent:Fire(player)
					end
				end
			end

			task.wait(2)
		end
	end)
end

-- ── Minigame dispatcher ──

local minigameHandlers = {
	["Floor is Lava"] = runFloorIsLava,
	["King of the Hill"] = runKingOfTheHill,
	["Obby Race"] = runObbyRace,
	["Sword Fight"] = runSwordFight,
	["Freeze Tag"] = runFreezeTag,
	["Simon Says"] = runSimonSays,
}

-- Listen for round lifecycle from RoundManager
local roundStartEvent = Instance.new("BindableEvent")
roundStartEvent.Name = "StartMinigame"
roundStartEvent.Parent = script

roundStartEvent.Event:Connect(function(minigameName)
	local arena = loadArena(minigameName)
	if arena then
		teleportPlayersToArena(arena)
	end

	local handler = minigameHandlers[minigameName]
	if handler then
		if arena then
			handler(arena)
		else
			-- Create temporary arena
			local tempArena = Instance.new("Folder")
			tempArena.Name = "TempArena"
			tempArena.Parent = workspace
			handler(tempArena)
		end
	end
end)

-- Clean up between rounds
local roundEndEvent = Instance.new("BindableEvent")
roundEndEvent.Name = "EndMinigame"
roundEndEvent.Parent = script

roundEndEvent.Event:Connect(function()
	unloadArena()
end)
