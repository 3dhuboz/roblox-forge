-- RacingUI: client-side HUD for racing game
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- Racing camera: wider FOV, follow behind vehicle
workspace.CurrentCamera.FieldOfView = 80

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "RaceHUD"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Speed display (bottom center)
local speedFrame = Instance.new("Frame")
speedFrame.Size = UDim2.new(0, 160, 0, 60)
speedFrame.Position = UDim2.new(0.5, -80, 1, -80)
speedFrame.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
speedFrame.BackgroundTransparency = 0.15
speedFrame.BorderSizePixel = 0
speedFrame.Parent = screenGui

local speedLabel = Instance.new("TextLabel")
speedLabel.Size = UDim2.new(1, 0, 1, 0)
speedLabel.BackgroundTransparency = 1
speedLabel.Text = "0 MPH"
speedLabel.TextColor3 = Color3.new(1, 1, 1)
speedLabel.TextSize = 28
speedLabel.Font = Enum.Font.GothamBold
speedLabel.Parent = speedFrame

-- Lap counter (top center)
local lapLabel = Instance.new("TextLabel")
lapLabel.Size = UDim2.new(0, 200, 0, 40)
lapLabel.Position = UDim2.new(0.5, -100, 0, 12)
lapLabel.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
lapLabel.BackgroundTransparency = 0.15
lapLabel.Text = "Lap 0 / 3"
lapLabel.TextColor3 = Color3.new(1, 1, 1)
lapLabel.TextSize = 20
lapLabel.Font = Enum.Font.GothamBold
lapLabel.BorderSizePixel = 0
lapLabel.Parent = screenGui

-- Position display (top right)
local posLabel = Instance.new("TextLabel")
posLabel.Size = UDim2.new(0, 100, 0, 50)
posLabel.Position = UDim2.new(1, -112, 0, 12)
posLabel.BackgroundColor3 = Color3.fromRGB(20, 25, 40)
posLabel.BackgroundTransparency = 0.15
posLabel.Text = "1st"
posLabel.TextColor3 = Color3.fromRGB(255, 220, 50)
posLabel.TextSize = 32
posLabel.Font = Enum.Font.GothamBold
posLabel.BorderSizePixel = 0
posLabel.Parent = screenGui

-- Countdown overlay
local countdownLabel = Instance.new("TextLabel")
countdownLabel.Name = "Countdown"
countdownLabel.Size = UDim2.new(1, 0, 1, 0)
countdownLabel.BackgroundTransparency = 1
countdownLabel.Text = ""
countdownLabel.TextColor3 = Color3.new(1, 1, 1)
countdownLabel.TextSize = 72
countdownLabel.Font = Enum.Font.GothamBold
countdownLabel.Visible = false
countdownLabel.Parent = screenGui

-- Listen for race events
local raceEvent = ReplicatedStorage:WaitForChild("RaceEvent")
raceEvent.OnClientEvent:Connect(function(data)
	if data.type == "countdown" then
		countdownLabel.Visible = true
		countdownLabel.Text = tostring(data.count)
	elseif data.type == "go" then
		countdownLabel.Text = "GO!"
		task.delay(1, function() countdownLabel.Visible = false end)
	elseif data.type == "lap" then
		lapLabel.Text = "Lap " .. data.lap .. " / " .. data.totalLaps
	elseif data.type == "finished" then
		local suffix = data.place == 1 and "st" or data.place == 2 and "nd" or data.place == 3 and "rd" or "th"
		posLabel.Text = data.place .. suffix
		countdownLabel.Visible = true
		countdownLabel.Text = "FINISHED! " .. string.format("%.1f", data.time) .. "s"
		task.delay(5, function() countdownLabel.Visible = false end)
	end
end)

-- Speed display update
task.spawn(function()
	while true do
		task.wait(0.1)
		local character = player.Character
		if character then
			local root = character:FindFirstChild("HumanoidRootPart")
			if root then
				local speed = math.floor(root.AssemblyLinearVelocity.Magnitude)
				speedLabel.Text = speed .. " MPH"
			end
		end
	end
end)

print("RacingUI loaded")
