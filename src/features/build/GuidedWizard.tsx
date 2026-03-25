import { useState } from "react";
import {
  Palette,
  Flame,
  Snowflake,
  Star,
  TreePine,
  Zap,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Loader2,
  Factory,
  Pickaxe,
  Gem,
  Pizza,
  Wrench,
  Candy,
} from "lucide-react";
import { useChatStore } from "../../stores/chatStore";

interface GuidedWizardProps {
  projectPath: string;
  templateType: string;
  onComplete: () => void;
}

type Theme = {
  id: string;
  name: string;
  icon: React.ElementType;
  color: string;
  prompt: string;
};

// ── Obby config ──

const obbyThemes: Theme[] = [
  { id: "space", name: "Space", icon: Star, color: "bg-indigo-600", prompt: "space-themed with floating asteroids, neon platforms, and starry backgrounds" },
  { id: "lava", name: "Lava", icon: Flame, color: "bg-red-600", prompt: "lava-themed with red hot platforms, lava pools below, and volcanic rocks" },
  { id: "ice", name: "Ice", icon: Snowflake, color: "bg-cyan-600", prompt: "ice-themed with slippery glass platforms, snow effects, and frozen paths" },
  { id: "forest", name: "Forest", icon: TreePine, color: "bg-green-600", prompt: "forest-themed with natural wood platforms, grass, and earthy colors" },
  { id: "neon", name: "Neon City", icon: Zap, color: "bg-purple-600", prompt: "neon city-themed with glowing neon platforms, cyber colors, and futuristic materials" },
  { id: "rainbow", name: "Rainbow", icon: Palette, color: "bg-pink-600", prompt: "rainbow-themed with colorful platforms that cycle through all colors" },
];

const obbyDifficulties = [
  { id: "easy", name: "Easy", count: 3, label: "stages", desc: "Wide platforms, few obstacles — perfect for beginners" },
  { id: "medium", name: "Medium", count: 5, label: "stages", desc: "Narrower platforms, more kill bricks, moving parts" },
  { id: "hard", name: "Hard", count: 8, label: "stages", desc: "Tight jumps, spinning obstacles, disappearing blocks" },
  { id: "extreme", name: "Extreme", count: 12, label: "stages", desc: "One-stud jumps, invisible platforms, everything moves" },
];

const obbyFeatures = [
  { id: "killbricks", name: "Kill Bricks", desc: "Red lava bricks that reset you" },
  { id: "moving", name: "Moving Platforms", desc: "Platforms that slide back and forth" },
  { id: "spinning", name: "Spinning Obstacles", desc: "Rotating bars you have to dodge" },
  { id: "disappearing", name: "Disappearing Blocks", desc: "Platforms that vanish and reappear" },
  { id: "speed", name: "Speed Boosts", desc: "Pads that launch you forward" },
  { id: "trampolines", name: "Trampolines", desc: "Bounce pads for big jumps" },
  { id: "conveyors", name: "Conveyor Belts", desc: "Moving floors that push you" },
  { id: "narrow", name: "Narrow Bridges", desc: "Thin paths over deadly drops" },
];

// ── Tycoon config ──

const tycoonThemes: Theme[] = [
  { id: "factory", name: "Factory", icon: Factory, color: "bg-yellow-600", prompt: "industrial factory-themed with metal conveyor belts, steel machines, and smokestack aesthetics" },
  { id: "mining", name: "Mining", icon: Pickaxe, color: "bg-amber-700", prompt: "mining-themed with underground caverns, ore veins, gem deposits, and minecart tracks" },
  { id: "gems", name: "Gem Empire", icon: Gem, color: "bg-purple-600", prompt: "luxury gem-themed with crystal displays, polished marble floors, and sparkling gem processing machines" },
  { id: "food", name: "Food Business", icon: Pizza, color: "bg-orange-600", prompt: "food business-themed with kitchen equipment, serving counters, and restaurant decor" },
  { id: "workshop", name: "Workshop", icon: Wrench, color: "bg-slate-600", prompt: "workshop-themed with workbenches, tool racks, crafting stations, and wooden decor" },
  { id: "candy", name: "Candy Factory", icon: Candy, color: "bg-pink-500", prompt: "candy factory-themed with colorful candy machines, gumball droppers, and sugary sweet decor" },
];

