-- RPGUI: client-side HUD for RPG game
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "RPGHUD"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Stats panel (top left)
local statsFrame = Instance.new("Frame")
statsFrame.Name = "StatsFrame"
statsFrame.Size = UDim2.new(0, 200, 0, 100)
statsFrame.Position = UDim2.new(0, 12, 0, 12)
statsFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
statsFrame.BackgroundTransparency = 0.15
statsFrame.BorderSizePixel = 0
statsFrame.Parent = screenGui

local statsCorner = Instance.new("UICorner")
statsCorner.CornerRadius = UDim.new(0, 12)
statsCorner.Parent = statsFrame

local levelLabel = Instance.new("TextLabel")
levelLabel.Name = "Level"
levelLabel.Size = UDim2.new(1, -16, 0, 24)
levelLabel.Position = UDim2.new(0, 8, 0, 8)
levelLabel.BackgroundTransparency = 1
levelLabel.Text = "Level 1"
levelLabel.TextColor3 = Color3.fromRGB(255, 220, 100)
levelLabel.TextSize = 18
levelLabel.Font = Enum.Font.GothamBold
levelLabel.TextXAlignment = Enum.TextXAlignment.Left
levelLabel.Parent = statsFrame

local xpFrame = Instance.new("Frame")
xpFrame.Name = "XPBar"
xpFrame.Size = UDim2.new(1, -16, 0, 8)
xpFrame.Position = UDim2.new(0, 8, 0, 36)
xpFrame.BackgroundColor3 = Color3.fromRGB(40, 40, 60)
xpFrame.BorderSizePixel = 0
xpFrame.Parent = statsFrame

local xpBarCorner = Instance.new("UICorner")
xpBarCorner.CornerRadius = UDim.new(0, 4)
xpBarCorner.Parent = xpFrame

local xpFill = Instance.new("Frame")
xpFill.Name = "Fill"
xpFill.Size = UDim2.new(0, 0, 1, 0)
xpFill.BackgroundColor3 = Color3.fromRGB(100, 200, 255)
xpFill.BorderSizePixel = 0
xpFill.Parent = xpFrame

local xpFillCorner = Instance.new("UICorner")
xpFillCorner.CornerRadius = UDim.new(0, 4)
xpFillCorner.Parent = xpFill

local goldLabel = Instance.new("TextLabel")
goldLabel.Name = "Gold"
goldLabel.Size = UDim2.new(1, -16, 0, 20)
goldLabel.Position = UDim2.new(0, 8, 0, 52)
goldLabel.BackgroundTransparency = 1
goldLabel.Text = "Gold: 0"
goldLabel.TextColor3 = Color3.fromRGB(255, 200, 50)
goldLabel.TextSize = 14
goldLabel.Font = Enum.Font.GothamBold
goldLabel.TextXAlignment = Enum.TextXAlignment.Left
goldLabel.Parent = statsFrame

local xpLabel = Instance.new("TextLabel")
xpLabel.Name = "XPText"
xpLabel.Size = UDim2.new(1, -16, 0, 20)
xpLabel.Position = UDim2.new(0, 8, 0, 72)
xpLabel.BackgroundTransparency = 1
xpLabel.Text = "XP: 0 / 100"
xpLabel.TextColor3 = Color3.fromRGB(100, 200, 255)
xpLabel.TextSize = 12
xpLabel.Font = Enum.Font.Gotham
xpLabel.TextXAlignment = Enum.TextXAlignment.Left
xpLabel.Parent = statsFrame

-- Quest tracker (right side)
local questFrame = Instance.new("Frame")
questFrame.Name = "QuestTracker"
questFrame.Size = UDim2.new(0, 220, 0, 150)
questFrame.Position = UDim2.new(1, -232, 0, 12)
questFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
questFrame.BackgroundTransparency = 0.15
questFrame.BorderSizePixel = 0
questFrame.Parent = screenGui

local questCorner = Instance.new("UICorner")
questCorner.CornerRadius = UDim.new(0, 12)
questCorner.Parent = questFrame

local questTitle = Instance.new("TextLabel")
questTitle.Size = UDim2.new(1, 0, 0, 28)
questTitle.BackgroundTransparency = 1
questTitle.Text = "  Active Quests"
questTitle.TextColor3 = Color3.fromRGB(200, 180, 255)
questTitle.TextSize = 14
questTitle.Font = Enum.Font.GothamBold
questTitle.TextXAlignment = Enum.TextXAlignment.Left
questTitle.Parent = questFrame

-- Update stats display
local function updateDisplay()
	local level = player:FindFirstChild("Level")
	local xp = player:FindFirstChild("XP")
	local gold = player:FindFirstChild("Gold")

	if level then
		levelLabel.Text = "Level " .. level.Value
	end
	if gold then
		goldLabel.Text = "Gold: " .. gold.Value
	end
	if xp and level then
		local xpNeeded = math.floor(100 * math.pow(1.5, (level.Value or 1) - 1))
		xpLabel.Text = "XP: " .. xp.Value .. " / " .. xpNeeded
		local pct = math.clamp(xp.Value / math.max(xpNeeded, 1), 0, 1)
		xpFill.Size = UDim2.new(pct, 0, 1, 0)
	end
end

-- Poll for stat updates
task.spawn(function()
	while true do
		task.wait(0.5)
		updateDisplay()
	end
end)

-- Handle click-to-attack enemies
local attackEvent = ReplicatedStorage:WaitForChild("AttackEnemy")
local mouse = player:GetMouse()

mouse.Button1Down:Connect(function()
	local target = mouse.Target
	if target and game:GetService("CollectionService"):HasTag(target, "Enemy") then
		attackEvent:FireServer(target)
	end
end)

-- Listen for loot drops
local lootEvent = ReplicatedStorage:WaitForChild("LootDrop")
lootEvent.OnClientEvent:Connect(function(data)
	-- Show floating loot text
	local label = Instance.new("TextLabel")
	label.Size = UDim2.new(0, 200, 0, 30)
	label.Position = UDim2.new(0.5, -100, 0.4, 0)
	label.BackgroundTransparency = 1
	label.Text = "+" .. data.xp .. " XP  +" .. data.gold .. " Gold"
	label.TextColor3 = Color3.fromRGB(255, 220, 100)
	label.TextSize = 16
	label.Font = Enum.Font.GothamBold
	label.Parent = screenGui

	task.spawn(function()
		for i = 0, 1, 0.02 do
			label.Position = UDim2.new(0.5, -100, 0.4 - i * 0.05, 0)
			label.TextTransparency = i
			task.wait(0.02)
		end
		label:Destroy()
	end)
end)

print("RPGUI loaded")
