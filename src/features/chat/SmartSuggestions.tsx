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