const tycoonScales = [
  { id: "starter", name: "Small Startup", count: 3, label: "upgrades", desc: "Simple dropper, conveyor, and collector — quick to build" },
  { id: "medium", name: "Growing Business", count: 6, label: "upgrades", desc: "Multiple droppers, upgrades, and a rebirth system" },
  { id: "large", name: "Empire", count: 10, label: "upgrades", desc: "Full factory floor, advanced machines, prestige system" },
  { id: "mega", name: "Mega Corp", count: 15, label: "upgrades", desc: "Multi-floor operation, automation, employees, expansions" },
];

const tycoonFeatures = [
  { id: "droppers", name: "Droppers", desc: "Machines that produce items over time" },
  { id: "conveyors", name: "Conveyors", desc: "Belts that move items to collectors" },
  { id: "upgrades", name: "Upgrade Buttons", desc: "Purchasable boosts for speed and value" },
  { id: "rebirth", name: "Rebirth System", desc: "Reset progress for permanent multipliers" },
  { id: "pets", name: "Pet System", desc: "Collect pets that help you earn faster" },
  { id: "leaderboard", name: "Leaderboard", desc: "Show top earners on a global board" },
  { id: "gamepasses", name: "Game Passes", desc: "Premium items players can buy with Robux" },
  { id: "codes", name: "Codes System", desc: "Redeemable codes for free cash and boosts" },
];

// ── Simulator config ──

const simThemes: Theme[] = [
  { id: "pets", name: "Pet Collector", icon: Star, color: "bg-purple-600", prompt: "pet collector-themed with egg hatching stations, pet displays, and colorful pet companions" },
  { id: "clicking", name: "Click Frenzy", icon: Zap, color: "bg-yellow-500", prompt: "click frenzy-themed with giant glowing orbs, combo counters, and satisfying click effects" },
  { id: "mining", name: "Mining Sim", icon: Pickaxe, color: "bg-amber-700", prompt: "mining-themed with breakable rocks, gem veins, pickaxe upgrades, and underground caves" },
  { id: "fighting", name: "Fighting Sim", icon: Flame, color: "bg-red-600", prompt: "fighting simulator-themed with training zones, power meters, and PvP arenas" },
  { id: "cooking", name: "Cooking Sim", icon: Pizza, color: "bg-orange-500", prompt: "cooking simulator-themed with recipe stations, ingredient collection, and restaurant serving" },
  { id: "magic", name: "Magic Academy", icon: Sparkles, color: "bg-indigo-600", prompt: "magic academy-themed with spell learning zones, mana orbs, and enchanted environments" },
];

const simScales = [
  { id: "casual", name: "Casual", count: 2, label: "zones", desc: "Simple click-to-earn with 1 egg type and basic upgrades" },
  { id: "standard", name: "Standard", count: 4, label: "zones", desc: "Multiple zones, pet system, upgrades, and a rebirth" },
  { id: "deep", name: "Deep Progression", count: 6, label: "zones", desc: "Many zones, pet tiers, trading, codes, and prestige" },
  { id: "massive", name: "Massive", count: 10, label: "zones", desc: "Huge world with quests, events, guilds, and seasonal content" },
];

const simFeatures = [
  { id: "clicking", name: "Click System", desc: "Tap orbs or objects to earn coins" },
  { id: "pets", name: "Pet Hatching", desc: "Hatch eggs for pets with rarity tiers" },
  { id: "rebirth", name: "Rebirth System", desc: "Reset for permanent multipliers and gems" },
  { id: "zones", name: "Zone Unlocks", desc: "New areas with higher coin multipliers" },
  { id: "upgrades", name: "Upgrade Shop", desc: "Buy click power, auto-click, and multipliers" },
  { id: "trading", name: "Pet Trading", desc: "Trade pets with other players" },
  { id: "codes", name: "Codes System", desc: "Redeemable promo codes for free rewards" },
  { id: "leaderboard", name: "Leaderboard", desc: "Global rankings for coins and rebirths" },
];

