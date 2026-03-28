import { useState, useRef, useEffect } from "react";
import {
  Sparkles, Send, TreePine, Droplets, Mountain, Sword,
  Users, Coins, Flag, Loader2, Wand2, Home, Route, Shield,
} from "lucide-react";
import { useCanvasStore, PALETTE_ITEMS } from "../../stores/canvasStore";
import { useProjectStore } from "../../stores/projectStore";

// ── Quick actions per template ──

interface SubOption {
  label: string;
  prompt: string;
}

interface QuickAction {
  label: string;
  icon: React.ElementType;
  prompt: string;
  color: string;
  subOptions?: SubOption[];
}

function getQuickActions(template: string): QuickAction[] {
  const common: QuickAction[] = [
    { label: "Add Trees", icon: TreePine, prompt: "Add trees and nature", color: "text-emerald-400" },
    { label: "Add Water", icon: Droplets, prompt: "Add water area", color: "text-blue-400" },
  ];

  switch (template) {
    case "obby":
      return [
        { label: "Build Obby Course", icon: Wand2, prompt: "Build a full obby course", color: "text-indigo-400" },
        { label: "Add Stages", icon: Flag, prompt: "Add obby stages with platforms", color: "text-cyan-400", subOptions: [
          { label: "Easy Stage", prompt: "Add an easy stage with wide platforms and short gaps" },
          { label: "Medium Stage", prompt: "Add a medium difficulty stage with moving platforms and small gaps" },
          { label: "Hard Stage", prompt: "Add a hard stage with disappearing platforms, spinners, and kill bricks" },
          { label: "Boss Stage", prompt: "Add a final boss stage with every obstacle type and a victory area" },
        ]},
        { label: "Add Obstacles", icon: Sword, prompt: "Add kill bricks, spinners, and traps", color: "text-red-400", subOptions: [
          { label: "Kill Bricks", prompt: "Add red neon kill bricks that reset the player" },
          { label: "Spinning Bars", prompt: "Add spinning obstacle bars the player must dodge" },
          { label: "Lava Floor", prompt: "Add a lava floor section below platforms" },
          { label: "Moving Walls", prompt: "Add walls that slide back and forth blocking the path" },
          { label: "Disappearing Blocks", prompt: "Add blocks that vanish and reappear on a timer" },
          { label: "Trampolines", prompt: "Add bouncy trampoline pads that launch players upward" },
        ]},
        { label: "Add Checkpoints", icon: Flag, prompt: "Add checkpoints between stages", color: "text-green-400" },
        ...common,
        { label: "Add Collectibles", icon: Coins, prompt: "Add coins along the course", color: "text-yellow-400", subOptions: [
          { label: "Coins", prompt: "Add gold coins scattered along the platforms" },
          { label: "Gems", prompt: "Add rare gems hidden in hard-to-reach spots" },
          { label: "Stars", prompt: "Add stars that give bonus points at the end of each stage" },
        ]},
      ];
    case "tycoon":
      return [
        { label: "Build Tycoon", icon: Wand2, prompt: "Build a full tycoon game", color: "text-indigo-400" },
        { label: "Add Plots", icon: Home, prompt: "Add tycoon plots for players", color: "text-green-400", subOptions: [
          { label: "Starter Plot", prompt: "Add a basic starter plot with a claim button" },
          { label: "Premium Plot", prompt: "Add a premium plot with extra space and upgraded machines" },
          { label: "VIP Plot", prompt: "Add a VIP plot with exclusive machines and a 2x multiplier" },
        ]},
        { label: "Add Machines", icon: Sword, prompt: "Add dropper machines and conveyers", color: "text-orange-400", subOptions: [
          { label: "Ore Dropper", prompt: "Add an ore dropper that produces basic ore every 2 seconds" },
          { label: "Gold Dropper", prompt: "Add a gold dropper that produces high-value gold ore" },
          { label: "Conveyor Belt", prompt: "Add a conveyor belt to transport items to the collector" },
          { label: "Collector", prompt: "Add a collector that converts items into cash" },
          { label: "Furnace", prompt: "Add a furnace that doubles the value of ore before collecting" },
          { label: "Upgrade Button", prompt: "Add an upgrade button that boosts dropper speed" },
        ]},
        { label: "Add Shop", icon: Coins, prompt: "Add a shop building where players buy upgrades", color: "text-yellow-400", subOptions: [
          { label: "Upgrade Shop", prompt: "Add a shop with speed and multiplier upgrades" },
          { label: "Rebirth Shrine", prompt: "Add a rebirth shrine that resets progress for permanent boosts" },
          { label: "Game Pass Shop", prompt: "Add a game pass display with 2x Cash and Auto Collect" },
        ]},
        ...common,
        { label: "Add NPCs", icon: Users, prompt: "Add NPCs and shopkeepers", color: "text-purple-400" },
      ];
    case "simulator":
      return [
        { label: "Build Simulator", icon: Wand2, prompt: "Build a full simulator game", color: "text-indigo-400" },
        { label: "Add Zones", icon: Mountain, prompt: "Add grinding zones with portals between them", color: "text-green-400", subOptions: [
          { label: "Starter Zone", prompt: "Add a starter zone with basic click orbs" },
          { label: "Crystal Caves", prompt: "Add a crystal caves zone with 3x multiplier orbs" },
          { label: "Lava Island", prompt: "Add a volcanic island zone with 10x multiplier orbs" },
          { label: "Zone Portal", prompt: "Add a portal gate that requires coins to unlock the next zone" },
        ]},
        { label: "Add Pets Area", icon: Users, prompt: "Add pets and a pet area", color: "text-pink-400", subOptions: [
          { label: "Egg Hatch Pad", prompt: "Add an egg hatching station with common/rare/legendary chances" },
          { label: "Pet Display", prompt: "Add a pet display showing all discoverable pets" },
          { label: "Trading Plaza", prompt: "Add a trading area where players can trade pets" },
        ]},
        { label: "Add Shop", icon: Home, prompt: "Add a market with stalls", color: "text-yellow-400", subOptions: [
          { label: "Upgrades Shop", prompt: "Add a shop with click power, auto-click, and multiplier upgrades" },
          { label: "Rebirth Shrine", prompt: "Add a rebirth shrine for permanent multiplier boosts" },
          { label: "Codes Board", prompt: "Add a codes redemption board for free rewards" },
        ]},
        ...common,
        { label: "Add Collectibles", icon: Coins, prompt: "Add coins and gems to collect", color: "text-yellow-400" },
      ];
    case "rpg":
      return [
        { label: "Build RPG World", icon: Wand2, prompt: "Build a full RPG world", color: "text-indigo-400" },
        { label: "Add Town", icon: Home, prompt: "Add a town with houses and shops", color: "text-amber-400", subOptions: [
          { label: "Village Houses", prompt: "Add wooden houses and a village square" },
          { label: "Item Shop", prompt: "Add a shop NPC selling swords, armor, and potions" },
          { label: "Quest Board", prompt: "Add a quest board with available missions" },
          { label: "Inn / Heal Point", prompt: "Add a healing fountain or inn to restore HP" },
        ]},
        { label: "Add Dungeon", icon: Mountain, prompt: "Add a cave dungeon with enemies", color: "text-gray-400", subOptions: [
          { label: "Starter Meadow", prompt: "Add a meadow with weak slime enemies for beginners" },
          { label: "Dark Forest", prompt: "Add a dark forest zone with goblins and wolves" },
          { label: "Boss Arena", prompt: "Add a boss arena with a powerful guardian enemy" },
          { label: "Treasure Room", prompt: "Add a treasure room with loot chests after the boss" },
        ]},
        { label: "Add NPCs", icon: Users, prompt: "Add quest NPCs and a boss", color: "text-purple-400", subOptions: [
          { label: "Quest Giver", prompt: "Add a quest NPC with a kill quest for the current zone" },
          { label: "Shopkeeper", prompt: "Add a shopkeeper NPC with items for sale" },
          { label: "Boss Enemy", prompt: "Add a boss enemy with high HP and special attacks" },
          { label: "Slime Spawner", prompt: "Add slime enemy spawn points in the meadow" },
        ]},
        ...common,
        { label: "Add Loot", icon: Coins, prompt: "Add treasure chests and loot", color: "text-yellow-400" },
      ];
    case "horror":
      return [
        { label: "Build Horror Map", icon: Wand2, prompt: "Build a horror game map", color: "text-indigo-400" },
        { label: "Add Buildings", icon: Home, prompt: "Add creepy abandoned buildings", color: "text-gray-400", subOptions: [
          { label: "Mansion Entrance", prompt: "Add a dark mansion entrance hall with locked doors" },
          { label: "Library Room", prompt: "Add a library room with a book puzzle and hidden key" },
          { label: "Basement", prompt: "Add a dark basement with narrow corridors" },
          { label: "Attic", prompt: "Add a creepy attic with storage boxes and a skylight" },
        ]},
        { label: "Add Puzzles", icon: Mountain, prompt: "Add puzzles and locked doors", color: "text-gray-500", subOptions: [
          { label: "Code Lock", prompt: "Add a 4-digit code lock door with a clue note nearby" },
          { label: "Key & Lock", prompt: "Add a locked door with a key hidden in another room" },
          { label: "Lever Puzzle", prompt: "Add levers that must be pulled in the right order" },
        ]},
        { label: "Add Scares", icon: Sword, prompt: "Add horror enemies and traps", color: "text-red-400", subOptions: [
          { label: "Monster", prompt: "Add a patrolling monster that chases players on sight" },
          { label: "Jumpscare", prompt: "Add a jumpscare trigger when opening a specific door" },
          { label: "Flickering Lights", prompt: "Add flickering lights that go dark periodically" },
          { label: "Sound Cues", prompt: "Add ambient horror sounds — footsteps, whispers, creaks" },
        ]},
        ...common,
        { label: "Add Lighting", icon: Flag, prompt: "Add lamps and dark atmosphere", color: "text-yellow-400" },
      ];
    case "racing":
      return [
        { label: "Build Race Track", icon: Wand2, prompt: "Build a full racing game", color: "text-indigo-400" },
        { label: "Add Track", icon: Route, prompt: "Add race track segments", color: "text-gray-400", subOptions: [
          { label: "Straight Section", prompt: "Add a long straight track section with barriers" },
          { label: "Sharp Turn", prompt: "Add a tight hairpin turn with drift marks" },
          { label: "Jump Ramp", prompt: "Add a ramp that launches vehicles over a gap" },
          { label: "Tunnel", prompt: "Add a dark tunnel section through a mountain" },
        ]},
        { label: "Add Vehicles", icon: Sword, prompt: "Add vehicles to the garage", color: "text-orange-400", subOptions: [
          { label: "Starter Kart", prompt: "Add a free starter kart with basic speed" },
          { label: "Sport Car", prompt: "Add a sport car with better speed and handling" },
          { label: "Super Racer", prompt: "Add a super racer with high speed and drift ability" },
          { label: "Monster Truck", prompt: "Add a monster truck that can drive over obstacles" },
        ]},
        { label: "Add Boost Pads", icon: Flag, prompt: "Add speed boost pads", color: "text-cyan-400" },
        ...common,
        { label: "Add Checkpoints", icon: Flag, prompt: "Add race checkpoints", color: "text-green-400" },
      ];
    case "battlegrounds":
      return [
        { label: "Build Arena", icon: Wand2, prompt: "Build a full battlegrounds game", color: "text-indigo-400" },
        { label: "Add Arenas", icon: Shield, prompt: "Add battle arenas", color: "text-red-400", subOptions: [
          { label: "Grassy Plains", prompt: "Add an open grassy arena with a center pillar" },
          { label: "Urban Ruins", prompt: "Add an urban ruins arena with walls and cover" },
          { label: "Lava Pit", prompt: "Add a lava pit arena with crumbling platforms" },
        ]},
        { label: "Add Abilities", icon: Sword, prompt: "Add combat abilities", color: "text-orange-400", subOptions: [
          { label: "Fireball", prompt: "Add a fireball projectile ability with 25 damage" },
          { label: "Ice Shard", prompt: "Add an ice shard ability that slows enemies" },
          { label: "Thunder Strike", prompt: "Add a thunder AoE ability with 40 damage" },
          { label: "Shield Bash", prompt: "Add a shield bash with knockback" },
          { label: "Heal Pulse", prompt: "Add a heal pulse that heals nearby allies" },
        ]},
        { label: "Add Classes", icon: Users, prompt: "Add character classes", color: "text-purple-400", subOptions: [
          { label: "Warrior", prompt: "Add a Warrior class with 150 HP, slow speed, melee attacks" },
          { label: "Mage", prompt: "Add a Mage class with 80 HP, ranged spells" },
          { label: "Healer", prompt: "Add a Healer class with 100 HP, ally healing" },
          { label: "Assassin", prompt: "Add an Assassin class with 75 HP, fast speed, burst damage" },
        ]},
        ...common,
        { label: "Add Loot", icon: Coins, prompt: "Add weapon pickups and health", color: "text-yellow-400" },
      ];
    default:
      return [
        { label: "Build Full Level", icon: Wand2, prompt: "Build a complete game", color: "text-indigo-400" },
        { label: "Add Terrain", icon: Mountain, prompt: "Add terrain and ground", color: "text-green-400" },
        { label: "Add Obstacles", icon: Sword, prompt: "Add obstacles and challenges", color: "text-red-400" },
        { label: "Add NPCs", icon: Users, prompt: "Add characters", color: "text-purple-400" },
        ...common,
        { label: "Add Collectibles", icon: Coins, prompt: "Add coins and gems", color: "text-yellow-400" },
      ];
  }
}

