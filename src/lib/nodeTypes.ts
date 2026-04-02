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

// ── New Trigger Nodes ──

const OnValueChanged: NodeTypeDefinition = {
  type: "on_value_changed",
  label: "On Value Changed",
  category: "trigger",
  description: "Fires when a NumberValue or StringValue changes in workspace",
  inputs: [
    { id: "valueName", label: "Value Name", type: "string", defaultValue: "Score" },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
    { id: "newValue", label: "New Value", type: "number" },
  ],
  color: "bg-green-600",
};

const OnProximity: NodeTypeDefinition = {
  type: "on_proximity",
  label: "On Proximity",
  category: "trigger",
  description: "Fires when a player enters the radius of a tagged part",
  inputs: [
    { id: "tag", label: "Tag", type: "string", defaultValue: "InteractPart" },
    { id: "radius", label: "Radius", type: "number", defaultValue: 10 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "part", label: "Part", type: "part" },
  ],
  color: "bg-green-600",
};

const OnClick: NodeTypeDefinition = {
  type: "on_click",
  label: "On Click",
  category: "trigger",
  description: "Fires when a player clicks a tagged part via ClickDetector",
  inputs: [
    { id: "tag", label: "Tag", type: "string", defaultValue: "Clickable" },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "part", label: "Part", type: "part" },
  ],
  color: "bg-green-600",
};

const OnGamepassPurchased: NodeTypeDefinition = {
  type: "on_gamepass_purchased",
  label: "On GamePass Bought",
  category: "trigger",
  description: "Fires when a player purchases a specific GamePass",
  inputs: [
    { id: "gamepassId", label: "GamePass ID", type: "number", defaultValue: 0 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
    { id: "player", label: "Player", type: "player" },
  ],
  color: "bg-green-600",
};

const OnDeveloperProduct: NodeTypeDefinition = {
  type: "on_developer_product",
  label: "On Product Bought",
  category: "trigger",
  description: "Fires when a player purchases a Developer Product",
  inputs: [
    { id: "productId", label: "Product ID", type: "number", defaultValue: 0 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
    { id: "player", label: "Player", type: "player" },
  ],
  color: "bg-green-600",
};

// ── New Action Nodes — Data & Persistence ──

const SaveData: NodeTypeDefinition = {
  type: "save_data",
  label: "Save Data",
  category: "action",
  description: "Saves a value to DataStore for a player (persists between sessions)",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "key", label: "Key", type: "string", defaultValue: "Coins" },
    { id: "value", label: "Value", type: "number", defaultValue: 0 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const LoadData: NodeTypeDefinition = {
  type: "load_data",
  label: "Load Data",
  category: "action",
  description: "Loads a saved value from DataStore for a player",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "key", label: "Key", type: "string", defaultValue: "Coins" },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
    { id: "value", label: "Value", type: "number" },
  ],
  color: "bg-blue-600",
};

const SetLeaderstat: NodeTypeDefinition = {
  type: "set_leaderstat",
  label: "Set Leaderstat",
  category: "action",
  description: "Creates or updates a leaderboard stat for a player",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "stat", label: "Stat Name", type: "string", defaultValue: "Coins" },
    { id: "value", label: "Value", type: "number", defaultValue: 0 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const GetLeaderstat: NodeTypeDefinition = {
  type: "get_leaderstat",
  label: "Get Leaderstat",
  category: "action",
  description: "Reads a leaderboard stat value for a player",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "stat", label: "Stat Name", type: "string", defaultValue: "Coins" },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
    { id: "value", label: "Value", type: "number" },
  ],
  color: "bg-blue-600",
};

// ── New Action Nodes — UI & Feedback ──

