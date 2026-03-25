local TycoonConfig = {}

TycoonConfig.MaxPlots = 4
TycoonConfig.StartingCash = 0
TycoonConfig.DropperInterval = 2
TycoonConfig.BaseDropValue = 1
TycoonConfig.ConveyorSpeed = 10

TycoonConfig.Upgrades = {
	{
		Name = "Faster Dropper",
		Cost = 100,
		Effect = "dropper_speed",
		Multiplier = 1.5,
		Description = "Droppers produce 50% faster",
	},
	{
		Name = "Double Value",
		Cost = 500,
		Effect = "drop_value",
		Multiplier = 2,
		Description = "Each drop is worth 2x",
	},
	{
		Name = "Speed Conveyor",
		Cost = 250,
		Effect = "conveyor_speed",
		Multiplier = 2,
		Description = "Conveyors move items 2x faster",
	},
	{
		Name = "Auto Collector",
		Cost = 1000,
		Effect = "auto_collect",
		Multiplier = 1,
		Description = "Automatically collects items",
	},
}

TycoonConfig.PlotNames = {
	[1] = "Starter Factory",
	[2] = "Advanced Plant",
	[3] = "Mega Facility",
	[4] = "Ultimate HQ",
}

return TycoonConfig
