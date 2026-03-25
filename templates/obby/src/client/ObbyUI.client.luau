local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local ObbyConfig = require(ReplicatedStorage:WaitForChild("ObbyConfig"))
local player = Players.LocalPlayer

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "ObbyHUD"
screenGui.ResetOnSpawn = false
screenGui.Parent = player:WaitForChild("PlayerGui")

-- Stage display (top center)
local stageFrame = Instance.new("Frame")
stageFrame.Name = "StageDisplay"
stageFrame.Size = UDim2.new(0, 220, 0, 50)
stageFrame.Position = UDim2.new(0.5, -110, 0, 10)
stageFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
stageFrame.BackgroundTransparency = 0.3
stageFrame.Parent = screenGui

local stageCorner = Instance.new("UICorner")
stageCorner.CornerRadius = UDim.new(0, 10)
stageCorner.Parent = stageFrame

local stageLabel = Instance.new("TextLabel")
stageLabel.Name = "StageLabel"
stageLabel.Size = UDim2.new(1, -16, 1, 0)
stageLabel.Position = UDim2.new(0, 8, 0, 0)
stageLabel.BackgroundTransparency = 1
stageLabel.Text = "Stage: 0 / " .. ObbyConfig.MaxStages
stageLabel.TextColor3 = Color3.new(1, 1, 1)
stageLabel.TextScaled = true
stageLabel.Font = Enum.Font.GothamBold
stageLabel.Parent = stageFrame

-- Death counter
if ObbyConfig.Features.EnableDeathCounter then
	local deathFrame = Instance.new("Frame")
	deathFrame.Name = "DeathDisplay"
	deathFrame.Size = UDim2.new(0, 160, 0, 40)
	deathFrame.Position = UDim2.new(0.5, -80, 0, 70)
	deathFrame.BackgroundColor3 = Color3.fromRGB(50, 20, 20)
	deathFrame.BackgroundTransparency = 0.3
	deathFrame.Parent = screenGui

	local deathCorner = Instance.new("UICorner")
	deathCorner.CornerRadius = UDim.new(0, 10)
	deathCorner.Parent = deathFrame

	local deathLabel = Instance.new("TextLabel")
	deathLabel.Name = "DeathLabel"
	deathLabel.Size = UDim2.new(1, -16, 1, 0)
	deathLabel.Position = UDim2.new(0, 8, 0, 0)
	deathLabel.BackgroundTransparency = 1
	deathLabel.Text = "Deaths: 0"
	deathLabel.TextColor3 = Color3.fromRGB(255, 100, 100)
	deathLabel.TextScaled = true
	deathLabel.Font = Enum.Font.GothamBold
	deathLabel.Parent = deathFrame
end

-- Timer (top right)
if ObbyConfig.Features.EnableTimer then
	local timerFrame = Instance.new("Frame")
	timerFrame.Name = "TimerDisplay"
	timerFrame.Size = UDim2.new(0, 140, 0, 40)
	timerFrame.Position = UDim2.new(1, -150, 0, 10)
	timerFrame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
	timerFrame.BackgroundTransparency = 0.3
	timerFrame.Parent = screenGui

	local timerCorner = Instance.new("UICorner")
	timerCorner.CornerRadius = UDim.new(0, 10)
	timerCorner.Parent = timerFrame

	local timerLabel = Instance.new("TextLabel")
	timerLabel.Name = "TimerLabel"
	timerLabel.Size = UDim2.new(1, -16, 1, 0)
	timerLabel.Position = UDim2.new(0, 8, 0, 0)
	timerLabel.BackgroundTransparency = 1
	timerLabel.Text = "0:00"
	timerLabel.TextColor3 = Color3.new(1, 1, 1)
	timerLabel.TextScaled = true
	timerLabel.Font = Enum.Font.GothamBold
	timerLabel.Parent = timerFrame

	local startTime = tick()
	RunService.Heartbeat:Connect(function()
		local elapsed = tick() - startTime
		local minutes = math.floor(elapsed / 60)
		local seconds = math.floor(elapsed % 60)
		timerLabel.Text = string.format("%d:%02d", minutes, seconds)
	end)
end

-- Update displays from leaderstats
local leaderstats = player:WaitForChild("leaderstats")
local stageValue = leaderstats:WaitForChild("Stage")

stageValue.Changed:Connect(function(newValue)
	stageLabel.Text = "Stage: " .. newValue .. " / " .. ObbyConfig.MaxStages

	-- Show stage name if available
	local stageName = ObbyConfig.StageNames[newValue]
	if stageName then
		stageLabel.Text = stageName .. " (" .. newValue .. "/" .. ObbyConfig.MaxStages .. ")"
	end
end)

if ObbyConfig.Features.EnableDeathCounter then
	local deathValue = leaderstats:WaitForChild("Deaths")
	local deathDisplay = screenGui:FindFirstChild("DeathDisplay")
	if deathDisplay then
		local deathLabel = deathDisplay:FindFirstChild("DeathLabel")
		if deathLabel then
			deathValue.Changed:Connect(function(newValue)
				deathLabel.Text = "Deaths: " .. newValue
			end)
		end
	end
end
