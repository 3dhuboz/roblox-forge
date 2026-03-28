local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")

local DATA_STORE_NAME = "ObbyPlayerData_v1"
local dataStore = DataStoreService:GetDataStore(DATA_STORE_NAME)

local MAX_RETRIES = 3
local playerData: { [Player]: { stage: number, deaths: number, bestTime: number? } } = {}

--- Retry a function with exponential backoff.
local function withRetry(fn: () -> any, label: string): (boolean, any)
	for attempt = 1, MAX_RETRIES do
		local success, result = pcall(fn)
		if success then
			return true, result
		end
		if attempt < MAX_RETRIES then
			local backoff = math.pow(2, attempt)
			warn(string.format("[DataManager] %s failed (attempt %d/%d): %s — retrying in %ds",
				label, attempt, MAX_RETRIES, tostring(result), backoff))
			task.wait(backoff)
		else
			warn(string.format("[DataManager] %s failed after %d attempts: %s",
				label, MAX_RETRIES, tostring(result)))
			return false, result
		end
	end
	return false, "Max retries reached"
end

local function loadPlayerData(player: Player)
	local key = "Player_" .. player.UserId
	local success, data = withRetry(function()
		return dataStore:GetAsync(key)
	end, "Load " .. player.Name)

	if success and data then
		playerData[player] = data
	else
		playerData[player] = {
			stage = 0,
			deaths = 0,
			bestTime = nil,
		}
	end
end

local function savePlayerData(player: Player)
	local data = playerData[player]
	if not data then
		return
	end

	local key = "Player_" .. player.UserId
	withRetry(function()
		dataStore:UpdateAsync(key, function()
			return data
		end)
	end, "Save " .. player.Name)
end

local function onPlayerAdded(player: Player)
	loadPlayerData(player)
end

local function onPlayerRemoving(player: Player)
	savePlayerData(player)
	playerData[player] = nil
end

Players.PlayerAdded:Connect(onPlayerAdded)
Players.PlayerRemoving:Connect(onPlayerRemoving)

-- Process players who joined before this script loaded
for _, player in Players:GetPlayers() do
	task.spawn(onPlayerAdded, player)
end

game:BindToClose(function()
	local threads = {}
	for _, player in Players:GetPlayers() do
		table.insert(threads, task.spawn(savePlayerData, player))
	end
	-- BindToClose gives ~30 seconds, plenty for retries
end)
