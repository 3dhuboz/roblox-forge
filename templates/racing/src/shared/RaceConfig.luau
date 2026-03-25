local RaceConfig = {}

RaceConfig.MaxPlayersPerRace = 8
RaceConfig.CountdownTime = 3
RaceConfig.LapCount = 3
RaceConfig.RaceTimeout = 300

RaceConfig.Vehicles = {
	{
		Name = "Starter Kart",
		Speed = 80,
		Acceleration = 30,
		Handling = 0.8,
		Cost = 0,
		Color = Color3.fromRGB(200, 50, 50),
	},
	{
		Name = "Sport Car",
		Speed = 120,
		Acceleration = 45,
		Handling = 0.7,
		Cost = 500,
		Color = Color3.fromRGB(50, 100, 255),
	},
	{
		Name = "Super Racer",
		Speed = 160,
		Acceleration = 55,
		Handling = 0.6,
		Cost = 2000,
		Color = Color3.fromRGB(255, 200, 0),
	},
	{
		Name = "Hyper GT",
		Speed = 200,
		Acceleration = 70,
		Handling = 0.5,
		Cost = 10000,
		Color = Color3.fromRGB(150, 50, 255),
	},
}

RaceConfig.Tracks = {
	{
		Name = "Sunny Circuit",
		Laps = 3,
		Checkpoints = 8,
		Difficulty = "Easy",
	},
	{
		Name = "Mountain Pass",
		Laps = 2,
		Checkpoints = 12,
		Difficulty = "Medium",
	},
}

RaceConfig.Rewards = {
	First = 200,
	Second = 100,
	Third = 50,
	Finish = 25,
	LapBonus = 10,
}

RaceConfig.Powerups = {
	{ Name = "Boost", Duration = 3, SpeedMultiplier = 1.5 },
	{ Name = "Shield", Duration = 5 },
	{ Name = "Oil Slick", SlowMultiplier = 0.5, SlowDuration = 2 },
}

return RaceConfig