// ── Battlegrounds config ──

const bgThemes: Theme[] = [
  { id: "medieval", name: "Medieval", icon: Flame, color: "bg-amber-700", prompt: "medieval-themed with stone castles, swords, shields, and torchlit arenas" },
  { id: "scifi", name: "Sci-Fi", icon: Zap, color: "bg-cyan-600", prompt: "sci-fi-themed with laser weapons, force fields, hovering platforms, and neon arenas" },
  { id: "anime", name: "Anime", icon: Star, color: "bg-pink-600", prompt: "anime-inspired with flashy ability effects, power auras, and dramatic battlefields" },
  { id: "elemental", name: "Elemental", icon: Sparkles, color: "bg-indigo-600", prompt: "elemental-themed with fire, ice, lightning, and earth powers in nature arenas" },
  { id: "pirate", name: "Pirates", icon: Candy, color: "bg-orange-600", prompt: "pirate-themed with ship battles, cannon abilities, treasure islands, and ocean arenas" },
  { id: "ninja", name: "Ninja", icon: Wrench, color: "bg-gray-600", prompt: "ninja-themed with stealth abilities, shuriken throws, smoke bombs, and rooftop arenas" },
];

const bgScales = [
  { id: "quick", name: "Quick Brawl", count: 3, label: "abilities", desc: "Fast rounds, 3 abilities, 1 arena — jump straight into action" },
  { id: "standard", name: "Standard", count: 5, label: "abilities", desc: "4 classes, 5 abilities, 2 arenas, ranked matchmaking" },
  { id: "competitive", name: "Competitive", count: 8, label: "abilities", desc: "Full class system, 8 abilities, team modes, ranked seasons" },
  { id: "massive", name: "War Mode", count: 12, label: "abilities", desc: "16 players, vehicles, objectives, multiple maps, clan wars" },
];

const bgFeatures = [
  { id: "classes", name: "Class System", desc: "Warrior, Mage, Healer, Assassin with unique stats" },
  { id: "abilities", name: "Abilities", desc: "Fireball, Ice Shard, Thunder Strike, Shield Bash, Heal" },
  { id: "matchmaking", name: "Matchmaking", desc: "Auto-queue with ranked and casual modes" },
  { id: "killfeed", name: "Kill Feed", desc: "Real-time kill notifications on screen" },
  { id: "respawn", name: "Respawn System", desc: "Timed respawn with invulnerability frames" },
  { id: "leaderboard", name: "Leaderboard", desc: "Track kills, deaths, wins, and K/D ratio" },
  { id: "rewards", name: "Kill Rewards", desc: "Earn coins for kills, assists, and wins" },
  { id: "cosmetics", name: "Cosmetics", desc: "Unlock skins, effects, and titles with coins" },
];

// ── RPG config ──

const rpgThemes: Theme[] = [
  { id: "fantasy", name: "Classic Fantasy", icon: Star, color: "bg-blue-600", prompt: "classic fantasy-themed with medieval towns, enchanted forests, and dragon lairs" },
  { id: "scifi", name: "Sci-Fi RPG", icon: Zap, color: "bg-cyan-600", prompt: "sci-fi RPG-themed with space stations, alien planets, laser swords, and tech upgrades" },
  { id: "pirate", name: "Pirate Adventure", icon: Candy, color: "bg-amber-600", prompt: "pirate adventure-themed with tropical islands, ship battles, buried treasure, and sea monsters" },
  { id: "dungeon", name: "Dungeon Crawler", icon: Flame, color: "bg-red-700", prompt: "dungeon crawler-themed with dark corridors, traps, treasure chests, and boss rooms" },
  { id: "samurai", name: "Samurai Saga", icon: Wrench, color: "bg-slate-600", prompt: "samurai-themed with Japanese temples, bamboo forests, katana combat, and honor system" },
  { id: "wizard", name: "Wizard School", icon: Sparkles, color: "bg-purple-600", prompt: "wizard school-themed with spell classrooms, potion labs, magical creatures, and house competition" },
];