// ── Template-aware AI scene generation ──

function aiGenerateScene(prompt: string, template: string, addElement: (item: any, x: number, y: number) => void): string {
  const lower = prompt.toLowerCase();
  const find = (type: string) => PALETTE_ITEMS.find(p => p.type === type)!;
  const rand = (min: number, max: number) => Math.round((min + Math.random() * (max - min)) / 20) * 20;

  // ── CLEAR
  if (lower.includes("clear") || lower.includes("reset") || lower.includes("start over")) {
    useCanvasStore.getState().clearAll();
    return "Cleared everything! Fresh canvas. What should we build?";
  }

  // ── FULL BUILD (template-specific)
  if (lower.includes("full") || lower.includes("complete") || lower.includes("whole") || lower.includes("build a") || lower.includes("build me")) {
    return buildFullLevel(template, addElement, find, rand);
  }

  // ── Generic add commands (work for any template)
  if (lower.includes("tree") || lower.includes("forest") || lower.includes("nature")) {
    const ct = lower.includes("lot") || lower.includes("forest") ? 10 : 5;
    for (let i = 0; i < ct; i++) addElement(find("tree"), rand(150, 1250), rand(250, 550));
    for (let i = 0; i < 3; i++) addElement(find("bush"), rand(150, 1250), rand(250, 550));
    return `Added ${ct} trees and bushes around the area!`;
  }
  if (lower.includes("water") || lower.includes("lake") || lower.includes("river")) {
    addElement(find("water"), rand(400, 900), rand(350, 450));
    return "Added a water area!";
  }
  if (lower.includes("terrain") || lower.includes("ground")) {
    for (let x = 200; x < 1200; x += 200) addElement(find("grass"), x, rand(380, 480));
    return "Added terrain blocks!";
  }

  // ── Template-specific commands
  if (template === "obby" && (lower.includes("stage") || lower.includes("platform") || lower.includes("obby"))) {
    addElement(find("spawn"), 200, 400);
    for (let i = 0; i < 6; i++) {
      addElement(find(i % 2 === 0 ? "platform" : "moving-platform"), 300 + i * 140, rand(300, 460));
    }
    addElement(find("checkpoint"), 1140, 400);
    return "Added an obby stage with platforms, moving platforms, and a checkpoint at the end!";
  }
  if (template === "obby" && (lower.includes("obstacle") || lower.includes("trap") || lower.includes("kill"))) {
    for (let i = 0; i < 4; i++) addElement(find("killbrick"), rand(300, 1100), rand(300, 480));
    addElement(find("spinner"), rand(400, 900), rand(350, 450));
    addElement(find("laser"), rand(500, 1000), rand(320, 460));
    return "Added kill bricks, a spinner, and a laser! The obby just got harder.";
  }

  if (template === "tycoon" && (lower.includes("plot") || lower.includes("tycoon"))) {
    addElement(find("tycoon-plot"), 400, 400);
    addElement(find("tycoon-plot"), 900, 400);
    return "Added 2 tycoon plots! Players will claim these to start building.";
  }
  if (template === "tycoon" && (lower.includes("machine") || lower.includes("dropper") || lower.includes("conveyor") || lower.includes("production"))) {
    addElement(find("dropper"), rand(300, 600), rand(320, 420));
    addElement(find("conveyor-belt"), rand(400, 700), rand(320, 420));
    addElement(find("collector"), rand(550, 800), rand(320, 420));
    return "Added a production chain: Dropper → Conveyor → Collector!\n\n⚙️ Dropper drops gold ore every 2s (worth $5), conveyor moves it at speed 12, collector sells on contact.";
  }
  if (template === "tycoon" && (lower.includes("upgrade") || lower.includes("button"))) {
    for (let i = 0; i < 3; i++) addElement(find("upgrade-button"), rand(300, 900), rand(380, 460));
    return "Added 3 upgrade buttons! Players step on them to buy upgrades ($500 each).";
  }
  if ((lower.includes("shop") || lower.includes("store") || lower.includes("buy"))) {
    addElement(find("shop-building"), rand(300, 800), rand(300, 450));
    addElement(find("shopkeeper"), rand(350, 750), rand(350, 420));
    return "Added a shop building with a shopkeeper!";
  }

  if (template === "simulator" && (lower.includes("zone") || lower.includes("area"))) {
    addElement(find("portal"), 300, 400);
    addElement(find("portal"), 900, 400);
    for (let i = 0; i < 8; i++) addElement(find("coin"), rand(350, 850), rand(300, 500));
    return "Added zones with portals between them and coins to collect!";
  }
  if (lower.includes("pet")) {
    for (let i = 0; i < 4; i++) addElement(find("pet"), rand(300, 1000), rand(300, 500));
    return "Added pets! They'll follow players around.";
  }
  if (lower.includes("market") || lower.includes("stall")) {
    for (let i = 0; i < 3; i++) addElement(find("market-stall"), rand(300, 900), rand(350, 450));
    return "Added market stalls!";
  }

  if (template === "rpg" && (lower.includes("town") || lower.includes("village") || lower.includes("house"))) {
    addElement(find("house"), 300, 350);
    addElement(find("house"), 550, 300);
    addElement(find("shop-building"), 700, 380);
    addElement(find("npc"), 400, 400);
    addElement(find("shopkeeper"), 750, 420);
    addElement(find("lamp"), 450, 370);
    addElement(find("fence"), 200, 450);
    return "Added a small town with houses, a shop, NPCs, and a fence!";
  }
  if ((lower.includes("cave") || lower.includes("dungeon") || lower.includes("tunnel"))) {
    addElement(find("cave"), rand(400, 900), rand(300, 450));
    addElement(find("enemy"), rand(450, 850), rand(350, 430));
    addElement(find("enemy"), rand(450, 850), rand(350, 430));
    return "Added a cave entrance with enemies inside!";
  }

  if (template === "horror" && (lower.includes("building") || lower.includes("house") || lower.includes("creepy"))) {
    addElement(find("house"), rand(300, 800), rand(300, 450));
    addElement(find("lamp"), rand(350, 750), rand(320, 430));
    return "Added a creepy abandoned building with dim lighting!";
  }

  if (template === "racing" && (lower.includes("track") || lower.includes("road") || lower.includes("race"))) {
    for (let i = 0; i < 5; i++) addElement(find("race-track"), 200 + i * 220, 400);
    addElement(find("boost-pad"), rand(400, 900), 400);
    return "Added race track segments with a boost pad!";
  }

  if (template === "battlegrounds" && (lower.includes("arena") || lower.includes("battle") || lower.includes("fight"))) {
    addElement(find("arena"), 600, 400);
    addElement(find("enemy"), 500, 350);
    addElement(find("enemy"), 700, 450);
    addElement(find("boss"), 600, 300);
    return "Added a battle arena with enemies and a boss!";
  }
  if (lower.includes("wall") || lower.includes("cover") || lower.includes("barrier")) {
    for (let i = 0; i < 4; i++) addElement(find("wall"), rand(300, 1100), rand(300, 500));
    return "Added walls for cover!";
  }

  if (lower.includes("enemy") || lower.includes("npc") || lower.includes("character")) {
    addElement(find("enemy"), rand(300, 1100), rand(300, 500));
    addElement(find("npc"), rand(200, 600), rand(350, 450));
    return "Added an enemy and an NPC!";
  }
  if (lower.includes("boss")) {
    addElement(find("boss"), rand(700, 1100), rand(350, 450));
    return "Added a boss enemy!";
  }
  if (lower.includes("coin") || lower.includes("collect") || lower.includes("gem") || lower.includes("loot") || lower.includes("treasure")) {
    for (let i = 0; i < 8; i++) addElement(find("coin"), rand(200, 1200), rand(280, 500));
    for (let i = 0; i < 3; i++) addElement(find("gem"), rand(300, 1100), rand(300, 480));
    return "Added coins and gems to collect!";
  }
  if (lower.includes("checkpoint") || lower.includes("spawn")) {
    addElement(find("spawn"), rand(150, 300), rand(380, 420));
    addElement(find("checkpoint"), rand(600, 1000), rand(380, 420));
    return "Added a spawn point and checkpoint!";
  }
  if (lower.includes("light") || lower.includes("lamp")) {
    for (let i = 0; i < 4; i++) addElement(find("lamp"), rand(200, 1200), rand(300, 500));
    return "Added lamps for lighting!";
  }
  if (lower.includes("obstacle") || lower.includes("danger")) {
    addElement(find("killbrick"), rand(300, 1100), rand(300, 480));
    addElement(find("spikes"), rand(300, 1100), rand(300, 480));
    return "Added obstacles!";
  }
  if (lower.includes("bridge")) {
    addElement(find("bridge"), rand(400, 900), rand(350, 450));
    return "Added a bridge!";
  }
  if (lower.includes("tower")) {
    addElement(find("tower"), rand(300, 1000), rand(300, 500));
    return "Added a tower!";
  }
  if (lower.includes("portal") || lower.includes("teleport")) {
    addElement(find("portal"), rand(300, 1000), rand(350, 450));
    return "Added a portal!";
  }

  // Default
  addElement(find("tree"), rand(300, 1100), rand(300, 500));
  addElement(find("rock"), rand(300, 1100), rand(300, 500));
  return `I added a couple of things. Try being more specific for your ${template} game — like "add a town", "build stages", or "add enemies"!`;
}

