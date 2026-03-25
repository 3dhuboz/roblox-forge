local RPGConfig = {}

RPGConfig.StartingLevel = 1
RPGConfig.StartingGold = 0
RPGConfig.StartingXP = 0
RPGConfig.XPPerLevel = 100
RPGConfig.XPScaling = 1.5
RPGConfig.MaxLevel = 50

RPGConfig.Stats = {
	BaseHealth = 100,
	BaseDamage = 10,
	BaseDefense = 5,
	BaseSpeed = 16,
	HealthPerLevel = 15,
	DamagePerLevel = 3,
	DefensePerLevel = 2,
}

RPGConfig.Quests = {
	{
		Id = "quest_slime_1",
		Name = "Slime Slayer",
		Description = "Defeat 5 slimes in the Starter Meadow",
		Type = "kill",
		Target = "Slime",
		Amount = 5,
		XPReward = 50,
		GoldReward = 25,
		MinLevel = 1,
	},
	{
		Id = "quest_explore_1",
		Name = "Explorer",
		Description = "Visit the Dark Forest zone",
		Type = "explore",
		Target = "DarkForest",
		Amount = 1,
		XPReward = 75,
		GoldReward = 40,
		MinLevel = 3,
	},
	{
		Id = "quest_boss_1",
		Name = "Boss Hunter",
		Description = "Defeat the Forest Guardian",
		Type = "kill",
		Target = "ForestGuardian",
		Amount = 1,
		XPReward = 200,
		GoldReward = 150,
		MinLevel = 5,
	},
}

RPGConfig.Enemies = {
	{
		Name = "Slime",
		Health = 30,
		Damage = 5,
		XPDrop = 15,
		GoldDrop = 5,
		Level = 1,
		Color = Color3.fromRGB(100, 255, 100),
		Size = Vector3.new(3, 3, 3),
		RespawnTime = 10,
	},
	{
		Name = "Goblin",
		Health = 60,
		Damage = 12,
		XPDrop = 30,
		GoldDrop = 12,
		Level = 3,
		Color = Color3.fromRGB(120, 180, 80),
		Size = Vector3.new(3, 5, 2),
		RespawnTime = 15,
	},
	{
		Name = "ForestGuardian",
		Health = 300,
		Damage = 25,
		XPDrop = 200,
		GoldDrop = 100,
		Level = 5,
		Color = Color3.fromRGB(60, 120, 60),
		Size = Vector3.new(6, 8, 6),
		RespawnTime = 60,
		IsBoss = true,
	},
}

RPGConfig.Items = {
	{
		Name = "Wooden Sword",
		Type = "weapon",
		DamageBonus = 5,
		Cost = 50,
		MinLevel = 1,
	},
	{
		Name = "Iron Sword",
		Type = "weapon",
		DamageBonus = 15,
		Cost = 200,
		MinLevel = 5,
	},
	{
		Name = "Leather Armor",
		Type = "armor",
		DefenseBonus = 5,
		Cost = 75,
		MinLevel = 1,
	},
	{
		Name = "Iron Armor",
		Type = "armor",
		DefenseBonus = 15,
		Cost = 300,
		MinLevel = 5,
	},
	{
		Name = "Health Potion",
		Type = "consumable",
		HealAmount = 50,
		Cost = 20,
		MinLevel = 1,
	},
}

RPGConfig.Zones = {
	{
		Name = "Starter Meadow",
		RequiredLevel = 1,
		Enemies = { "Slime" },
	},
	{
		Name = "Dark Forest",
		RequiredLevel = 3,
		Enemies = { "Goblin", "Slime" },
	},
	{
		Name = "Mountain Pass",
		RequiredLevel = 8,
		Enemies = { "Goblin", "ForestGuardian" },
	},
}

return RPGConfig
