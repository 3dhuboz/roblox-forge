import { Lightbulb } from "lucide-react";
import { useUserStore } from "../../stores/userStore";
import { useProjectStore } from "../../stores/projectStore";

interface SmartSuggestionsProps {
  onSelect: (suggestion: string) => void;
  messageCount: number;
}

// ── Obby suggestions ──

function obbyStarters(level: string): string[] {
  if (level === "beginner") {
    return [
      "Make a space obby with 5 stages",
      "Create a rainbow obby that gets harder each level",
      "Build an easy obby with lots of checkpoints",
      "Make a lava-themed obby for beginners",
    ];
  }
  if (level === "intermediate") {
    return [
      "Create a 7-stage obby with moving platforms and kill bricks",
      "Build a neon cyberpunk obby with conveyor belts",
      "Make an ice obby where platforms are slippery glass",
      "Design a forest obby with trampolines and narrow bridges",
    ];
  }
  return [
    "Create a 10-stage obby with progressive difficulty scaling",
    "Build an obby with TweenService-animated platforms and phase mechanics",
    "Design stages with alternating materials and CollectionService-tagged hazards",
    "Create an obby with speed boost pads, wall jumps, and checkpoint validation",
  ];
}

function obbyProgress(stageCount: number): string[] {
  if (stageCount < 3) {
    return [
      "Add more stages",
      "Make the platforms more colorful",
      "Add moving platforms to stage " + stageCount,
      "Add kill bricks between the platforms",
    ];
  }
  if (stageCount < 6) {
    return [
      "Add spinning obstacles to the latest stage",
      "Make a secret shortcut between stages",
      "Add disappearing blocks",
      "Add a speed boost section",
    ];
  }
  return [
    "Add a final boss stage with everything combined",
    "Make the last stage have invisible platforms",
    "Add a victory celebration at the end",
    "Review the whole obby for balance",
  ];
}

// ── Tycoon suggestions ──

function tycoonStarters(level: string): string[] {
  if (level === "beginner") {
    return [
      "Set up a basic dropper that makes money",
      "Add a faster dropper upgrade for $100",
      "Make the conveyor belt move items to the collector",
      "Add a leaderboard showing who earns the most",
    ];
  }
  if (level === "intermediate") {
    return [
      "Create a multi-dropper setup with 3 different ore types",
      "Add a rebirth system that gives permanent multipliers",
      "Design an upgrade tree with 6 purchasable boosts",
      "Add a pet system that auto-collects drops",
    ];
  }
  return [
    "Build a tiered upgrade system with prestige milestones",
    "Implement auto-collect with configurable Collection radius",
    "Create a game pass shop with 2x cash and auto-rebirth passes",
    "Design a codes system with time-limited redemption",
  ];
}

function tycoonProgress(messageCount: number): string[] {
  if (messageCount < 6) {
    return [
      "Add a new dropper that produces gems",
      "Create a 2x value upgrade button",
      "Make the factory floor bigger",
      "Add particle effects to the collector",
    ];
  }
  if (messageCount < 12) {
    return [
      "Add a rebirth system",
      "Create a VIP game pass for 2x earnings",
      "Add a codes system",
      "Make a leaderboard for richest players",
    ];
  }
  return [
    "Add an auto-collect upgrade",
    "Create a prestige tier with new machines",
    "Add sound effects for collecting and upgrading",
    "Review the economy balance",
  ];
}

// ── Simulator suggestions ──

function simStarters(level: string): string[] {
  if (level === "beginner") {
    return [
      "Add a big glowing orb I can click for coins",
      "Create an egg that hatches into a random pet",
      "Make an upgrade that increases my click power",
      "Add a second zone that costs 1000 coins to enter",
    ];
  }
  if (level === "intermediate") {
    return [
      "Set up a click system with combo multipliers",
      "Create 3 egg tiers: Common, Rare, and Legendary",
      "Add a rebirth system at 50K coins for 2x multiplier",
      "Design 4 zones with increasing coin multipliers",
    ];
  }
  return [
    "Build a click system with server-validated earnings and anti-exploit checks",
    "Create a weighted pet RNG with pity system after 50 hatches",
    "Implement a prestige system with gem rewards and permanent stat boosts",
    "Design zone gates with CollectionService tags and smooth unlock transitions",
  ];
}

function simProgress(messageCount: number): string[] {
  if (messageCount < 6) {
    return [
      "Add a new pet egg with rare drops",
      "Create a click power upgrade for 200 coins",
      "Add particle effects when clicking orbs",
      "Make a second zone with purple crystal theme",
    ];
  }
  if (messageCount < 12) {
    return [
      "Add a rebirth system",
      "Create a pet trading system",
      "Add a codes system for free rewards",
      "Make a global leaderboard",
    ];
  }
  return [
    "Add an auto-clicker upgrade for gems",
    "Create a seasonal event zone",
    "Add pet fusion to combine duplicates",
    "Review the progression balance",
  ];
}

// ── Battlegrounds suggestions ──

