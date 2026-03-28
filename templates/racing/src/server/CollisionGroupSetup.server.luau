-- CollisionGroupSetup: configure collision groups for racing
-- Players don't collide with each other while in vehicles
-- Prevents bumping/griefing during races

local PhysicsService = game:GetService("PhysicsService")
local Players = game:GetService("Players")

-- Register collision groups
PhysicsService:RegisterCollisionGroup("Players")
PhysicsService:RegisterCollisionGroup("Vehicles")

-- Players don't collide with each other
PhysicsService:CollisionGroupSetCollidable("Players", "Players", false)

-- Vehicles don't collide with other vehicles (ghost racing)
PhysicsService:CollisionGroupSetCollidable("Vehicles", "Vehicles", false)

-- Vehicles still collide with track barriers (Default group)
PhysicsService:CollisionGroupSetCollidable("Vehicles", "Default", true)

-- Assign player characters to the Players collision group
local function assignCollisionGroup(character)
	for _, part in ipairs(character:GetDescendants()) do
		if part:IsA("BasePart") then
			part.CollisionGroup = "Players"
		end
	end

	character.DescendantAdded:Connect(function(descendant)
		if descendant:IsA("BasePart") then
			descendant.CollisionGroup = "Players"
		end
	end)
end

Players.PlayerAdded:Connect(function(player)
	player.CharacterAdded:Connect(assignCollisionGroup)
	if player.Character then
		assignCollisionGroup(player.Character)
	end
end)

print("CollisionGroupSetup loaded — Players and Vehicles groups configured")
