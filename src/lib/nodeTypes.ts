/**
 * Visual scripting node type registry.
 * Each node type defines its ports, category, and Luau code template.
 */

export type PortType = "signal" | "player" | "part" | "number" | "string" | "bool";

export interface NodePort {
  id: string;
  label: string;
  type: PortType;
  defaultValue?: string | number | boolean;
}

export type NodeCategory = "trigger" | "action" | "logic";

export interface NodeTypeDefinition {
  type: string;
  label: string;
  category: NodeCategory;
  description: string;
  inputs: NodePort[];
  outputs: NodePort[];
  color: string; // Tailwind bg class
}

// ── Trigger Nodes (green — events that start execution) ──

const OnTouched: NodeTypeDefinition = {
  type: "on_touched",
  label: "On Touched",
  category: "trigger",
  description: "Fires when a player touches a tagged part",
  inputs: [
    { id: "tag", label: "Tag", type: "string", defaultValue: "KillBrick" },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "part", label: "Part", type: "part" },
  ],
  color: "bg-green-600",
};

const OnTimer: NodeTypeDefinition = {
  type: "on_timer",
  label: "On Timer",
  category: "trigger",
  description: "Fires repeatedly on an interval",
  inputs: [
    { id: "interval", label: "Seconds", type: "number", defaultValue: 2 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-green-600",
};

const OnPlayerJoin: NodeTypeDefinition = {
  type: "on_player_join",
  label: "On Player Join",
  category: "trigger",
  description: "Fires when a new player joins the game",
  inputs: [],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
    { id: "player", label: "Player", type: "player" },
  ],
  color: "bg-green-600",
};

const OnDied: NodeTypeDefinition = {
  type: "on_died",
  label: "On Died",
  category: "trigger",
  description: "Fires when any player dies",
  inputs: [],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
    { id: "player", label: "Player", type: "player" },
  ],
  color: "bg-green-600",
};

const OnPlayerLeave: NodeTypeDefinition = {
  type: "on_player_leave",
  label: "On Player Leave",
  category: "trigger",
  description: "Fires when a player leaves the game",
  inputs: [],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
    { id: "player", label: "Player", type: "player" },
  ],
  color: "bg-green-600",
};

const OnChat: NodeTypeDefinition = {
  type: "on_chat",
  label: "On Chat",
  category: "trigger",
  description: "Fires when any player sends a chat message",
  inputs: [
    { id: "keyword", label: "Keyword", type: "string", defaultValue: "" },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
    { id: "player", label: "Player", type: "player" },
  ],
  color: "bg-green-600",
};

// ── Action Nodes (blue — do something) ──

