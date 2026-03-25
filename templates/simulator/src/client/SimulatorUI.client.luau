-- SimulatorUI: client-side HUD for simulator game
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- Create main HUD
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "SimHUD"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Coins display (top left)
local coinsFrame = Instance.new("Frame")
coinsFrame.Name = "CoinsFrame"
coinsFrame.Size = UDim2.new(0, 180, 0, 44)
coinsFrame.Position = UDim2.new(0, 12, 0, 12)
coinsFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
coinsFrame.BackgroundTransparency = 0.15
coinsFrame.BorderSizePixel = 0
coinsFrame.Parent = screenGui

local coinsCorner = Instance.new("UICorner")
coinsCorner.CornerRadius = UDim.new(0, 10)
coinsCorner.Parent = coinsFrame

local coinsIcon = Instance.new("TextLabel")
coinsIcon.Size = UDim2.new(0, 36, 1, 0)
coinsIcon.BackgroundTransparency = 1
coinsIcon.Text = "🪙"
coinsIcon.TextSize = 20
coinsIcon.Parent = coinsFrame

local coinsLabel = Instance.new("TextLabel")
coinsLabel.Name = "CoinsAmount"
coinsLabel.Size = UDim2.new(1, -40, 1, 0)
coinsLabel.Position = UDim2.new(0, 38, 0, 0)
coinsLabel.BackgroundTransparency = 1
coinsLabel.Text = "0"
coinsLabel.TextColor3 = Color3.fromRGB(255, 220, 50)
coinsLabel.TextSize = 20
coinsLabel.Font = Enum.Font.GothamBold
coinsLabel.TextXAlignment = Enum.TextXAlignment.Left
coinsLabel.Parent = coinsFrame

-- Gems display (below coins)
local gemsFrame = Instance.new("Frame")
gemsFrame.Name = "GemsFrame"
gemsFrame.Size = UDim2.new(0, 180, 0, 44)
gemsFrame.Position = UDim2.new(0, 12, 0, 62)
gemsFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
gemsFrame.BackgroundTransparency = 0.15
gemsFrame.BorderSizePixel = 0
gemsFrame.Parent = screenGui

local gemsCorner = Instance.new("UICorner")
gemsCorner.CornerRadius = UDim.new(0, 10)
gemsCorner.Parent = gemsFrame

local gemsIcon = Instance.new("TextLabel")
gemsIcon.Size = UDim2.new(0, 36, 1, 0)
gemsIcon.BackgroundTransparency = 1
gemsIcon.Text = "💎"
gemsIcon.TextSize = 20
gemsIcon.Parent = gemsFrame

local gemsLabel = Instance.new("TextLabel")
gemsLabel.Name = "GemsAmount"
gemsLabel.Size = UDim2.new(1, -40, 1, 0)
gemsLabel.Position = UDim2.new(0, 38, 0, 0)
gemsLabel.BackgroundTransparency = 1
gemsLabel.Text = "0"
gemsLabel.TextColor3 = Color3.fromRGB(150, 200, 255)
gemsLabel.TextSize = 20
gemsLabel.Font = Enum.Font.GothamBold
gemsLabel.TextXAlignment = Enum.TextXAlignment.Left
gemsLabel.Parent = gemsFrame

-- Click power indicator (top center)
local powerFrame = Instance.new("Frame")
powerFrame.Size = UDim2.new(0, 160, 0, 36)
powerFrame.Position = UDim2.new(0.5, -80, 0, 12)
powerFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
powerFrame.BackgroundTransparency = 0.15
powerFrame.BorderSizePixel = 0
powerFrame.Parent = screenGui

local powerCorner = Instance.new("UICorner")
powerCorner.CornerRadius = UDim.new(0, 10)
powerCorner.Parent = powerFrame

local powerLabel = Instance.new("TextLabel")
powerLabel.Name = "PowerLabel"
powerLabel.Size = UDim2.new(1, 0, 1, 0)
powerLabel.BackgroundTransparency = 1
powerLabel.Text = "⚡ Click Power: 1"
powerLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
powerLabel.TextSize = 14
powerLabel.Font = Enum.Font.GothamBold
powerLabel.Parent = powerFrame

-- Format numbers
local function formatNumber(n)
	if n >= 1000000 then
		return string.format("%.1fM", n / 1000000)
	elseif n >= 1000 then
		return string.format("%.1fK", n / 1000)
	end
	return tostring(math.floor(n))
end

-- Listen for stat updates
local updateStats = ReplicatedStorage:WaitForChild("UpdateStats")
updateStats.OnClientEvent:Connect(function(stats)
	if stats.coins then
		coinsLabel.Text = formatNumber(stats.coins)
	end
	if stats.gems then
		gemsLabel.Text = formatNumber(stats.gems)
	end
	if stats.clickPower then
		powerLabel.Text = "⚡ Click Power: " .. stats.clickPower
	end
end)

-- Handle clicking orbs
local clickEvent = ReplicatedStorage:WaitForChild("ClickOrb")
local mouse = player:GetMouse()

mouse.Button1Down:Connect(function()
	local target = mouse.Target
	if target and game:GetService("CollectionService"):HasTag(target, "ClickOrb") then
		clickEvent:FireServer(target)
	end
end)

print("SimulatorUI loaded")
