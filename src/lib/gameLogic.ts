// ── Roblox Game Logic Definitions ──
// Every element type has pre-built game behavior based on how Roblox Studio actually works.
// When AI places an element, it auto-populates these properties.

export interface ShopItem {
  name: string;
  price: number;
  currency: "Coins" | "Gems" | "Robux";
  icon: string;
  description: string;
}

export interface EnemyDrop {
  item: string;
  chance: number; // 0-1
  amount: number;
}

export interface QuestInfo {
  name: string;
  description: string;
  objective: string;
  reward: { type: string; amount: number };
}

// ── Logic properties per element type ──

export interface GameLogicProperties {
  // Common
  anchored?: boolean;
  canCollide?: boolean;
  material?: string;
  transparency?: number;

  // Shop
  shopItems?: ShopItem[];
  shopName?: string;
  shopDialog?: string;

  // Characters
  health?: number;
  maxHealth?: number;
  damage?: number;
  attackRange?: number;
  walkSpeed?: number;
  respawnTime?: number;
  drops?: EnemyDrop[];
  aiBehavior?: "patrol" | "chase" | "stationary" | "wander";

  // NPC
  dialog?: string[];
  quest?: QuestInfo;
  interactionRange?: number;

  // Collectible
  value?: number;
  currency?: "Coins" | "Gems";
  collectRespawnTime?: number;
  collectSound?: string;

  // Platform behavior
  moveDistance?: number;
  moveSpeed?: number;
  moveDirection?: "horizontal" | "vertical";
  disappearDelay?: number;
  reappearDelay?: number;
  bounceForce?: number;
  conveyorSpeed?: number;
  conveyorDirection?: "left" | "right";

  // Hazard
  killOnTouch?: boolean;
  damagePerSecond?: number;
  spinSpeed?: number;

  // Checkpoint
  stageNumber?: number;
  teamColor?: string;
  autoSave?: boolean;

  // Teleporter/Portal
  destination?: string;
  cooldown?: number;

  // Tycoon
  plotPrice?: number;
  plotOwner?: string;
  upgrades?: { name: string; cost: number; effect: string }[];

  // Machine
  product?: string;
  productionRate?: number;
  valuePerItem?: number;
  upgradeCost?: number;

  // Lighting
  lightRange?: number;
  lightBrightness?: number;
  lightColor?: string;

  // Water/Lava
  swimSpeedModifier?: number;
}

// ── Default logic per element type ──
// This is what gets auto-populated when AI places an element

