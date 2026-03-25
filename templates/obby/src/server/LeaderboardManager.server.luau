local Players = game:GetService("Players")

local function onPlayerAdded(player: Player)
	local leaderstats = Instance.new("Folder")
	leaderstats.Name = "leaderstats"
	leaderstats.Parent = player

	local stage = Instance.new("IntValue")
	stage.Name = "Stage"
	stage.Value = 0
	stage.Parent = leaderstats

	local deaths = Instance.new("IntValue")
	deaths.Name = "Deaths"
	deaths.Value = 0
	deaths.Parent = leaderstats
end

local function trackDeaths(player: Player)
	player.CharacterAdded:Connect(function(character)
		local humanoid = character:WaitForChild("Humanoid")
		humanoid.Died:Connect(function()
			local leaderstats = player:FindFirstChild("leaderstats")
			if leaderstats then
				local deathsVal = leaderstats:FindFirstChild("Deaths")
				if deathsVal then
					deathsVal.Value += 1
				end
			end
		end)
	end)
end

Players.PlayerAdded:Connect(function(player)
	onPlayerAdded(player)
	trackDeaths(player)
end)
