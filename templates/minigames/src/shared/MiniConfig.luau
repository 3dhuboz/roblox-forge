local MiniConfig = {}

MiniConfig.IntermissionTime = 15
MiniConfig.MinPlayers = 2
MiniConfig.MaxPlayers = 16
MiniConfig.RoundTime = 60
MiniConfig.VotingTime = 10

MiniConfig.Minigames = {
	{
		Name = "Floor is Lava",
		Description = "The floor disappears! Last one standing wins.",
		Duration = 45,
		MinPlayers = 2,
		Type = "survival",
	},
	{
		Name = "King of the Hill",
		Description = "Stay on the platform the longest to win!",
		Duration = 60,
		MinPlayers = 2,
		Type = "survival",
	},
	{
		Name = "Freeze Tag",
		Description = "One player is 'it' — freeze everyone to win!",
		Duration = 90,
		MinPlayers = 3,
		Type = "tag",
	},
	{
		Name = "Obby Race",
		Description = "Race through the obstacle course — first to finish wins!",
		Duration = 60,
		MinPlayers = 2,
		Type = "race",
	},
	{
		Name = "Sword Fight",
		Description = "Last player standing in a sword duel wins!",
		Duration = 60,
		MinPlayers = 2,
		Type = "combat",
	},
	{
		Name = "Simon Says",
		Description = "Follow the commands — do the wrong thing and you're out!",
		Duration = 90,
		MinPlayers = 3,
		Type = "elimination",
	},
}

MiniConfig.Rewards = {
	Win = 100,
	SecondPlace = 50,
	ThirdPlace = 25,
	Participation = 10,
}

MiniConfig.Titles = {
	{ Name = "Rookie", WinsRequired = 0 },
	{ Name = "Competitor", WinsRequired = 10 },
	{ Name = "Champion", WinsRequired = 50 },
	{ Name = "Legend", WinsRequired = 100 },
	{ Name = "Minigame God", WinsRequired = 500 },
}

return MiniConfig