const ShowNotification: NodeTypeDefinition = {
  type: "show_notification",
  label: "Show Notification",
  category: "action",
  description: "Shows a notification popup to a player",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "title", label: "Title", type: "string", defaultValue: "Notice" },
    { id: "text", label: "Text", type: "string", defaultValue: "Something happened!" },
    { id: "duration", label: "Seconds", type: "number", defaultValue: 5 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const ScreenShake: NodeTypeDefinition = {
  type: "screen_shake",
  label: "Screen Shake",
  category: "action",
  description: "Shakes the camera for a player (explosion effect)",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "intensity", label: "Intensity", type: "number", defaultValue: 5 },
    { id: "duration", label: "Seconds", type: "number", defaultValue: 0.5 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const CreateParticle: NodeTypeDefinition = {
  type: "create_particle",
  label: "Create Particle",
  category: "action",
  description: "Creates a temporary particle effect on a tagged part",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "tag", label: "Tag", type: "string", defaultValue: "EffectPart" },
    { id: "color", label: "Color", type: "string", defaultValue: "Bright yellow" },
    { id: "duration", label: "Seconds", type: "number", defaultValue: 2 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const ChangeLighting: NodeTypeDefinition = {
  type: "change_lighting",
  label: "Change Lighting",
  category: "action",
  description: "Changes the game lighting (brightness, time, fog)",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "brightness", label: "Brightness", type: "number", defaultValue: 2 },
    { id: "clockTime", label: "Clock Time", type: "number", defaultValue: 14 },
    { id: "fogEnd", label: "Fog End", type: "number", defaultValue: 10000 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

// ── New Action Nodes — Movement & Physics ──

const ApplyForce: NodeTypeDefinition = {
  type: "apply_force",
  label: "Apply Force",
  category: "action",
  description: "Applies a physics force to a part",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "part", label: "Part", type: "part" },
    { id: "forceX", label: "Force X", type: "number", defaultValue: 0 },
    { id: "forceY", label: "Force Y", type: "number", defaultValue: 50 },
    { id: "forceZ", label: "Force Z", type: "number", defaultValue: 0 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const TweenProperty: NodeTypeDefinition = {
  type: "tween_property",
  label: "Tween Property",
  category: "action",
  description: "Smoothly animates any property of a part over time",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "part", label: "Part", type: "part" },
    { id: "property", label: "Property", type: "string", defaultValue: "Transparency" },
    { id: "targetValue", label: "Target", type: "number", defaultValue: 1 },
    { id: "duration", label: "Seconds", type: "number", defaultValue: 1 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const AnchorToggle: NodeTypeDefinition = {
  type: "anchor_toggle",
  label: "Set Anchored",
  category: "action",
  description: "Sets whether a part is anchored (frozen) or free to move",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "part", label: "Part", type: "part" },
    { id: "anchored", label: "Anchored", type: "bool", defaultValue: true },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const DestroyPart: NodeTypeDefinition = {
  type: "destroy_part",
  label: "Destroy Part",
  category: "action",
  description: "Permanently removes a part from the game",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "part", label: "Part", type: "part" },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const ClonePart: NodeTypeDefinition = {
  type: "clone_part",
  label: "Clone Part",
  category: "action",
  description: "Duplicates a part and places the clone in workspace",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "part", label: "Part", type: "part" },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
    { id: "clone", label: "Clone", type: "part" },
  ],
  color: "bg-blue-600",
};

// ── New Action Nodes — Economy & Monetization ──

const GiveCurrency: NodeTypeDefinition = {
  type: "give_currency",
  label: "Give Currency",
  category: "action",
  description: "Adds currency to a player's leaderstats",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "currency", label: "Currency", type: "string", defaultValue: "Coins" },
    { id: "amount", label: "Amount", type: "number", defaultValue: 10 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const SpendCurrency: NodeTypeDefinition = {
  type: "spend_currency",
  label: "Spend Currency",
  category: "action",
  description: "Deducts currency if player has enough (branches on success/fail)",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "currency", label: "Currency", type: "string", defaultValue: "Coins" },
    { id: "amount", label: "Cost", type: "number", defaultValue: 10 },
  ],
  outputs: [
    { id: "success", label: "Success", type: "signal" },
    { id: "fail", label: "Not Enough", type: "signal" },
  ],
  color: "bg-blue-600",
};

const PromptPurchase: NodeTypeDefinition = {
  type: "prompt_purchase",
  label: "Prompt Purchase",
  category: "action",
  description: "Opens the Roblox purchase dialog for an asset",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "assetId", label: "Asset ID", type: "number", defaultValue: 0 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const PromptGamepass: NodeTypeDefinition = {
  type: "prompt_gamepass",
  label: "Prompt GamePass",
  category: "action",
  description: "Opens the GamePass purchase dialog for a player",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "gamepassId", label: "GamePass ID", type: "number", defaultValue: 0 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const CheckGamepass: NodeTypeDefinition = {
  type: "check_gamepass",
  label: "Check GamePass",
  category: "action",
  description: "Checks if a player owns a GamePass (branches on owns/doesn't)",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "gamepassId", label: "GamePass ID", type: "number", defaultValue: 0 },
  ],
  outputs: [
    { id: "owns", label: "Owns", type: "signal" },
    { id: "doesNotOwn", label: "Doesn't Own", type: "signal" },
  ],
  color: "bg-blue-600",
};

// ── New Action Nodes — Communication ──

const FireRemote: NodeTypeDefinition = {
  type: "fire_remote",
  label: "Fire Remote",
  category: "action",
  description: "Fires a RemoteEvent to client(s) for UI/effects",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "eventName", label: "Event", type: "string", defaultValue: "MyEvent" },
    { id: "target", label: "Target", type: "string", defaultValue: "all" },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
  ],
  color: "bg-blue-600",
};

const FireServer: NodeTypeDefinition = {
  type: "fire_server",
  label: "Fire Server",
  category: "action",
  description: "Fires a RemoteEvent to the server",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "eventName", label: "Event", type: "string", defaultValue: "MyEvent" },
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

// ── New Logic Nodes ──

const ForEachPlayer: NodeTypeDefinition = {
  type: "for_each_player",
  label: "For Each Player",
  category: "logic",
  description: "Loops over every player in the game",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
  ],
  outputs: [
    { id: "body", label: "Each", type: "signal" },
    { id: "player", label: "Player", type: "player" },
    { id: "done", label: "Done", type: "signal" },
  ],
  color: "bg-orange-600",
};

