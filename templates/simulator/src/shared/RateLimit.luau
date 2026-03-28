--[[
	RateLimit.luau
	Shared rate-limiting module for RemoteEvent spam prevention.

	Usage (server):
	  local RateLimit = require(game.ReplicatedStorage.RateLimit)

	  remoteEvent.OnServerEvent:Connect(function(player, ...)
	      if not RateLimit.check(player, "click", 0.1) then return end
	      -- process the event
	  end)
]]

local RateLimit = {}

local timestamps: { [Player]: { [string]: number } } = {}

--- Check if an action is allowed for a player.
--- Returns true if enough time has passed since the last call.
--- @param player Player — the player performing the action
--- @param action string — a unique name for this action
--- @param cooldown number — minimum seconds between actions
--- @return boolean — true if allowed, false if rate-limited
function RateLimit.check(player: Player, action: string, cooldown: number): boolean
	if not timestamps[player] then
		timestamps[player] = {}
	end

	local now = tick()
	local lastTime = timestamps[player][action] or 0

	if now - lastTime < cooldown then
		return false
	end

	timestamps[player][action] = now
	return true
end

--- Clean up when a player leaves (prevents memory leaks).
--- Call this from PlayerRemoving or let the module handle it.
function RateLimit.cleanup(player: Player)
	timestamps[player] = nil
end

-- Auto-cleanup on player leave
game:GetService("Players").PlayerRemoving:Connect(function(player)
	RateLimit.cleanup(player)
end)

return RateLimit
