-- HorrorUI: client-side HUD for horror game
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "HorrorHUD"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Battery indicator (top left)
local batteryFrame = Instance.new("Frame")
batteryFrame.Size = UDim2.new(0, 140, 0, 24)
batteryFrame.Position = UDim2.new(0, 12, 0, 12)
batteryFrame.BackgroundColor3 = Color3.fromRGB(15, 15, 20)
batteryFrame.BackgroundTransparency = 0.2
batteryFrame.BorderSizePixel = 0
batteryFrame.Parent = screenGui

local batteryBar = Instance.new("Frame")
batteryBar.Name = "Bar"
batteryBar.Size = UDim2.new(1, -4, 1, -4)
batteryBar.Position = UDim2.new(0, 2, 0, 2)
batteryBar.BackgroundColor3 = Color3.fromRGB(255, 220, 80)
batteryBar.BorderSizePixel = 0
batteryBar.Parent = batteryFrame

local batteryLabel = Instance.new("TextLabel")
batteryLabel.Size = UDim2.new(1, 0, 1, 0)
batteryLabel.BackgroundTransparency = 1
batteryLabel.Text = "Battery: 100%"
batteryLabel.TextColor3 = Color3.new(1, 1, 1)
batteryLabel.TextSize = 11
batteryLabel.Font = Enum.Font.GothamBold
batteryLabel.Parent = batteryFrame

-- Stamina bar (below battery)
local staminaFrame = Instance.new("Frame")
staminaFrame.Size = UDim2.new(0, 140, 0, 12)
staminaFrame.Position = UDim2.new(0, 12, 0, 42)
staminaFrame.BackgroundColor3 = Color3.fromRGB(15, 15, 20)
staminaFrame.BackgroundTransparency = 0.2
staminaFrame.BorderSizePixel = 0
staminaFrame.Parent = screenGui

local staminaBar = Instance.new("Frame")
staminaBar.Name = "Bar"
staminaBar.Size = UDim2.new(1, -4, 1, -4)
staminaBar.Position = UDim2.new(0, 2, 0, 2)
staminaBar.BackgroundColor3 = Color3.fromRGB(80, 200, 120)
staminaBar.BorderSizePixel = 0
staminaBar.Parent = staminaFrame

-- Vignette overlay for horror atmosphere
local vignette = Instance.new("ImageLabel")
vignette.Size = UDim2.new(1, 0, 1, 0)
vignette.BackgroundTransparency = 1
vignette.ImageTransparency = 0.4
vignette.Image = ""
vignette.ImageColor3 = Color3.new(0, 0, 0)
vignette.Parent = screenGui

-- Jumpscare overlay
local jumpscareFrame = Instance.new("Frame")
jumpscareFrame.Name = "Jumpscare"
jumpscareFrame.Size = UDim2.new(1, 0, 1, 0)
jumpscareFrame.BackgroundColor3 = Color3.new(0, 0, 0)
jumpscareFrame.BackgroundTransparency = 1
jumpscareFrame.Visible = false
jumpscareFrame.Parent = screenGui

-- Flashlight toggle (F key)
local toggleFlashlight = ReplicatedStorage:WaitForChild("ToggleFlashlight")
local toggleSprint = ReplicatedStorage:WaitForChild("ToggleSprint")

UserInputService.InputBegan:Connect(function(input, processed)
	if processed then return end
	if input.KeyCode == Enum.KeyCode.F then
		toggleFlashlight:FireServer()
	end
	if input.KeyCode == Enum.KeyCode.LeftShift then
		toggleSprint:FireServer(true)
	end
end)

UserInputService.InputEnded:Connect(function(input)
	if input.KeyCode == Enum.KeyCode.LeftShift then
		toggleSprint:FireServer(false)
	end
end)

-- Listen for horror events
local horrorEvent = ReplicatedStorage:WaitForChild("HorrorEvent")
horrorEvent.OnClientEvent:Connect(function(data)
	if data.type == "stats" then
		local bPct = (data.battery or 100) / 100
		batteryBar.Size = UDim2.new(bPct, -4, 1, -4)
		batteryBar.BackgroundColor3 = bPct > 0.3
			and Color3.fromRGB(255, 220, 80)
			or Color3.fromRGB(255, 80, 50)
		batteryLabel.Text = "Battery: " .. math.floor(data.battery) .. "%"

		local sPct = (data.stamina or 100) / 100
		staminaBar.Size = UDim2.new(sPct, -4, 1, -4)
	end

	if data.type == "jumpscare" then
		jumpscareFrame.Visible = true
		jumpscareFrame.BackgroundTransparency = 0
		task.spawn(function()
			for i = 0, 1, 0.05 do
				jumpscareFrame.BackgroundTransparency = i
				task.wait(0.02)
			end
			jumpscareFrame.Visible = false
		end)
	end
end)

print("HorrorUI loaded")
