-- TycoonUI: client-side HUD for tycoon game
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- Create main HUD
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "TycoonHUD"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Cash display (top center)
local cashFrame = Instance.new("Frame")
cashFrame.Name = "CashFrame"
cashFrame.Size = UDim2.new(0, 220, 0, 50)
cashFrame.Position = UDim2.new(0.5, -110, 0, 10)
cashFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
cashFrame.BackgroundTransparency = 0.2
cashFrame.BorderSizePixel = 0
cashFrame.Parent = screenGui

local cashCorner = Instance.new("UICorner")
cashCorner.CornerRadius = UDim.new(0, 12)
cashCorner.Parent = cashFrame

local cashIcon = Instance.new("TextLabel")
cashIcon.Name = "Icon"
cashIcon.Size = UDim2.new(0, 40, 1, 0)
cashIcon.Position = UDim2.new(0, 5, 0, 0)
cashIcon.BackgroundTransparency = 1
cashIcon.Text = "$"
cashIcon.TextColor3 = Color3.fromRGB(100, 255, 100)
cashIcon.TextSize = 28
cashIcon.Font = Enum.Font.GothamBold
cashIcon.Parent = cashFrame

local cashLabel = Instance.new("TextLabel")
cashLabel.Name = "Amount"
cashLabel.Size = UDim2.new(1, -50, 1, 0)
cashLabel.Position = UDim2.new(0, 45, 0, 0)
cashLabel.BackgroundTransparency = 1
cashLabel.Text = "0"
cashLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
cashLabel.TextSize = 24
cashLabel.Font = Enum.Font.GothamBold
cashLabel.TextXAlignment = Enum.TextXAlignment.Left
cashLabel.Parent = cashFrame

-- Upgrades panel (right side)
local upgradesFrame = Instance.new("Frame")
upgradesFrame.Name = "UpgradesFrame"
upgradesFrame.Size = UDim2.new(0, 200, 0, 300)
upgradesFrame.Position = UDim2.new(1, -210, 0.5, -150)
upgradesFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
upgradesFrame.BackgroundTransparency = 0.2
upgradesFrame.BorderSizePixel = 0
upgradesFrame.Visible = false
upgradesFrame.Parent = screenGui

local upgradesCorner = Instance.new("UICorner")
upgradesCorner.CornerRadius = UDim.new(0, 12)
upgradesCorner.Parent = upgradesFrame

local upgradesTitle = Instance.new("TextLabel")
upgradesTitle.Size = UDim2.new(1, 0, 0, 36)
upgradesTitle.BackgroundTransparency = 1
upgradesTitle.Text = "Upgrades"
upgradesTitle.TextColor3 = Color3.fromRGB(255, 200, 50)
upgradesTitle.TextSize = 18
upgradesTitle.Font = Enum.Font.GothamBold
upgradesTitle.Parent = upgradesFrame

-- Listen for cash updates
local updateCash = ReplicatedStorage:WaitForChild("UpdateCash")
updateCash.OnClientEvent:Connect(function(newCash)
	cashLabel.Text = tostring(math.floor(newCash))
end)

-- Format numbers with commas
local function formatNumber(n)
	local formatted = tostring(math.floor(n))
	local k
	while true do
		formatted, k = string.gsub(formatted, "^(-?%d+)(%d%d%d)", "%1,%2")
		if k == 0 then break end
	end
	return formatted
end

-- Periodically update cash from server
task.spawn(function()
	while true do
		task.wait(1)
		local getCash = ReplicatedStorage:FindFirstChild("GetCash")
		if getCash then
			local success, cash = pcall(function()
				return getCash:InvokeServer()
			end)
			if success then
				cashLabel.Text = formatNumber(cash)
			end
		end
	end
end)

print("TycoonUI loaded")