const TakeDamage: NodeTypeDefinition = {
  type: "take_damage",
  label: "Take Damage",
  category: "action",
  description: "Deals damage to a player's humanoid",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "amount", label: "Amount", type: "number", defaultValue: 25 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const MoveObject: NodeTypeDefinition = {
  type: "move_object",
  label: "Move Object",
  category: "action",
  description: "Tweens a part to a new position",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "part", label: "Part", type: "part" },
    { id: "direction", label: "Direction", type: "string", defaultValue: "up" },
    { id: "distance", label: "Studs", type: "number", defaultValue: 10 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const PlaySound: NodeTypeDefinition = {
  type: "play_sound",
  label: "Play Sound",
  category: "action",
  description: "Plays a sound effect",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "soundId", label: "Sound ID", type: "string", defaultValue: "rbxassetid://0" },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const PrintMessage: NodeTypeDefinition = {
  type: "print_message",
  label: "Print",
  category: "action",
  description: "Prints a message to the output console",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "message", label: "Message", type: "string", defaultValue: "Hello!" },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const HealPlayer: NodeTypeDefinition = {
  type: "heal_player",
  label: "Heal Player",
  category: "action",
  description: "Restores health to a player's humanoid",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "amount", label: "Amount", type: "number", defaultValue: 50 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const KillPlayer: NodeTypeDefinition = {
  type: "kill_player",
  label: "Kill Player",
  category: "action",
  description: "Sets a player's health to 0",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "player", label: "Player", type: "player" },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const RespawnPlayer: NodeTypeDefinition = {
  type: "respawn_player",
  label: "Respawn Player",
  category: "action",
  description: "Loads a fresh character for the player",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "player", label: "Player", type: "player" },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const TeleportPlayer: NodeTypeDefinition = {
  type: "teleport_player",
  label: "Teleport Player",
  category: "action",
  description: "Teleports a player to the given coordinates",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "x", label: "X", type: "number", defaultValue: 0 },
    { id: "y", label: "Y", type: "number", defaultValue: 5 },
    { id: "z", label: "Z", type: "number", defaultValue: 0 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const SetPartColor: NodeTypeDefinition = {
  type: "set_part_color",
  label: "Set Part Color",
  category: "action",
  description: "Changes the BrickColor of a tagged part",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "tag", label: "Tag", type: "string", defaultValue: "ColorPart" },
    { id: "color", label: "Color", type: "string", defaultValue: "Bright red" },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const ShowHint: NodeTypeDefinition = {
  type: "show_hint",
  label: "Show Hint",
  category: "action",
  description: "Shows a hint message to all players for a few seconds",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "message", label: "Message", type: "string", defaultValue: "Welcome!" },
    { id: "duration", label: "Seconds", type: "number", defaultValue: 3 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const GivePoints: NodeTypeDefinition = {
  type: "give_points",
  label: "Give Points",
  category: "action",
  description: "Adds points to a player's leaderstats",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "amount", label: "Amount", type: "number", defaultValue: 10 },
    { id: "stat", label: "Stat Name", type: "string", defaultValue: "Points" },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

// ── Logic Nodes (orange — control flow and data) ──

const IfElse: NodeTypeDefinition = {
  type: "if_else",
  label: "If / Else",
  category: "logic",
  description: "Branches execution based on a condition",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "condition", label: "Condition", type: "bool", defaultValue: true },
  ],
  outputs: [
    { id: "true", label: "True", type: "signal" },
    { id: "false", label: "False", type: "signal" },
  ],
  color: "bg-orange-600",
};

const WaitDelay: NodeTypeDefinition = {
  type: "wait_delay",
  label: "Wait",
  category: "logic",
  description: "Pauses execution for a number of seconds",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "seconds", label: "Seconds", type: "number", defaultValue: 1 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-orange-600",
};

const Compare: NodeTypeDefinition = {
  type: "compare",
  label: "Compare",
  category: "logic",
  description: "Compares two numbers and outputs a boolean",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "a", label: "A", type: "number", defaultValue: 0 },
    { id: "operator", label: "Operator", type: "string", defaultValue: ">=" },
    { id: "b", label: "B", type: "number", defaultValue: 0 },
  ],
  outputs: [
    { id: "true", label: "True", type: "signal" },
    { id: "false", label: "False", type: "signal" },
  ],
  color: "bg-orange-600",
};

const RandomNumber: NodeTypeDefinition = {
  type: "random_number",
  label: "Random Number",
  category: "logic",
  description: "Generates a random integer in a range",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "min", label: "Min", type: "number", defaultValue: 1 },
    { id: "max", label: "Max", type: "number", defaultValue: 10 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
    { id: "value", label: "Value", type: "number" },
  ],
  color: "bg-orange-600",
};

// ── Registry ──

export const NODE_TYPES: Record<string, NodeTypeDefinition> = {
  // Triggers
  on_touched: OnTouched,
  on_timer: OnTimer,
  on_player_join: OnPlayerJoin,
  on_died: OnDied,
  on_player_leave: OnPlayerLeave,
  on_chat: OnChat,
  // Actions
  take_damage: TakeDamage,
  move_object: MoveObject,
  play_sound: PlaySound,
  print_message: PrintMessage,
  heal_player: HealPlayer,
  kill_player: KillPlayer,
  respawn_player: RespawnPlayer,
  teleport_player: TeleportPlayer,
  set_part_color: SetPartColor,
  show_hint: ShowHint,
  give_points: GivePoints,
  // Logic
  if_else: IfElse,
  wait_delay: WaitDelay,
  compare: Compare,
  random_number: RandomNumber,
};

export const NODE_TYPE_LIST = Object.values(NODE_TYPES);

export const NODE_CATEGORIES: { id: NodeCategory; label: string; color: string }[] = [
  { id: "trigger", label: "Triggers", color: "text-green-400" },
  { id: "action", label: "Actions", color: "text-blue-400" },
  { id: "logic", label: "Logic", color: "text-orange-400" },
];