const rpgScales = [
  { id: "short", name: "Short Quest", count: 3, label: "quests", desc: "1 zone, 3 quests, basic combat — a quick adventure" },
  { id: "adventure", name: "Adventure", count: 6, label: "quests", desc: "3 zones, 6 quests, item shop, boss fight" },
  { id: "epic", name: "Epic Journey", count: 12, label: "quests", desc: "5 zones, 12 quests, crafting, dungeons, world bosses" },
  { id: "mmo", name: "MMO Scale", count: 20, label: "quests", desc: "10+ zones, guilds, raids, PvP, trading, seasonal events" },
];

const rpgFeatures = [
  { id: "quests", name: "Quest System", desc: "Kill, explore, and collect quests with XP/gold rewards" },
  { id: "combat", name: "Combat", desc: "Click enemies to fight with damage based on level and gear" },
  { id: "leveling", name: "Leveling", desc: "XP-based leveling with stat scaling per level" },
  { id: "inventory", name: "Inventory & Shop", desc: "Buy weapons, armor, and potions from NPCs" },
  { id: "bosses", name: "Boss Fights", desc: "Powerful enemies with high HP and special loot" },
  { id: "zones", name: "Zone Progression", desc: "Unlock new areas at higher levels" },
  { id: "crafting", name: "Crafting", desc: "Combine materials to create items" },
  { id: "pets", name: "Companions", desc: "Recruit companions that fight alongside you" },
];

// ── Template-agnostic wizard ──

