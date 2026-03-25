local ObbyConfig = {}

ObbyConfig.GameName = "My Obby"
ObbyConfig.MaxStages = 2
ObbyConfig.Difficulty = "easy"

ObbyConfig.Features = {
	EnableTimer = true,
	EnableDeathCounter = true,
	EnableLeaderboard = true,
	SaveProgress = true,
}

ObbyConfig.StageNames = {
	[1] = "The Beginning",
	[2] = "Getting Harder",
}

ObbyConfig.KillBrickDamage = 100
ObbyConfig.RespawnDelay = 1

return ObbyConfig
