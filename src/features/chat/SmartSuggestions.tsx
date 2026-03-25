import { Lightbulb } from "lucide-react";
import { useUserStore } from "../../stores/userStore";
import { useProjectStore } from "../../stores/projectStore";

interface SmartSuggestionsProps {
  onSelect: (suggestion: string) => void;
  messageCount: number;
}

export function SmartSuggestions({ onSelect, messageCount }: SmartSuggestionsProps) {
  const { profile } = useUserStore();
  const { projectState } = useProjectStore();
  const stageCount = projectState?.stageCount ?? 0;

  const getSuggestions = (): string[] => {
    // Context-aware suggestions based on game state and conversation progress
    if (messageCount === 0) {
      // First message — starter suggestions
      if (profile.experienceLevel === "beginner") {
        return [
          "Make a space obby with 5 stages",
          "Create a rainbow obby that gets harder each level",
          "Build an easy obby with lots of checkpoints",
          "Make a lava-themed obby for beginners",
        ];
      } else if (profile.experienceLevel === "intermediate") {
        return [
          "Create a 7-stage obby with moving platforms and kill bricks",
          "Build a neon cyberpunk obby with conveyor belts",
          "Make an ice obby where platforms are slippery glass",
          "Design a forest obby with trampolines and narrow bridges",
        ];
      } else {
        return [
          "Create a 10-stage obby with progressive difficulty scaling",
          "Build an obby with TweenService-animated platforms and phase mechanics",
          "Design stages with alternating materials and CollectionService-tagged hazards",
          "Create an obby with speed boost pads, wall jumps, and checkpoint validation",
        ];
      }
    }

    if (stageCount < 3) {
      return [
        "Add more stages",
        "Make the platforms more colorful",
        "Add moving platforms to stage " + stageCount,
        "Add kill bricks between the platforms",
      ];
    }

    if (stageCount >= 3 && stageCount < 6) {
      return [
        "Add spinning obstacles to the latest stage",
        "Make a secret shortcut between stages",
        "Add disappearing blocks",
        "Add a speed boost section",
      ];
    }

    // Later stages — advanced suggestions
    return [
      "Add a final boss stage with everything combined",
      "Make the last stage have invisible platforms",
      "Add a victory celebration at the end",
      "Review the whole obby for balance",
    ];
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