export function getDefaultLogic(type: string, template: string): GameLogicProperties {
  switch (type) {
    // ── TERRAIN ──
    case "ground":
    case "grass":
      return { anchored: true, canCollide: true, material: "Grass" };
    case "sand":
      return { anchored: true, canCollide: true, material: "Sand" };
    case "ice":
      return { anchored: true, canCollide: true, material: "Ice", transparency: 0.2 };
    case "water":
      return {
        anchored: true, canCollide: false, material: "Water",
        swimSpeedModifier: 0.5, transparency: 0.4,
        damagePerSecond: 0,
      };
    case "lava":
      return {
        anchored: true, canCollide: false, material: "Neon",
        killOnTouch: true, damagePerSecond: 100,
        transparency: 0.1,
      };

    // ── PLATFORMS ──
    case "platform":
      return { anchored: true, canCollide: true, material: "SmoothPlastic" };
    case "moving-platform":
      return {
        anchored: true, canCollide: true, material: "SmoothPlastic",
        moveDistance: 10, moveSpeed: 4, moveDirection: "horizontal",
      };
    case "disappearing":
      return {
        anchored: true, canCollide: true, material: "SmoothPlastic",
        disappearDelay: 1.5, reappearDelay: 3,
      };
    case "bouncy":
      return {
        anchored: true, canCollide: true, material: "SmoothPlastic",
        bounceForce: 80,
      };
    case "conveyor":
      return {
        anchored: true, canCollide: true, material: "SmoothPlastic",
        conveyorSpeed: 12, conveyorDirection: "right",
      };

    // ── OBSTACLES ──
    case "killbrick":
      return {
        anchored: true, canCollide: true, material: "Neon",
        killOnTouch: true, damagePerSecond: 0,
      };
    case "spinner":
      return {
        anchored: true, canCollide: true, material: "SmoothPlastic",
        killOnTouch: true, spinSpeed: 3,
      };
    case "laser":
      return {
        anchored: true, canCollide: false, material: "Neon",
        killOnTouch: true, transparency: 0.3,
      };
    case "spikes":
      return {
        anchored: true, canCollide: true, material: "Metal",
        killOnTouch: true,
      };

    // ── CHARACTERS ──
    case "enemy":
      return {
        health: template === "rpg" ? 50 : 30,
        maxHealth: template === "rpg" ? 50 : 30,
        damage: 10,
        attackRange: 8,
        walkSpeed: 12,
        respawnTime: 15,
        aiBehavior: "chase",
        drops: [
          { item: "Coins", chance: 1, amount: template === "tycoon" ? 25 : 10 },
          { item: "Gem", chance: 0.15, amount: 1 },
          { item: "Health Potion", chance: 0.2, amount: 1 },
        ],
      };
    case "boss":
      return {
        health: template === "rpg" ? 500 : 200,
        maxHealth: template === "rpg" ? 500 : 200,
        damage: 30,
        attackRange: 12,
        walkSpeed: 8,
        respawnTime: 120,
        aiBehavior: "chase",
        drops: [
          { item: "Coins", chance: 1, amount: template === "tycoon" ? 500 : 100 },
          { item: "Rare Gem", chance: 0.5, amount: 1 },
          { item: "Boss Loot Crate", chance: 1, amount: 1 },
        ],
      };
    case "pet":
      return {
        health: 100, maxHealth: 100,
        walkSpeed: 16,
        aiBehavior: "wander",
        damage: 0,
        interactionRange: 5,
      };
    case "npc":
      return {
        health: 100, maxHealth: 100,
        walkSpeed: 0,
        aiBehavior: "stationary",
        interactionRange: 8,
        dialog: [
          "Hello adventurer! Welcome to our village.",
          "I hear there are dangers lurking in the caves nearby...",
          "Be careful out there!",
        ],
        quest: {
          name: "Defeat the Enemies",
          description: "Clear out the enemies threatening our village.",
          objective: "Defeat 3 enemies",
          reward: { type: "Coins", amount: 50 },
        },
      };
    case "shopkeeper":
      return {
        health: 999, maxHealth: 999,
        walkSpeed: 0,
        aiBehavior: "stationary",
        interactionRange: 8,
        shopName: template === "tycoon" ? "Upgrade Shop" : "Item Shop",
        shopDialog: "Welcome to my shop! Take a look at what I've got.",
        shopItems: getDefaultShopItems(template),
      };

    // ── COLLECTIBLES ──
    case "coin":
      return {
        value: template === "simulator" ? 1 : 10,
        currency: "Coins",
        collectRespawnTime: template === "simulator" ? 2 : 10,
        collectSound: "rbxasset://sounds/action_get_up.mp3",
        anchored: true, canCollide: false,
      };
    case "gem":
      return {
        value: template === "simulator" ? 5 : 50,
        currency: "Gems",
        collectRespawnTime: 30,
        collectSound: "rbxasset://sounds/action_get_up.mp3",
        anchored: true, canCollide: false,
      };

    // ── MECHANICS ──
    case "checkpoint":
      return {
        stageNumber: 1,
        autoSave: true,
        teamColor: "Bright green",
        anchored: true, canCollide: true,
      };
    case "spawn":
      return {
        teamColor: "Bright green",
        anchored: true, canCollide: true,
        stageNumber: 0,
      };
    case "teleporter":
      return {
        destination: "Zone 2",
        cooldown: 3,
        anchored: true, canCollide: true,
      };
    case "portal":
      return {
        destination: "Next Zone",
        cooldown: 2,
        anchored: true, canCollide: true,
      };
    case "boost-pad":
      return {
        bounceForce: 0,
        conveyorSpeed: 30,
        conveyorDirection: "right",
        anchored: true, canCollide: true,
      };

    // ── STRUCTURES ──
    case "house":
    case "shop-building":
      return { anchored: true, canCollide: true, material: "SmoothPlastic" };
    case "cave":
      return { anchored: true, canCollide: true, material: "Slate" };
    case "tower":
      return { anchored: true, canCollide: true, material: "Concrete" };
    case "bridge":
      return { anchored: true, canCollide: true, material: "Wood" };
    case "wall":
      return { anchored: true, canCollide: true, material: "Concrete" };
    case "tunnel":
      return { anchored: true, canCollide: true, material: "Slate" };
    case "arena":
      return { anchored: true, canCollide: true, material: "SmoothPlastic" };
    case "fence":
      return { anchored: true, canCollide: true, material: "Wood" };
    case "tycoon-plot":
      return {
        plotPrice: 0,
        plotOwner: "",
        anchored: true, canCollide: true,
        upgrades: [
          { name: "Bigger Plot", cost: 500, effect: "Increases plot size by 50%" },
          { name: "Auto Collector", cost: 1000, effect: "Automatically collects dropped items" },
          { name: "Speed Boost", cost: 2000, effect: "Machines run 2x faster" },
        ],
      };
    case "machine":
      return {
        product: "Coins",
        productionRate: 2,
        valuePerItem: 5,
        upgradeCost: 100,
        anchored: true, canCollide: true,
      };
    case "dropper":
      return {
        product: "Gold Ore",
        productionRate: 2, // drops every 2 seconds
        valuePerItem: 5,
        upgradeCost: 500,
        anchored: true, canCollide: true, material: "SmoothPlastic",
      };
    case "conveyor-belt":
      return {
        conveyorSpeed: 12,
        conveyorDirection: "right" as const,
        anchored: true, canCollide: true, material: "SmoothPlastic",
      };
    case "collector":
      return {
        anchored: true, canCollide: false, material: "Neon",
        value: 1, // sell multiplier
      };
    case "upgrade-button":
      return {
        anchored: true, canCollide: true, material: "SmoothPlastic",
        upgradeCost: 500,
      };
    case "race-track":
      return { anchored: true, canCollide: true, material: "SmoothPlastic" };
    case "market-stall":
      return {
        anchored: true, canCollide: true,
        shopItems: [
          { name: "Apple", price: 5, currency: "Coins", icon: "🍎", description: "Restores 10 HP" },
          { name: "Sword", price: 50, currency: "Coins", icon: "⚔️", description: "+5 damage" },
        ],
      };

    // ── DECORATIONS ──
    case "lamp":
      return {
        anchored: true, canCollide: true,
        lightRange: 15, lightBrightness: 1, lightColor: "#ffd700",
      };
    case "tree":
    case "rock":
    case "bush":
      return { anchored: true, canCollide: true, material: "Plastic" };

    default:
      return { anchored: true, canCollide: true, material: "Plastic" };
  }
}

