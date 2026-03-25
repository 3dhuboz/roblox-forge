-- PuzzleManager: handles puzzles, keys, and item pickups
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local HorrorConfig = require(ReplicatedStorage:WaitForChild("HorrorConfig"))

local puzzleEvent = Instance.new("RemoteEvent")
puzzleEvent.Name = "PuzzleEvent"
puzzleEvent.Parent = ReplicatedStorage

local itemEvent = Instance.new("RemoteEvent")
itemEvent.Name = "ItemEvent"
itemEvent.Parent = ReplicatedStorage

local playerInventory = {}

local function getInventory(player)
	if not playerInventory[player] then
		playerInventory[player] = {}
	end
	return playerInventory[player]
end

local function hasItem(player, itemName)
	local inv = getInventory(player)
	for _, item in ipairs(inv) do
		if item == itemName then return true end
	end
	return false
end

-- Item pickup
itemEvent.OnServerEvent:Connect(function(player, itemName)
	local inv = getInventory(player)
	if hasItem(player, itemName) then return end
	table.insert(inv, itemName)
	itemEvent:FireClient(player, { type = "picked_up", item = itemName })

	-- Trigger jumpscare chance on pickup
	local horrorEvent = ReplicatedStorage:FindFirstChild("HorrorEvent")
	if horrorEvent then
		if math.random(1, 100) <= 15 then
			horrorEvent:FireClient(player, { type = "jumpscare", trigger = "item_pickup" })
		end
	end
end)

-- Puzzle attempt
puzzleEvent.OnServerEvent:Connect(function(player, puzzleId, answer)
	local puzzleConfig = nil
	for _, p in ipairs(HorrorConfig.Puzzles) do
		if p.Id == puzzleId then
			puzzleConfig = p
			break
		end
	end
	if not puzzleConfig then return end

	local correct = false
	if puzzleConfig.Type == "code" then
		correct = tostring(answer) == puzzleConfig.Solution
	elseif puzzleConfig.Type == "sequence" then
		if type(answer) == "table" and #answer == #puzzleConfig.Solution then
			correct = true
			for i, v in ipairs(puzzleConfig.Solution) do
				if answer[i] ~= v then
					correct = false
					break
				end
			end
		end
	end

	if correct then
		local inv = getInventory(player)
		table.insert(inv, puzzleConfig.Reward)
		puzzleEvent:FireClient(player, {
			type = "solved",
			puzzleId = puzzleId,
			reward = puzzleConfig.Reward,
		})
		print(player.Name .. " solved " .. puzzleId .. ", got " .. puzzleConfig.Reward)
	else
		puzzleEvent:FireClient(player, {
			type = "wrong",
			puzzleId = puzzleId,
		})
	end
end)

-- Door key checks
for _, door in CollectionService:GetTagged("LockedDoor") do
	door.Touched:Connect(function(hit)
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if not player then return end
		local requiredKey = door:GetAttribute("RequiredKey") or ""
		if requiredKey == "" or hasItem(player, requiredKey) then
			door.Transparency = 1
			door.CanCollide = false
			task.delay(5, function()
				door.Transparency = 0
				door.CanCollide = true
			end)
		else
			puzzleEvent:FireClient(player, { type = "locked", key = requiredKey })
		end
	end)
end

Players.PlayerRemoving:Connect(function(player)
	playerInventory[player] = nil
end)

print("PuzzleManager loaded")