function getConfig(templateType: string) {
  if (templateType === "rpg") {
    return {
      themes: rpgThemes,
      scales: rpgScales,
      features: rpgFeatures,
      stepLabels: [
        { title: "World", subtitle: "What kind of adventure?" },
        { title: "Scale", subtitle: "How big is the world?" },
        { title: "Systems", subtitle: "What RPG features?" },
        { title: "Generate", subtitle: "Name it and let AI build it!" },
      ],
      defaultTheme: "fantasy",
      defaultFeatures: ["quests", "combat", "leveling"],
      buildPrompt: (theme: Theme, scale: typeof rpgScales[0], features: string[], name: string) =>
        `Create a ${scale.name.toLowerCase()} RPG called "${name || "My RPG"}" with ${scale.count} quests. Make it ${theme.prompt}. Include these systems: ${features}. Create zones with level-gated progression, enemies that drop XP and gold, a quest board in the town hub, and an item shop.`,
      namePlaceholder: "My Fantasy RPG",
      scaleLabel: "quests",
    };
  }

  if (templateType === "battlegrounds") {
    return {
      themes: bgThemes,
      scales: bgScales,
      features: bgFeatures,
      stepLabels: [
        { title: "Style", subtitle: "What kind of combat?" },
        { title: "Scale", subtitle: "How intense?" },
        { title: "Systems", subtitle: "What battle features?" },
        { title: "Generate", subtitle: "Name it and let AI build it!" },
      ],
      defaultTheme: "elemental",
      defaultFeatures: ["classes", "abilities", "matchmaking"],
      buildPrompt: (theme: Theme, scale: typeof bgScales[0], features: string[], name: string) =>
        `Create a ${scale.name.toLowerCase()} battlegrounds game called "${name || "My Battlegrounds"}" with ${scale.count} abilities. Make it ${theme.prompt}. Include these systems: ${features}. Create distinct classes with unique health/speed/abilities. Add a matchmaking queue and round-based combat with kill rewards.`,
      namePlaceholder: "My Epic Battlegrounds",
      scaleLabel: "abilities",
    };
  }

  if (templateType === "simulator") {
    return {
      themes: simThemes,
      scales: simScales,
      features: simFeatures,
      stepLabels: [
        { title: "Style", subtitle: "What kind of simulator?" },
        { title: "Scale", subtitle: "How much content?" },
        { title: "Systems", subtitle: "What features to include?" },
        { title: "Generate", subtitle: "Name it and let AI build it!" },
      ],
      defaultTheme: "pets",
      defaultFeatures: ["clicking", "pets", "upgrades"],
      buildPrompt: (theme: Theme, scale: typeof simScales[0], features: string[], name: string) =>
        `Create a ${scale.name.toLowerCase()} simulator called "${name || "My Simulator"}" with ${scale.count} zones. Make it ${theme.prompt}. Include these systems: ${features}. Start with a basic click-to-earn loop, then add zones that unlock at higher coin thresholds. Each zone should have higher coin multipliers and unique visuals.`,
      namePlaceholder: "My Pet Simulator",
      scaleLabel: "zones",
    };
  }

  if (templateType === "tycoon") {
    return {
      themes: tycoonThemes,
      scales: tycoonScales,
      features: tycoonFeatures,
      stepLabels: [
        { title: "Theme", subtitle: "What kind of business?" },
        { title: "Scale", subtitle: "How big should it be?" },
        { title: "Features", subtitle: "What systems to include?" },
        { title: "Generate", subtitle: "Name it and let AI build it!" },
      ],
      defaultTheme: "factory",
      defaultFeatures: ["droppers", "conveyors", "upgrades"],
      buildPrompt: (theme: Theme, scale: typeof tycoonScales[0], features: string[], name: string) =>
        `Create a ${scale.name.toLowerCase()} tycoon called "${name || "My Tycoon"}" with ${scale.count} upgrades. Make it ${theme.prompt}. Include these systems: ${features}. Start with a basic dropper + conveyor + collector loop, then each upgrade should unlock new machines or boost income. Add a rebirth system if selected.`,
      namePlaceholder: "My Epic Factory Tycoon",
      scaleLabel: "upgrades",
    };
  }

  // Default: obby
  return {
    themes: obbyThemes,
    scales: obbyDifficulties,
    features: obbyFeatures,
    stepLabels: [
      { title: "Theme", subtitle: "Pick a vibe for your obby" },
      { title: "Difficulty", subtitle: "How challenging should it be?" },
      { title: "Obstacles", subtitle: "What should players face?" },
      { title: "Generate", subtitle: "Name it and let AI build it!" },
    ],
    defaultTheme: "space",
    defaultFeatures: ["killbricks"],
    buildPrompt: (theme: Theme, scale: typeof obbyDifficulties[0], features: string[], name: string) =>
      `Create a ${scale.name.toLowerCase()} difficulty obby called "${name || "My Obby"}" with ${scale.count} stages. Make it ${theme.prompt}. Include these obstacles: ${features}. Make each stage progressively harder and more visually impressive. Add checkpoints at each stage.`,
    namePlaceholder: "My Epic Space Obby",
    scaleLabel: "stages",
  };
}

