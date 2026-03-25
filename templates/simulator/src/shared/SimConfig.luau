local SimConfig = {}

SimConfig.StartingCoins = 0
SimConfig.StartingGems = 0
SimConfig.ClickPower = 1
SimConfig.ClickCooldown = 0

SimConfig.Zones = {
	{
		Name = "Starter Meadow",
		RequiredCoins = 0,
		CoinMultiplier = 1,
		Color = Color3.fromRGB(120, 200, 120),
	},
	{
		Name = "Crystal Caves",
		RequiredCoins = 1000,
		CoinMultiplier = 3,
		Color = Color3.fromRGB(150, 100, 220),
	},
	{
		Name = "Lava Peaks",
		RequiredCoins = 10000,
		CoinMultiplier = 10,
		Color = Color3.fromRGB(220, 80, 50),
	},
}

SimConfig.Pets = {
	{
		Name = "Basic Cat",
		Rarity = "Common",
		CoinBoost = 1.2,
		HatchCost = 100,
		HatchChance = 60,
		Color = Color3.fromRGB(200, 180, 140),
	},
	{
		Name = "Lucky Dog",
		Rarity = "Common",
		CoinBoost = 1.3,
		HatchCost = 100,
		HatchChance = 30,
		Color = Color3.fromRGB(180, 140, 100),
	},
	{
		Name = "Crystal Fox",
		Rarity = "Rare",
		CoinBoost = 2.0,
		HatchCost = 500,
		HatchChance = 8,
		Color = Color3.fromRGB(100, 180, 255),
	},
	{
		Name = "Golden Dragon",
		Rarity = "Legendary",
		CoinBoost = 5.0,
		HatchCost = 500,
		HatchChance = 2,
		Color = Color3.fromRGB(255, 200, 50),
	},
}

SimConfig.Rebirths = {
	{
		Level = 1,
		RequiredCoins = 50000,
		Multiplier = 2,
		GemsReward = 10,
	},
	{
		Level = 2,
		RequiredCoins = 200000,
		Multiplier = 3,
		GemsReward = 25,
	},
	{
		Level = 3,
		RequiredCoins = 1000000,
		Multiplier = 5,
		GemsReward = 50,
	},
}

SimConfig.Upgrades = {
	{
		Name = "Click Power +1",
		Cost = 50,
		Currency = "coins",
		Effect = "click_power",
		Value = 1,
	},
	{
		Name = "Auto Click",
		Cost = 500,
		Currency = "coins",
		Effect = "auto_click",
		Value = 1,
	},
	{
		Name = "2x Coins",
		Cost = 10,
		Currency = "gems",
		Effect = "coin_multiplier",
		Value = 2,
	},
	{
		Name = "Extra Pet Slot",
		Cost = 25,
		Currency = "gems",
		Effect = "pet_slots",
		Value = 1,
	},
}

return SimConfig
