-- MinigameUI: client-side HUD for minigames
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "MiniHUD"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Status bar (top center)
local statusFrame = Instance.new("Frame")
statusFrame.Size = UDim2.new(0, 300, 0, 50)
statusFrame.Position = UDim2.new(0.5, -150, 0, 12)
statusFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
statusFrame.BackgroundTransparency = 0.15
statusFrame.BorderSizePixel = 0
statusFrame.Parent = screenGui

local statusCorner = Instance.new("UICorner")
statusCorner.CornerRadius = UDim.new(0, 12)
statusCorner.Parent = statusFrame

local statusLabel = Instance.new("TextLabel")
statusLabel.Name = "Status"
statusLabel.Size = UDim2.new(1, 0, 0.6, 0)
statusLabel.BackgroundTransparency = 1
statusLabel.Text = "Waiting for players..."
statusLabel.TextColor3 = Color3.new(1, 1, 1)
statusLabel.TextSize = 18
statusLabel.Font = Enum.Font.GothamBold
statusLabel.Parent = statusFrame

local timerLabel = Instance.new("TextLabel")
timerLabel.Name = "Timer"
timerLabel.Size = UDim2.new(1, 0, 0.4, 0)
timerLabel.Position = UDim2.new(0, 0, 0.6, 0)
timerLabel.BackgroundTransparency = 1
timerLabel.Text = ""
timerLabel.TextColor3 = Color3.fromRGB(255, 220, 100)
timerLabel.TextSize = 14
timerLabel.Font = Enum.Font.Gotham
timerLabel.Parent = statusFrame

-- Coins display (top left)
local coinsLabel = Instance.new("TextLabel")
coinsLabel.Size = UDim2.new(0, 140, 0, 36)
coinsLabel.Position = UDim2.new(0, 12, 0, 12)
coinsLabel.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
coinsLabel.BackgroundTransparency = 0.15
coinsLabel.Text = "  Coins: 0"
coinsLabel.TextColor3 = Color3.fromRGB(255, 220, 50)
coinsLabel.TextSize = 16
coinsLabel.Font = Enum.Font.GothamBold
coinsLabel.TextXAlignment = Enum.TextXAlignment.Left
coinsLabel.BorderSizePixel = 0
coinsLabel.Parent = screenGui

-- Eliminated overlay
local eliminatedFrame = Instance.new("Frame")
eliminatedFrame.Name = "Eliminated"
eliminatedFrame.Size = UDim2.new(1, 0, 1, 0)
eliminatedFrame.BackgroundColor3 = Color3.fromRGB(200, 30, 30)
eliminatedFrame.BackgroundTransparency = 0.7
eliminatedFrame.Visible = false
eliminatedFrame.Parent = screenGui

local eliminatedLabel = Instance.new("TextLabel")
eliminatedLabel.Size = UDim2.new(1, 0, 0, 60)
eliminatedLabel.Position = UDim2.new(0, 0, 0.4, 0)
eliminatedLabel.BackgroundTransparency = 1
eliminatedLabel.Text = "ELIMINATED"
eliminatedLabel.TextColor3 = Color3.new(1, 1, 1)
eliminatedLabel.TextSize = 48
eliminatedLabel.Font = Enum.Font.GothamBold
eliminatedLabel.Parent = eliminatedFrame

-- Results overlay
local resultsFrame = Instance.new("Frame")
resultsFrame.Name = "Results"
resultsFrame.Size = UDim2.new(0, 300, 0, 200)
resultsFrame.Position = UDim2.new(0.5, -150, 0.3, 0)
resultsFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
resultsFrame.BackgroundTransparency = 0.1
resultsFrame.Visible = false
resultsFrame.BorderSizePixel = 0
resultsFrame.Parent = screenGui

local resultsTitle = Instance.new("TextLabel")
resultsTitle.Size = UDim2.new(1, 0, 0, 40)
resultsTitle.BackgroundTransparency = 1
resultsTitle.Text = "Round Over!"
resultsTitle.TextColor3 = Color3.fromRGB(255, 220, 100)
resultsTitle.TextSize = 24
resultsTitle.Font = Enum.Font.GothamBold
resultsTitle.Parent = resultsFrame

local placeLabel = Instance.new("TextLabel")
placeLabel.Name = "Place"
placeLabel.Size = UDim2.new(1, 0, 0, 40)
placeLabel.Position = UDim2.new(0, 0, 0, 50)
placeLabel.BackgroundTransparency = 1
placeLabel.Text = ""
placeLabel.TextColor3 = Color3.new(1, 1, 1)
placeLabel.TextSize = 20
placeLabel.Font = Enum.Font.GothamBold
placeLabel.Parent = resultsFrame

local rewardLabel = Instance.new("TextLabel")
rewardLabel.Name = "Reward"
rewardLabel.Size = UDim2.new(1, 0, 0, 30)
rewardLabel.Position = UDim2.new(0, 0, 0, 100)
rewardLabel.BackgroundTransparency = 1
rewardLabel.Text = ""
rewardLabel.TextColor3 = Color3.fromRGB(100, 255, 100)
rewardLabel.TextSize = 16
rewardLabel.Font = Enum.Font.Gotham
rewardLabel.Parent = resultsFrame

-- Listen for round events
local roundEvent = ReplicatedStorage:WaitForChild("RoundEvent")
roundEvent.OnClientEvent:Connect(function(data)
	eliminatedFrame.Visible = false
	resultsFrame.Visible = false

	if data.type == "intermission" then
		statusLabel.Text = "Intermission"
		timerLabel.Text = data.time .. "s until next round"
	elseif data.type == "vote" then
		statusLabel.Text = "Vote for next minigame!"
		timerLabel.Text = data.time .. "s to vote"
	elseif data.type == "round_start" then
		statusLabel.Text = data.name
		timerLabel.Text = data.description
	elseif data.type == "eliminated" then
		eliminatedFrame.Visible = true
		task.delay(3, function() eliminatedFrame.Visible = false end)
	elseif data.type == "round_end" then
		resultsFrame.Visible = true
		local suffix = data.place == 1 and "st" or data.place == 2 and "nd" or data.place == 3 and "rd" or "th"
		placeLabel.Text = data.place .. suffix .. " place!"
		rewardLabel.Text = "+" .. data.reward .. " coins"
		task.delay(5, function() resultsFrame.Visible = false end)
	end
end)

print("MinigameUI loaded")