function bgStarters(level: string): string[] {
  if (level === "beginner") {
    return [
      "Add a fireball ability I can shoot",
      "Create 2 teams with different spawn points",
      "Make a simple arena with some cover walls",
      "Add a health bar that shows my HP",
    ];
  }
  if (level === "intermediate") {
    return [
      "Create 4 classes: Warrior, Mage, Healer, Assassin",
      "Add 5 abilities with different cooldowns and ranges",
      "Build a matchmaking queue with round timers",
      "Design an arena with cover, high ground, and flanking routes",
    ];
  }
  return [
    "Implement server-authoritative hit detection with lag compensation",
    "Create a class system with distinct stat profiles and ability loadouts",
    "Design a ranked matchmaking system with ELO-based pairing",
    "Build a projectile system using BodyVelocity with collision raycasting",
  ];
}

function bgProgress(messageCount: number): string[] {
  if (messageCount < 6) {
    return [
      "Add a new ability — ice shard that slows enemies",
      "Create a second arena with a lava theme",
      "Add kill rewards — 25 coins per elimination",
      "Make the health bar change color as HP drops",
    ];
  }
  if (messageCount < 12) {
    return [
      "Add a kill feed in the top right corner",
      "Create a respawn system with 5-second timer",
      "Add a round-end screen showing MVP",
      "Make a leaderboard for kills and wins",
    ];
  }
  return [
    "Add a cosmetics shop for skins and effects",
    "Create a team deathmatch mode",
    "Add an ultimate ability with long cooldown",
    "Review class balance and damage numbers",
  ];
}

// ── RPG suggestions ──

function rpgStarters(level: string): string[] {
  if (level === "beginner") {
    return [
      "Add some slime enemies I can fight",
      "Create a quest to defeat 5 slimes",
      "Make a shop where I can buy a sword",
      "Add a second zone called Dark Forest",
    ];
  }
  if (level === "intermediate") {
    return [
      "Create a quest chain: kill slimes → explore forest → defeat boss",
      "Add an inventory system with weapons and armor",
      "Design 3 zones with level-gated progression",
      "Add a boss fight with the Forest Guardian",
    ];
  }
  return [
    "Implement an XP curve with 1.5x scaling per level",
    "Create a loot table with weighted drop rates per enemy",
    "Design a quest system with kill/explore/collect objectives",
    "Build a stat system with per-level scaling for HP/ATK/DEF",
  ];
}

function rpgProgress(messageCount: number): string[] {
  if (messageCount < 6) {
    return [
      "Add a stronger enemy — Goblin with more HP",
      "Create a health potion item for 20 gold",
      "Add a quest board NPC in the town",
      "Make enemies drop gold when defeated",
    ];
  }
  if (messageCount < 12) {
    return [
      "Add a boss fight with special attacks",
      "Create a crafting system",
      "Add companion pets that fight alongside you",
      "Make a dungeon zone with traps and treasure",
    ];
  }
  return [
    "Add a PvP arena for player duels",
    "Create a guild system",
    "Add rare legendary item drops from bosses",
    "Review the level progression and XP balance",
  ];
}

// ── Generic fallback ──

function genericStarters(level: string): string[] {
  if (level === "beginner") {
    return [
      "Describe the game you want to make",
      "What theme should the game have?",
      "How many players should it support?",
      "What's the main gameplay loop?",
    ];
  }
  return [
    "Describe the core mechanic",
    "What game systems do you need?",
    "What should the player progression look like?",
    "How should monetization work?",
  ];
}

export function SmartSuggestions({ onSelect, messageCount }: SmartSuggestionsProps) {
  const { profile } = useUserStore();
  const { project, projectState } = useProjectStore();
  const stageCount = projectState?.stageCount ?? 0;
  const template = project?.template ?? "obby";
  const level = profile.experienceLevel;

  const getSuggestions = (): string[] => {
    if (template === "obby") {
      return messageCount === 0
        ? obbyStarters(level)
        : obbyProgress(stageCount);
    }

    if (template === "tycoon") {
      return messageCount === 0
        ? tycoonStarters(level)
        : tycoonProgress(messageCount);
    }

    if (template === "simulator") {
      return messageCount === 0
        ? simStarters(level)
        : simProgress(messageCount);
    }

    if (template === "battlegrounds") {
      return messageCount === 0
        ? bgStarters(level)
        : bgProgress(messageCount);
    }

    if (template === "rpg") {
      return messageCount === 0
        ? rpgStarters(level)
        : rpgProgress(messageCount);
    }

    return genericStarters(level);
  };

  const suggestions = getSuggestions();

  return (
    <div className="flex items-start gap-2 px-4 py-3">
      <Lightbulb size={14} className="mt-0.5 shrink-0 text-yellow-500" />
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSelect(suggestion)}
            className="rounded-full border border-gray-700 bg-gray-800/80 px-3 py-1 text-xs text-gray-300 transition-colors hover:border-indigo-500/50 hover:bg-indigo-950/30 hover:text-indigo-300"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
