local BattleConfig = {}

BattleConfig.MaxPlayersPerMatch = 8
BattleConfig.RoundDuration = 120
BattleConfig.RespawnTime = 5
BattleConfig.StartingHealth = 100
BattleConfig.WalkSpeed = 16
BattleConfig.JumpPower = 50

BattleConfig.Abilities = {
	{
		Name = "Fireball",
		Damage = 25,
		Cooldown = 3,
		Range = 60,
		Color = Color3.fromRGB(255, 80, 20),
		Description = "Launch a fireball that explodes on impact",
	},
	{
		Name = "Ice Shard",
		Damage = 15,
		Cooldown = 1.5,
		Range = 45,
		Color = Color3.fromRGB(100, 200, 255),
		Description = "Throw a fast ice shard that slows enemies",
	},
	{
		Name = "Thunder Strike",
		Damage = 40,
		Cooldown = 6,
		Range = 30,
		Color = Color3.fromRGB(255, 255, 100),
		Description = "Call down lightning on a target area",
	},
	{
		Name = "Shield Bash",
		Damage = 20,
		Cooldown = 4,
		Range = 10,
		Color = Color3.fromRGB(180, 180, 220),
		Description = "Dash forward with a shield, knockback enemies",
	},
	{
		Name = "Heal Pulse",
		Damage = -30,
		Cooldown = 8,
		Range = 20,
		Color = Color3.fromRGB(80, 255, 120),
		Description = "Heal yourself and nearby allies",
	},
}

BattleConfig.Classes = {
	{
		Name = "Warrior",
		Health = 150,
		Speed = 14,
		Abilities = { "Shield Bash", "Fireball" },
		Description = "Tanky melee fighter with high health",
	},
	{
		Name = "Mage",
		Health = 80,
		Speed = 18,
		Abilities = { "Fireball", "Ice Shard", "Thunder Strike" },
		Description = "Ranged glass cannon with powerful spells",
	},
	{
		Name = "Healer",
		Health = 100,
		Speed = 16,
		Abilities = { "Heal Pulse", "Ice Shard" },
		Description = "Support class that heals allies and slows enemies",
	},
	{
		Name = "Assassin",
		Health = 75,
		Speed = 22,
		Abilities = { "Ice Shard", "Shield Bash" },
		Description = "Fast and deadly, strikes hard then vanishes",
	},
}

BattleConfig.Arenas = {
	{
		Name = "Grassy Plains",
		Size = Vector3.new(100, 1, 100),
		Theme = "outdoor",
	},
	{
		Name = "Lava Pit",
		Size = Vector3.new(80, 1, 80),
		Theme = "lava",
	},
}

BattleConfig.KillReward = 25
BattleConfig.WinReward = 100
BattleConfig.AssistReward = 10

return BattleConfig