export function GuidedWizard({ projectPath, templateType, onComplete }: GuidedWizardProps) {
  const config = getConfig(templateType);
  const { sendMessage, isThinking } = useChatStore();
  const [wizardStep, setWizardStep] = useState(0);
  const [theme, setTheme] = useState<string>(config.defaultTheme);
  const [scale, setScale] = useState<string>(config.scales[0].id);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(config.defaultFeatures);
  const [gameName, setGameName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleFeature = (id: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    const selectedTheme = config.themes.find((t) => t.id === theme)!;
    const selectedScale = config.scales.find((d) => d.id === scale)!;
    const featureNames = selectedFeatures
      .map((id) => config.features.find((f) => f.id === id)?.name)
      .filter(Boolean)
      .join(", ");

    const prompt = config.buildPrompt(selectedTheme, selectedScale, featureNames as unknown as string[], gameName);
    await sendMessage(projectPath, prompt);
    setIsGenerating(false);
    onComplete();
  };

  const steps = config.stepLabels;
  const selectedTheme = config.themes.find((t) => t.id === theme);
  const selectedScale = config.scales.find((d) => d.id === scale);

  return (
    <div className="flex h-full flex-col">
      {/* Progress bar */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <Sparkles size={20} className="text-indigo-400" />
          <h3 className="font-semibold">Game Builder Wizard</h3>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-6 bg-gray-700" />}
              <div className="flex items-center gap-1.5">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    i === wizardStep
                      ? "bg-indigo-600 text-white"
                      : i < wizardStep
                        ? "bg-green-600 text-white"
                        : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {i < wizardStep ? "\u2713" : i + 1}
                </div>
                <span
                  className={`text-xs ${i === wizardStep ? "text-white" : "text-gray-500"}`}
                >
                  {s.title}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Step 0: Theme selection */}
        {wizardStep === 0 && (
          <div>
            <h3 className="text-xl font-bold">{steps[0].subtitle}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {config.themes.map((t) => {
                const Icon = t.icon;
                const selected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                      selected
                        ? "border-indigo-500 bg-indigo-950/50 ring-2 ring-indigo-500/30"
                        : "border-gray-700 bg-gray-800 hover:border-gray-600"
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${t.color}`}>
                      <Icon size={20} />
                    </div>
                    <span className="font-medium">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 1: Scale / Difficulty */}
        {wizardStep === 1 && (
          <div>
            <h3 className="text-xl font-bold">{steps[1].subtitle}</h3>
            <div className="mt-4 space-y-3">
              {config.scales.map((d) => {
                const selected = scale === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setScale(d.id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition-all ${
                      selected
                        ? "border-indigo-500 bg-indigo-950/50 ring-2 ring-indigo-500/30"
                        : "border-gray-700 bg-gray-800 hover:border-gray-600"
                    }`}
                  >
                    <div>
                      <h4 className="font-semibold">{d.name}</h4>
                      <p className="text-sm text-gray-400">{d.desc}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-gray-700 px-2.5 py-1 text-xs text-gray-300">
                      {d.count} {d.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Features */}
        {wizardStep === 2 && (
          <div>
            <h3 className="text-xl font-bold">{steps[2].subtitle}</h3>
            <p className="mt-1 text-sm text-gray-400">Pick as many as you want.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {config.features.map((f) => {
                const selected = selectedFeatures.includes(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleFeature(f.id)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      selected
                        ? "border-indigo-500 bg-indigo-950/50 text-white"
                        : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                    }`}
                  >
                    <h4 className="text-sm font-semibold">{f.name}</h4>
                    <p className="mt-0.5 text-xs text-gray-500">{f.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Generate */}
        {wizardStep === 3 && (
          <div>
            <h3 className="text-xl font-bold">Name your game</h3>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder={config.namePlaceholder}
              autoFocus
              className="mt-4 w-full rounded-xl border border-gray-700 bg-gray-800 px-5 py-3 text-lg text-white placeholder-gray-500 outline-none focus:border-indigo-500"
            />
            <div className="mt-6 rounded-xl bg-gray-800 p-4">
              <h4 className="text-sm font-semibold text-gray-300">Summary</h4>
              <div className="mt-2 space-y-1 text-sm text-gray-400">
                <p>Theme: <span className="text-indigo-300">{selectedTheme?.name}</span></p>
                <p>{steps[1].title}: <span className="text-indigo-300">{selectedScale?.name}</span></p>
                <p>{selectedScale?.label}: <span className="text-indigo-300">{selectedScale?.count}</span></p>
                <p>Features: <span className="text-indigo-300">{selectedFeatures.map((id) => config.features.find((f) => f.id === id)?.name).join(", ")}</span></p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-gray-800 px-6 py-4">
        {wizardStep > 0 ? (
          <button
            onClick={() => setWizardStep(wizardStep - 1)}
            className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-white"
          >
            <ChevronLeft size={16} /> Back
          </button>
        ) : (
          <button
            onClick={onComplete}
            className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-300"
          >
            Skip wizard
          </button>
        )}

        {wizardStep < 3 ? (
          <button
            onClick={() => setWizardStep(wizardStep + 1)}
            className="flex items-center gap-1 rounded-xl bg-indigo-600 px-5 py-2.5 font-medium text-white hover:bg-indigo-500"
          >
            Next <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={isGenerating || isThinking}
            className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-2.5 font-semibold text-white hover:bg-green-500 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles size={18} /> Generate My Game
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
