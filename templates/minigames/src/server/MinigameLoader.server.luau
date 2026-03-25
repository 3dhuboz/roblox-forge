-- MinigameLoader: handles loading/unloading minigame arenas and game-specific logic
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local MiniConfig = require(ReplicatedStorage:WaitForChild("MiniConfig"))

local activeArena = nil

local function loadArena(minigameName)
	unloadArena()
	local gamesFolder = workspace:FindFirstChild("Games")
	if not gamesFolder then return end

	for _, child in gamesFolder:GetChildren() do
		if child.Name == minigameName:gsub(" ", "") then
			activeArena = child
			for _, part in child:GetDescendants() do
				if part:IsA("BasePart") then
					part.Transparency = 0
					part.CanCollide = true
				end
			end
			break
		end
	end
end

function unloadArena()
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

-- Floor is Lava: progressively remove floor tiles
local function runFloorIsLava(arena)
	local floor = nil
	for _, child in arena:GetChildren() do
		if CollectionService:HasTag(child, "DisappearFloor") then
			floor = child
			break
		end
	end
	if not floor then return end

	task.spawn(function()
		task.wait(5)
		-- Shrink the floor over time
		local originalSize = floor.Size
		for i = 1, 20 do
			task.wait(2)
			if not floor or not floor.Parent then break end
			local shrinkFactor = 1 - (i / 25)
			floor.Size = Vector3.new(
				originalSize.X * shrinkFactor,
				originalSize.Y,
				originalSize.Z * shrinkFactor
			)
		end
		-- Remove completely
		if floor and floor.Parent then
			floor.Transparency = 1
			floor.CanCollide = false
		end
	end)
end

-- Listen for round starts to load appropriate arena
local roundEvent = ReplicatedStorage:WaitForChild("RoundEvent")
roundEvent.OnClientEvent:Connect(function(data)
	if data.type == "round_start" then
		loadArena(data.name)
		if data.name == "Floor is Lava" and activeArena then
			runFloorIsLava(activeArena)
		end
	elseif data.type == "intermission" then
		unloadArena()
	end
end)

print("MinigameLoader loaded")
