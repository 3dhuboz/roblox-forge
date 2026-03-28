local ObbyConfig = {}

ObbyConfig.GameName = "My Obby"
ObbyConfig.MaxStages = 5
ObbyConfig.Difficulty = "medium"

ObbyConfig.Features = {
	EnableTimer = true,
	EnableDeathCounter = true,
	EnableLeaderboard = true,
	SaveProgress = true,
}

ObbyConfig.StageNames = {
	[1] = "The Beginning",
	[2] = "Bridge of Peril",
	[3] = "Moving Madness",
	[4] = "Vanishing Act",
	[5] = "The Gauntlet",
}

ObbyConfig.KillBrickDamage = 100
ObbyConfig.RespawnDelay = 1

return ObbyConfig
