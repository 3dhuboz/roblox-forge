-- BattleUI: client-side HUD for battlegrounds game
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- Create main HUD
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "BattleHUD"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Health bar (top center)
local healthFrame = Instance.new("Frame")
healthFrame.Name = "HealthFrame"
healthFrame.Size = UDim2.new(0, 260, 0, 30)
healthFrame.Position = UDim2.new(0.5, -130, 0, 12)
healthFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 40)
healthFrame.BorderSizePixel = 0
healthFrame.Parent = screenGui

local healthCorner = Instance.new("UICorner")
healthCorner.CornerRadius = UDim.new(0, 8)
healthCorner.Parent = healthFrame

local healthBar = Instance.new("Frame")
healthBar.Name = "Bar"
healthBar.Size = UDim2.new(1, -4, 1, -4)
healthBar.Position = UDim2.new(0, 2, 0, 2)
healthBar.BackgroundColor3 = Color3.fromRGB(80, 220, 80)
healthBar.BorderSizePixel = 0
healthBar.Parent = healthFrame

local healthBarCorner = Instance.new("UICorner")
healthBarCorner.CornerRadius = UDim.new(0, 6)
healthBarCorner.Parent = healthBar

local healthLabel = Instance.new("TextLabel")
healthLabel.Name = "Label"
healthLabel.Size = UDim2.new(1, 0, 1, 0)
healthLabel.BackgroundTransparency = 1
healthLabel.Text = "100 / 100"
healthLabel.TextColor3 = Color3.new(1, 1, 1)
healthLabel.TextSize = 14
healthLabel.Font = Enum.Font.GothamBold
healthLabel.Parent = healthFrame

-- Kill/Death counter (top left)
local statsFrame = Instance.new("Frame")
statsFrame.Size = UDim2.new(0, 160, 0, 50)
statsFrame.Position = UDim2.new(0, 12, 0, 12)
statsFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
statsFrame.BackgroundTransparency = 0.15
statsFrame.BorderSizePixel = 0
statsFrame.Parent = screenGui

local statsCorner = Instance.new("UICorner")
statsCorner.CornerRadius = UDim.new(0, 10)
statsCorner.Parent = statsFrame

local killsLabel = Instance.new("TextLabel")
killsLabel.Name = "Kills"
killsLabel.Size = UDim2.new(0.5, 0, 1, 0)
killsLabel.BackgroundTransparency = 1
killsLabel.Text = "0 Kills"
killsLabel.TextColor3 = Color3.fromRGB(100, 255, 100)
killsLabel.TextSize = 16
killsLabel.Font = Enum.Font.GothamBold
killsLabel.Parent = statsFrame

local deathsLabel = Instance.new("TextLabel")
deathsLabel.Name = "Deaths"
deathsLabel.Size = UDim2.new(0.5, 0, 1, 0)
deathsLabel.Position = UDim2.new(0.5, 0, 0, 0)
deathsLabel.BackgroundTransparency = 1
deathsLabel.Text = "0 Deaths"
deathsLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
deathsLabel.TextSize = 16
deathsLabel.Font = Enum.Font.GothamBold
deathsLabel.Parent = statsFrame

-- Ability bar (bottom center)
local abilityBar = Instance.new("Frame")
abilityBar.Name = "AbilityBar"
abilityBar.Size = UDim2.new(0, 300, 0, 60)
abilityBar.Position = UDim2.new(0.5, -150, 1, -75)
abilityBar.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
abilityBar.BackgroundTransparency = 0.2
abilityBar.BorderSizePixel = 0
abilityBar.Parent = screenGui

local abilityCorner = Instance.new("UICorner")
abilityCorner.CornerRadius = UDim.new(0, 12)
abilityCorner.Parent = abilityBar

local abilityLayout = Instance.new("UIListLayout")
abilityLayout.FillDirection = Enum.FillDirection.Horizontal
abilityLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center
abilityLayout.VerticalAlignment = Enum.VerticalAlignment.Center
abilityLayout.Padding = UDim.new(0, 8)
abilityLayout.Parent = abilityBar

-- Round timer (top right)
local timerLabel = Instance.new("TextLabel")
timerLabel.Name = "Timer"
timerLabel.Size = UDim2.new(0, 120, 0, 40)
timerLabel.Position = UDim2.new(1, -132, 0, 12)
timerLabel.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
timerLabel.BackgroundTransparency = 0.15
timerLabel.Text = "2:00"
timerLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
timerLabel.TextSize = 22
timerLabel.Font = Enum.Font.GothamBold
timerLabel.BorderSizePixel = 0
timerLabel.Parent = screenGui

local timerCorner = Instance.new("UICorner")
timerCorner.CornerRadius = UDim.new(0, 10)
timerCorner.Parent = timerLabel

-- Kill feed (top right below timer)
local killFeed = Instance.new("Frame")
killFeed.Name = "KillFeed"
killFeed.Size = UDim2.new(0, 250, 0, 120)
killFeed.Position = UDim2.new(1, -262, 0, 60)
killFeed.BackgroundTransparency = 1
killFeed.Parent = screenGui

local killFeedLayout = Instance.new("UIListLayout")
killFeedLayout.SortOrder = Enum.SortOrder.LayoutOrder
killFeedLayout.Padding = UDim.new(0, 2)
killFeedLayout.Parent = killFeed

-- Handle ability keys (1, 2, 3, 4)
local useAbilityEvent = ReplicatedStorage:WaitForChild("UseAbility")

UserInputService.InputBegan:Connect(function(input, processed)
	if processed then return end
	local keyMap = {
		[Enum.KeyCode.One] = 1,
		[Enum.KeyCode.Two] = 2,
		[Enum.KeyCode.Three] = 3,
		[Enum.KeyCode.Four] = 4,
	}
	local slot = keyMap[input.KeyCode]
	if slot then
		local mouse = player:GetMouse()
		local targetPos = mouse.Hit and mouse.Hit.Position or Vector3.new(0, 0, 0)
		useAbilityEvent:FireServer("ability_" .. slot, targetPos)
	end
end)

-- Listen for kill feed
local killFeedEvent = ReplicatedStorage:WaitForChild("KillFeed")
killFeedEvent.OnClientEvent:Connect(function(killerName, victimName, abilityName)
	local entry = Instance.new("TextLabel")
	entry.Size = UDim2.new(1, 0, 0, 20)
	entry.BackgroundColor3 = Color3.fromRGB(20, 20, 30)
	entry.BackgroundTransparency = 0.3
	entry.Text = killerName .. " → " .. victimName .. " (" .. abilityName .. ")"
	entry.TextColor3 = Color3.fromRGB(255, 200, 100)
	entry.TextSize = 12
	entry.Font = Enum.Font.GothamBold
	entry.TextXAlignment = Enum.TextXAlignment.Right
	entry.Parent = killFeed

	task.delay(5, function()
		if entry and entry.Parent then
			entry:Destroy()
		end
	end)
end)

-- Update health bar
task.spawn(function()
	while true do
		task.wait(0.1)
		local character = player.Character
		if character then
			local humanoid = character:FindFirstChild("Humanoid")
			if humanoid then
				local pct = humanoid.Health / humanoid.MaxHealth
				healthBar.Size = UDim2.new(pct, -4, 1, -4)
				healthBar.BackgroundColor3 = Color3.fromRGB(
					math.floor(255 * (1 - pct)),
					math.floor(220 * pct),
					80
				)
				healthLabel.Text = math.floor(humanoid.Health) .. " / " .. humanoid.MaxHealth
			end
		end
	end
end)

print("BattleUI loaded")