// ── Template-specific full level builders ──

function buildFullLevel(template: string, add: (item: any, x: number, y: number) => void, find: (t: string) => any, rand: (min: number, max: number) => number): string {
  switch (template) {
    case "obby": {
      // Linear obstacle course with stages
      add(find("spawn"), 160, 400);
      for (let stage = 0; stage < 4; stage++) {
        const baseX = 300 + stage * 250;
        for (let p = 0; p < 3; p++) add(find(p === 1 ? "moving-platform" : "platform"), baseX + p * 80, rand(340, 460));
        add(find("killbrick"), baseX + rand(40, 120), rand(360, 440));
        add(find("checkpoint"), baseX + 230, 400);
      }
      add(find("spinner"), rand(600, 900), rand(350, 450));
      add(find("laser"), rand(700, 1000), rand(340, 460));
      for (let i = 0; i < 12; i++) add(find("coin"), rand(200, 1300), rand(300, 500));
      for (let i = 0; i < 6; i++) add(find("tree"), rand(150, 1350), rand(250, 550));
      add(find("lamp"), rand(300, 600), rand(350, 450));
      add(find("lamp"), rand(900, 1200), rand(350, 450));
      return "Built an obby course with 4 stages!\n\n⚙️ Auto-configured logic:\n• Platforms: Anchored, SmoothPlastic material\n• Moving platforms: Move 10 studs at speed 4\n• Kill bricks: Instant death on touch\n• Checkpoints: Auto-save progress per stage\n• Coins: 10 coins each, respawn in 10s\n• Spawn point at the start\n\nUse WASD to fly around and check it out!";
    }
    case "tycoon": {
      // Proper tycoon layout: plot with dropper → conveyor → collector chain
      add(find("spawn"), 200, 400);
      
      // Player Plot 1 with full dropper chain
      add(find("tycoon-plot"), 400, 380);
      add(find("dropper"), 320, 340);          // Dropper drops items
      add(find("conveyor-belt"), 440, 340);     // Conveyor moves items
      add(find("collector"), 560, 340);          // Collector sells items
      add(find("upgrade-button"), 320, 420);    // Upgrade: faster dropper
      add(find("upgrade-button"), 440, 420);    // Upgrade: 2x value
      add(find("upgrade-button"), 560, 420);    // Upgrade: new dropper
      
      // Player Plot 2 with full dropper chain
      add(find("tycoon-plot"), 850, 380);
      add(find("dropper"), 770, 340);
      add(find("conveyor-belt"), 890, 340);
      add(find("collector"), 1010, 340);
      add(find("upgrade-button"), 770, 420);
      add(find("upgrade-button"), 890, 420);
      add(find("upgrade-button"), 1010, 420);
      
      // Central shop
      add(find("shop-building"), 650, 280);
      add(find("shopkeeper"), 680, 320);
      
      // Decoration
      for (let i = 0; i < 4; i++) add(find("tree"), rand(150, 1200), rand(200, 500));
      add(find("lamp"), 250, 380);
      add(find("lamp"), 700, 380);
      add(find("lamp"), 1100, 380);
      
      return "Built a tycoon with 2 player plots, each with a full production chain!\n\n⚙️ Auto-configured logic:\n• Dropper: Drops gold ore every 2 seconds, worth $5 each\n• Conveyor Belt: Speed 12, moves items from dropper to collector\n• Collector (Sell Zone): Sells items on contact, adds cash to player\n• Upgrade Buttons: Faster Dropper ($500), 2x Value ($1000), Diamond Dropper ($2000)\n• Shop sells: Dropper Upgrade ($500), Auto Collector ($1000), New Dropper ($2000), Rebirth ($10000)\n\nThe flow: Dropper drops items → Conveyor moves them → Collector sells them for cash → Use cash to buy upgrades!";
    }
    case "simulator": {
      // Open zones with grinding areas, market, pets
      add(find("spawn"), 200, 400);
      add(find("portal"), 500, 350);
      add(find("portal"), 900, 350);
      for (let i = 0; i < 15; i++) add(find("coin"), rand(200, 1200), rand(280, 520));
      for (let i = 0; i < 5; i++) add(find("gem"), rand(300, 1100), rand(300, 480));
      for (let i = 0; i < 4; i++) add(find("pet"), rand(300, 1000), rand(300, 500));
      add(find("market-stall"), 350, 300);
      add(find("market-stall"), 550, 300);
      add(find("shop-building"), 750, 280);
      add(find("shopkeeper"), 780, 320);
      add(find("npc"), 400, 340);
      for (let i = 0; i < 8; i++) add(find("tree"), rand(150, 1250), rand(200, 550));
      add(find("lamp"), rand(300, 500), rand(350, 450));
      add(find("lamp"), rand(800, 1000), rand(350, 450));
      return "Built a simulator!\n\n⚙️ Auto-configured logic:\n• Portals: Teleport between zones, 2s cooldown\n• Coins: 1 each (fast grind), respawn in 2s\n• Gems: 5 each, respawn in 30s\n• Pets: Follow player, wander AI\n• Market stalls: Sell Apples (5 coins) and Swords (50 coins)\n• Shop sells: Better Backpack ($100), Lucky Charm (50 gems), Auto Farm (500 gems), Pet Egg ($200)";
    }
    case "rpg": {
      // Town, dungeon, NPCs
      add(find("spawn"), 200, 400);
      add(find("house"), 350, 350);
      add(find("house"), 550, 300);
      add(find("house"), 400, 480);
      add(find("shop-building"), 700, 350);
      add(find("shopkeeper"), 730, 390);
      add(find("npc"), 420, 400);
      add(find("npc"), 600, 350);
      add(find("cave"), 1000, 380);
      add(find("enemy"), 950, 350);
      add(find("enemy"), 1050, 420);
      add(find("boss"), 1100, 380);
      add(find("bridge"), 800, 400);
      add(find("tower"), 250, 280);
      for (let i = 0; i < 8; i++) add(find("tree"), rand(150, 1250), rand(200, 550));
      for (let i = 0; i < 6; i++) add(find("coin"), rand(300, 1100), rand(300, 500));
      for (let i = 0; i < 3; i++) add(find("gem"), rand(800, 1150), rand(350, 430));
      add(find("fence"), 200, 500);
      add(find("fence"), 600, 500);
      add(find("lamp"), 300, 380);
      add(find("lamp"), 650, 380);
      add(find("checkpoint"), 700, 400);
      return "Built an RPG world!\n\n⚙️ Auto-configured logic:\n• NPCs: Have quest 'Defeat the Enemies' (reward: 50 coins), 3 dialog lines\n• Shopkeeper sells: Health Potion (25c), Iron Sword (100c), Shield (150c), Mana Potion (30c), Teleport Scroll (50c)\n• Enemies: 50 HP, 10 dmg, chase AI, drop coins (100%) and gems (15%)\n• Boss: 500 HP, 30 dmg, drops Boss Loot Crate (100%) + 100 coins\n• Gems: Worth 50, respawn in 30s";
    }
    case "horror": {
      add(find("spawn"), 200, 400);
      add(find("house"), 400, 350);
      add(find("house"), 700, 300);
      add(find("cave"), 1000, 380);
      add(find("tunnel"), 600, 450);
      add(find("enemy"), rand(500, 900), rand(300, 500));
      add(find("enemy"), rand(500, 900), rand(300, 500));
      add(find("lamp"), 350, 380);
      add(find("lamp"), 650, 400);
      add(find("lamp"), 950, 380);
      for (let i = 0; i < 4; i++) add(find("rock"), rand(200, 1100), rand(300, 500));
      add(find("fence"), 300, 480);
      add(find("wall"), 800, 320);
      return "Built a horror map!\n\n⚙️ Auto-configured logic:\n• Enemies: 30 HP, 10 dmg, chase AI, respawn in 15s\n• Lamps: Range 15 studs, brightness 1\n• Cave: Slate material, walkable interior\n• Buildings: Walkable with door openings";
    }
    case "racing": {
      add(find("spawn"), 200, 400);
      for (let i = 0; i < 6; i++) add(find("race-track"), 200 + i * 180, 400);
      add(find("boost-pad"), 500, 400);
      add(find("boost-pad"), 900, 400);
      add(find("checkpoint"), 400, 400);
      add(find("checkpoint"), 700, 400);
      add(find("checkpoint"), 1000, 400);
      for (let i = 0; i < 6; i++) add(find("tree"), rand(150, 1250), rand(250, 550));
      for (let i = 0; i < 3; i++) add(find("rock"), rand(200, 1200), rand(300, 500));
      add(find("coin"), rand(300, 1100), rand(350, 450));
      return "Built a racing track!\n\n⚙️ Auto-configured logic:\n• Track: SmoothPlastic, anchored\n• Boost pads: Speed 30, push forward\n• Checkpoints: Auto-save lap progress";
    }
    case "battlegrounds": {
      add(find("spawn"), 200, 400);
      add(find("arena"), 600, 380);
      add(find("arena"), 1000, 380);
      for (let i = 0; i < 5; i++) add(find("wall"), rand(350, 1150), rand(300, 500));
      add(find("enemy"), rand(400, 800), rand(320, 460));
      add(find("enemy"), rand(800, 1100), rand(320, 460));
      add(find("boss"), 1000, 350);
      add(find("npc"), 250, 380);
      add(find("shopkeeper"), 300, 420);
      for (let i = 0; i < 6; i++) add(find("coin"), rand(400, 1100), rand(300, 500));
      add(find("lamp"), rand(400, 600), rand(350, 450));
      add(find("lamp"), rand(800, 1000), rand(350, 450));
      return "Built a battlegrounds map!\n\n⚙️ Auto-configured logic:\n• Arena: Walled combat areas\n• Enemies: 30 HP, 10 dmg, chase AI, drop coins + gems\n• Boss: 200 HP, 30 dmg, drops Boss Loot Crate\n• Walls: Concrete material, provide cover\n• Shop sells: Health Pack (50c), Sword (100c), Armor (200c), Speed Boost (75c)";
    }
    default: {
      // Generic
      add(find("spawn"), 200, 400);
      for (let x = 200; x < 1200; x += 200) add(find("grass"), x, rand(400, 480));
      add(find("water"), rand(500, 800), rand(350, 450));
      for (let i = 0; i < 6; i++) add(find("tree"), rand(150, 1250), rand(250, 550));
      add(find("house"), rand(400, 800), rand(300, 420));
      add(find("npc"), rand(300, 700), rand(350, 450));
      add(find("enemy"), rand(600, 1100), rand(300, 500));
      for (let i = 0; i < 6; i++) add(find("coin"), rand(200, 1200), rand(280, 500));
      add(find("checkpoint"), rand(600, 900), rand(380, 420));
      add(find("lamp"), rand(300, 500), rand(350, 450));
      return "Built a game level with terrain, a house, NPCs, enemies, collectibles, and a checkpoint!";
    }
  }
}