const MathOperation: NodeTypeDefinition = {
  type: "math_operation",
  label: "Math",
  category: "logic",
  description: "Performs arithmetic: add, subtract, multiply, or divide",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "a", label: "A", type: "number", defaultValue: 0 },
    { id: "operator", label: "Op", type: "string", defaultValue: "+" },
    { id: "b", label: "B", type: "number", defaultValue: 0 },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
    { id: "result", label: "Result", type: "number" },
  ],
  color: "bg-orange-600",
};

const StringFormat: NodeTypeDefinition = {
  type: "string_format",
  label: "Join Text",
  category: "logic",
  description: "Concatenates two strings together",
  inputs: [
    { id: "signal", label: "Do", type: "signal" },
    { id: "a", label: "Text A", type: "string", defaultValue: "Hello " },
    { id: "b", label: "Text B", type: "string", defaultValue: "World" },
  ],
  outputs: [
    { id: "signal", label: "Then", type: "signal" },
    { id: "result", label: "Result", type: "string" },
  ],
  color: "bg-orange-600",
};

const AndGate: NodeTypeDefinition = {
  type: "and_gate",
  label: "AND",
  category: "logic",
  description: "Outputs true only if both inputs are true",
  inputs: [
    { id: "a", label: "A", type: "bool", defaultValue: false },
    { id: "b", label: "B", type: "bool", defaultValue: false },
  ],
  outputs: [
    { id: "result", label: "Result", type: "bool" },
  ],
  color: "bg-orange-600",
};

const OrGate: NodeTypeDefinition = {
  type: "or_gate",
  label: "OR",
  category: "logic",
  description: "Outputs true if either input is true",
  inputs: [
    { id: "a", label: "A", type: "bool", defaultValue: false },
    { id: "b", label: "B", type: "bool", defaultValue: false },
  ],
  outputs: [
    { id: "result", label: "Result", type: "bool" },
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
  on_value_changed: OnValueChanged,
  on_proximity: OnProximity,
  on_click: OnClick,
  on_gamepass_purchased: OnGamepassPurchased,
  on_developer_product: OnDeveloperProduct,
  // Actions — Combat & Player
  take_damage: TakeDamage,
  heal_player: HealPlayer,
  kill_player: KillPlayer,
  respawn_player: RespawnPlayer,
  teleport_player: TeleportPlayer,
  // Actions — World
  move_object: MoveObject,
  play_sound: PlaySound,
  print_message: PrintMessage,
  set_part_color: SetPartColor,
  show_hint: ShowHint,
  apply_force: ApplyForce,
  tween_property: TweenProperty,
  anchor_toggle: AnchorToggle,
  destroy_part: DestroyPart,
  clone_part: ClonePart,
  create_particle: CreateParticle,
  change_lighting: ChangeLighting,
  // Actions — Data & Persistence
  save_data: SaveData,
  load_data: LoadData,
  set_leaderstat: SetLeaderstat,
  get_leaderstat: GetLeaderstat,
  // Actions — UI & Feedback
  show_notification: ShowNotification,
  screen_shake: ScreenShake,
  // Actions — Economy & Monetization
  give_points: GivePoints,
  give_currency: GiveCurrency,
  spend_currency: SpendCurrency,
  prompt_purchase: PromptPurchase,
  prompt_gamepass: PromptGamepass,
  check_gamepass: CheckGamepass,
  // Actions — Communication
  fire_remote: FireRemote,
  fire_server: FireServer,
  // Logic
  if_else: IfElse,
  wait_delay: WaitDelay,
  compare: Compare,
  random_number: RandomNumber,
  for_each_player: ForEachPlayer,
  math_operation: MathOperation,
  string_format: StringFormat,
  and_gate: AndGate,
  or_gate: OrGate,
};

export const NODE_TYPE_LIST = Object.values(NODE_TYPES);

export const NODE_CATEGORIES: { id: NodeCategory; label: string; color: string }[] = [
  { id: "trigger", label: "Triggers", color: "text-green-400" },
  { id: "action", label: "Actions", color: "text-blue-400" },
  { id: "logic", label: "Logic", color: "text-orange-400" },
];