// ── Default shop items per template ──

function getDefaultShopItems(template: string): ShopItem[] {
  switch (template) {
    case "obby":
      return [
        { name: "Speed Coil", price: 100, currency: "Coins", icon: "⚡", description: "Run 2x faster" },
        { name: "Gravity Coil", price: 200, currency: "Coins", icon: "🪶", description: "Jump 3x higher" },
        { name: "Skip Stage", price: 500, currency: "Coins", icon: "⏭️", description: "Skip to next checkpoint" },
        { name: "Trail Effect", price: 50, currency: "Gems", icon: "✨", description: "Cool trail behind you" },
      ];
    case "tycoon":
      return [
        { name: "Dropper Upgrade", price: 500, currency: "Coins", icon: "⬆️", description: "2x dropper speed" },
        { name: "Auto Collector", price: 1000, currency: "Coins", icon: "🧲", description: "Auto-collect items" },
        { name: "New Dropper", price: 2000, currency: "Coins", icon: "🏭", description: "Unlocks diamond dropper" },
        { name: "Rebirth", price: 10000, currency: "Coins", icon: "🔄", description: "Reset for 2x earnings" },
      ];
    case "simulator":
      return [
        { name: "Better Backpack", price: 100, currency: "Coins", icon: "🎒", description: "Hold 2x more items" },
        { name: "Lucky Charm", price: 50, currency: "Gems", icon: "🍀", description: "+25% rare drops" },
        { name: "Auto Farm", price: 500, currency: "Gems", icon: "🤖", description: "Auto-collect for 5 min" },
        { name: "Pet Egg", price: 200, currency: "Coins", icon: "🥚", description: "Hatch a random pet" },
      ];
    case "rpg":
      return [
        { name: "Health Potion", price: 25, currency: "Coins", icon: "❤️", description: "Restore 50 HP" },
        { name: "Iron Sword", price: 100, currency: "Coins", icon: "⚔️", description: "+10 damage" },
        { name: "Shield", price: 150, currency: "Coins", icon: "🛡️", description: "+20 defense" },
        { name: "Mana Potion", price: 30, currency: "Coins", icon: "💙", description: "Restore 30 mana" },
        { name: "Teleport Scroll", price: 50, currency: "Coins", icon: "📜", description: "Return to town" },
      ];
    case "horror":
      return [
        { name: "Flashlight", price: 50, currency: "Coins", icon: "🔦", description: "See in the dark" },
        { name: "Sprint Boost", price: 100, currency: "Coins", icon: "🏃", description: "Run faster for 30s" },
        { name: "Shield", price: 200, currency: "Coins", icon: "🛡️", description: "Survive one hit" },
      ];
    case "battlegrounds":
      return [
        { name: "Health Pack", price: 50, currency: "Coins", icon: "❤️", description: "Restore 50 HP" },
        { name: "Sword", price: 100, currency: "Coins", icon: "⚔️", description: "+10 damage" },
        { name: "Armor", price: 200, currency: "Coins", icon: "🛡️", description: "+30 defense" },
        { name: "Speed Boost", price: 75, currency: "Coins", icon: "⚡", description: "+50% speed for 20s" },
      ];
    default:
      return [
        { name: "Speed Boost", price: 100, currency: "Coins", icon: "⚡", description: "Move faster" },
        { name: "Health Potion", price: 50, currency: "Coins", icon: "❤️", description: "Restore HP" },
        { name: "Jump Boost", price: 150, currency: "Coins", icon: "🪶", description: "Jump higher" },
      ];
  }
}