// ── Chat message type ──

interface ChatMsg {
  id: number;
  role: "user" | "ai";
  text: string;
}

// ── Template display names ──

const TEMPLATE_NAMES: Record<string, string> = {
  obby: "Obby", tycoon: "Tycoon", simulator: "Simulator", rpg: "RPG",
  horror: "Horror", racing: "Racing", battlegrounds: "Battlegrounds", minigames: "Minigames",
};

// ── Main Component ──

export function AiSceneChat({ projectPath }: { projectPath: string }) {
  const { project } = useProjectStore();
  const template = project?.template || "obby";
  const templateName = TEMPLATE_NAMES[template] || template;
  const quickActions = getQuickActions(template);
  const [expandedAction, setExpandedAction] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: 0, role: "ai", text: `Hey! I'm building your **${templateName}** game. Hit the top button to auto-build the whole thing, or tell me what you want and I'll add it!` },
  ]);
  const [input, setInput] = useState("");
  const [isBuilding, setIsBuilding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { addElement } = useCanvasStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMsg = { id: Date.now(), role: "user", text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsBuilding(true);

    await new Promise(r => setTimeout(r, 600 + Math.random() * 800));

    const response = aiGenerateScene(text, template, addElement);
    const aiMsg: ChatMsg = { id: Date.now() + 1, role: "ai", text: response };
    setMessages(prev => [...prev, aiMsg]);
    setIsBuilding(false);
  };

  const handleQuickAction = (action: QuickAction) => {
    handleSend(action.prompt);
  };

  return (
    <div className="flex h-full w-[340px] flex-col border-l border-gray-800/40 bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
            <Sparkles size={14} className="text-white" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-white">{templateName} Builder</p>
            <p className="text-[10px] text-gray-500">AI builds your {templateName.toLowerCase()} game</p>
          </div>
        </div>
      </div>

      {/* Quick actions — template-specific */}
      <div className="border-b border-gray-800/40 p-3">
        <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Quick Build — {templateName}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const isExpanded = expandedAction === action.label;
            return (
              <div key={action.label} className={action.subOptions ? "col-span-2" : ""}>
                <button
                  onClick={() => {
                    if (action.subOptions) {
                      setExpandedAction(isExpanded ? null : action.label);
                    } else {
                      handleQuickAction(action);
                    }
                  }}
                  disabled={isBuilding}
                  className={`flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left text-[11px] font-medium transition-colors disabled:opacity-50 ${
                    isExpanded
                      ? "border-gray-700 bg-gray-800/50 text-white"
                      : "border-gray-800/40 bg-gray-800/20 text-gray-300 hover:border-gray-700 hover:bg-gray-800/40"
                  }`}
                >
                  <Icon size={13} className={action.color} />
                  {action.label}
                  {action.subOptions && (
                    <span className={`ml-auto text-[9px] text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                      ▸
                    </span>
                  )}
                </button>
                {isExpanded && action.subOptions && (
                  <div className="mt-1 grid grid-cols-2 gap-1 pl-2">
                    {action.subOptions.map((sub) => (
                      <button
                        key={sub.label}
                        onClick={() => {
                          handleQuickAction({ ...action, prompt: sub.prompt, label: sub.label });
                          setExpandedAction(null);
                        }}
                        disabled={isBuilding}
                        className="rounded-md border border-gray-800/30 bg-gray-900/50 px-2 py-1.5 text-left text-[10px] text-gray-400 hover:border-gray-700 hover:bg-gray-800/40 hover:text-gray-200 disabled:opacity-50 transition-colors"
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
              msg.role === "user"
                ? "bg-indigo-600 text-white"
                : "bg-gray-800/60 text-gray-200 border border-gray-700/30"
            }`}>
              {msg.role === "ai" && (
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles size={11} className="text-indigo-400" />
                  <span className="text-[10px] font-bold text-indigo-400">AI Builder</span>
                </div>
              )}
              {msg.text}
            </div>
          </div>
        ))}
        {isBuilding && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-xl bg-gray-800/60 px-3.5 py-2.5 text-[13px] text-gray-400 border border-gray-700/30">
              <Loader2 size={14} className="animate-spin text-indigo-400" />
              Building your game...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800/40 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(input); } }}
            placeholder="Tell me what to build..."
            disabled={isBuilding}
            className="flex-1 rounded-xl border border-gray-700/50 bg-gray-800/60 px-4 py-2.5 text-[13px] text-white placeholder-gray-500 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 disabled:opacity-50"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={!input.trim() || isBuilding}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="mt-2 text-center text-[10px] text-gray-600">
          Try: "Build me a full level" or "Add a forest with a lake"
        </p>
      </div>
    </div>
  );
}
