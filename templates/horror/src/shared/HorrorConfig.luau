local HorrorConfig = {}

HorrorConfig.MaxPlayers = 4
HorrorConfig.FlashlightBattery = 100
HorrorConfig.BatteryDrainRate = 2
HorrorConfig.SprintSpeed = 24
HorrorConfig.WalkSpeed = 12
HorrorConfig.StaminaMax = 100
HorrorConfig.StaminaDrainRate = 20
HorrorConfig.StaminaRegenRate = 10

HorrorConfig.Rooms = {
	{ Name = "Entrance Hall", KeyRequired = false, Dark = false },
	{ Name = "Library", KeyRequired = false, Dark = true },
	{ Name = "Basement", KeyRequired = true, Dark = true },
	{ Name = "Attic", KeyRequired = true, Dark = true },
}

HorrorConfig.Puzzles = {
	{
		Id = "puzzle_library",
		Room = "Library",
		Type = "sequence",
		Description = "Press the books in the correct order",
		Solution = { 3, 1, 4, 2 },
		Reward = "BasementKey",
	},
	{
		Id = "puzzle_basement",
		Room = "Basement",
		Type = "code",
		Description = "Enter the 4-digit code from the clues",
		Solution = "1847",
		Reward = "AtticKey",
	},
}

HorrorConfig.Jumpscares = {
	{ Trigger = "door_open", Chance = 20, Cooldown = 30 },
	{ Trigger = "hallway_walk", Chance = 10, Cooldown = 45 },
	{ Trigger = "item_pickup", Chance = 15, Cooldown = 60 },
}

HorrorConfig.Items = {
	{ Name = "Flashlight", Type = "tool", SpawnRoom = "Entrance Hall" },
	{ Name = "BasementKey", Type = "key", SpawnRoom = "Library" },
	{ Name = "AtticKey", Type = "key", SpawnRoom = "Basement" },
	{ Name = "Battery", Type = "consumable", SpawnRoom = "Library" },
	{ Name = "Note1", Type = "lore", SpawnRoom = "Entrance Hall", Text = "They sealed it below..." },
	{ Name = "Note2", Type = "lore", SpawnRoom = "Basement", Text = "The code is the year it began." },
}

return HorrorConfig