// ── Format logic as readable summary ──

export function formatLogicSummary(type: string, logic: GameLogicProperties): string[] {
  const lines: string[] = [];

  if (logic.health) lines.push(`❤️ ${logic.health} HP`);
  if (logic.damage) lines.push(`⚔️ ${logic.damage} damage`);
  if (logic.walkSpeed) lines.push(`🏃 Speed: ${logic.walkSpeed}`);
  if (logic.aiBehavior) lines.push(`🧠 AI: ${logic.aiBehavior}`);
  if (logic.respawnTime) lines.push(`⏱️ Respawn: ${logic.respawnTime}s`);
  if (logic.drops?.length) lines.push(`💰 Drops: ${logic.drops.map(d => `${d.item}(${Math.round(d.chance * 100)}%)`).join(", ")}`);
  if (logic.shopItems?.length) lines.push(`🛒 Sells ${logic.shopItems.length} items`);
  if (logic.shopName) lines.push(`🏪 ${logic.shopName}`);
  if (logic.quest) lines.push(`📋 Quest: ${logic.quest.name}`);
  if (logic.dialog?.length) lines.push(`💬 ${logic.dialog.length} dialog lines`);
  if (logic.value) lines.push(`💰 Value: ${logic.value} ${logic.currency || "Coins"}`);
  if (logic.collectRespawnTime) lines.push(`⏱️ Respawns in ${logic.collectRespawnTime}s`);
  if (logic.killOnTouch) lines.push(`☠️ Kills on touch`);
  if (logic.damagePerSecond) lines.push(`🔥 ${logic.damagePerSecond} DPS`);
  if (logic.moveDistance) lines.push(`↔️ Moves ${logic.moveDistance} studs ${logic.moveDirection}`);
  if (logic.moveSpeed) lines.push(`⚡ Move speed: ${logic.moveSpeed}`);
  if (logic.disappearDelay) lines.push(`👻 Disappears after ${logic.disappearDelay}s`);
  if (logic.bounceForce) lines.push(`⬆️ Bounce force: ${logic.bounceForce}`);
  if (logic.conveyorSpeed) lines.push(`→ Conveyor speed: ${logic.conveyorSpeed}`);
  if (logic.spinSpeed) lines.push(`🔄 Spin speed: ${logic.spinSpeed}`);
  if (logic.stageNumber !== undefined) lines.push(`🏁 Stage ${logic.stageNumber}`);
  if (logic.destination) lines.push(`🌀 Goes to: ${logic.destination}`);
  if (logic.cooldown) lines.push(`⏱️ Cooldown: ${logic.cooldown}s`);
  if (logic.plotPrice !== undefined) lines.push(`💰 Plot price: ${logic.plotPrice}`);
  if (logic.product) lines.push(`🏭 Produces: ${logic.product}`);
  if (logic.productionRate) lines.push(`⚡ Rate: ${logic.productionRate}/s`);
  if (logic.valuePerItem) lines.push(`💰 Value: ${logic.valuePerItem} each`);
  if (logic.lightRange) lines.push(`💡 Range: ${logic.lightRange} studs`);
  if (logic.material) lines.push(`🧱 Material: ${logic.material}`);

  return lines;
}
