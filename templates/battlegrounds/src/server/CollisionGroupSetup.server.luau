-- CollisionGroupSetup: configure collision groups for PvP modes
-- Players don't collide with each other (prevents body-blocking in combat)
-- Projectiles collide with players but not with other projectiles

local PhysicsService = game:GetService("PhysicsService")
local Players = game:GetService("Players")

-- Register collision groups
PhysicsService:RegisterCollisionGroup("Players")
PhysicsService:RegisterCollisionGroup("Projectiles")

-- Players don't collide with each other
PhysicsService:CollisionGroupSetCollidable("Players", "Players", false)

-- Projectiles don't collide with each other
PhysicsService:CollisionGroupSetCollidable("Projectiles", "Projectiles", false)

-- Projectiles DO collide with players (for hit detection)
PhysicsService:CollisionGroupSetCollidable("Projectiles", "Players", true)

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

print("CollisionGroupSetup loaded — Players and Projectiles groups configured")
