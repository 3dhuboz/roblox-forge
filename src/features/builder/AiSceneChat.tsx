import { useState, useRef, useEffect } from "react";
import {
  Sparkles, Send, TreePine, Droplets, Mountain, Sword,
  Users, Coins, Flag, Loader2, Wand2, Palette, Map,
} from "lucide-react";
import { useCanvasStore, PALETTE_ITEMS } from "../../stores/canvasStore";

// ── Quick action buttons that AI-generate scene content ──

interface QuickAction {
  label: string;
  icon: React.ElementType;
  prompt: string;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Add Terrain", icon: Mountain, prompt: "Create a varied terrain with hills, flat areas, and some elevation changes", color: "text-green-400" },
  { label: "Add Water", icon: Droplets, prompt: "Add a lake or river with water", color: "text-blue-400" },
  { label: "Add Trees", icon: TreePine, prompt: "Scatter some trees and bushes around the landscape", color: "text-emerald-400" },
  { label: "Add Obstacles", icon: Sword, prompt: "Add some obstacles like kill bricks, spinners, and spikes", color: "text-red-400" },
  { label: "Add NPCs", icon: Users, prompt: "Add some characters — enemies, NPCs, and a shopkeeper", color: "text-purple-400" },
  { label: "Add Collectibles", icon: Coins, prompt: "Scatter coins and gems around the level for players to collect", color: "text-yellow-400" },
  { label: "Add Checkpoints", icon: Flag, prompt: "Add checkpoint flags and a spawn point", color: "text-cyan-400" },
  { label: "Build Full Level", icon: Wand2, prompt: "Build me a complete game level with terrain, obstacles, enemies, collectibles, and checkpoints", color: "text-indigo-400" },
];

// ── AI scene generation (mock — interprets prompts and adds elements) ──

function aiGenerateScene(prompt: string, addElement: (item: any, x: number, y: number) => void): string {
  const lower = prompt.toLowerCase();
  const find = (type: string) => PALETTE_ITEMS.find(p => p.type === type)!;

  const rand = (min: number, max: number) => Math.round((min + Math.random() * (max - min)) / 20) * 20;

  if (lower.includes("full level") || lower.includes("complete") || lower.includes("whole game") || lower.includes("everything")) {
    // Build a complete level
    // Ground
    for (let x = 200; x < 1200; x += 200) {
      addElement(find("grass"), x, rand(400, 500));
    }
    // Water
    addElement(find("water"), rand(500, 800), rand(350, 450));
    // Trees
    for (let i = 0; i < 8; i++) addElement(find("tree"), rand(150, 1250), rand(250, 550));
    // Bushes
    for (let i = 0; i < 5; i++) addElement(find("bush"), rand(150, 1250), rand(250, 550));
    // Rocks
    for (let i = 0; i < 4; i++) addElement(find("rock"), rand(200, 1200), rand(300, 500));
    // Platforms
    for (let i = 0; i < 5; i++) addElement(find("platform"), rand(200, 1200), rand(280, 480));
    // Obstacles
    addElement(find("killbrick"), rand(400, 1000), rand(300, 450));
    addElement(find("spikes"), rand(400, 1000), rand(300, 450));
    addElement(find("spinner"), rand(400, 1000), rand(300, 450));
    // Characters
    addElement(find("enemy"), rand(300, 1100), rand(300, 500));
    addElement(find("enemy"), rand(300, 1100), rand(300, 500));
    addElement(find("npc"), rand(200, 600), rand(350, 450));
    addElement(find("shopkeeper"), rand(200, 500), rand(350, 450));
    addElement(find("boss"), rand(900, 1200), rand(350, 450));
    // Collectibles
    for (let i = 0; i < 8; i++) addElement(find("coin"), rand(200, 1200), rand(280, 500));
    for (let i = 0; i < 3; i++) addElement(find("gem"), rand(300, 1100), rand(300, 480));
    // Mechanics
    addElement(find("spawn"), rand(150, 300), rand(380, 420));
    addElement(find("checkpoint"), rand(600, 700), rand(380, 420));
    addElement(find("checkpoint"), rand(900, 1000), rand(380, 420));
    // Lamps
    addElement(find("lamp"), rand(200, 500), rand(350, 450));
    addElement(find("lamp"), rand(800, 1100), rand(350, 450));
    return "I built a complete level for you! It has terrain, water, trees, platforms, obstacles, enemies, NPCs, collectibles, checkpoints, and lamps. You can click on any object in the 3D view to select it, or tell me to change anything.";
  }

  if (lower.includes("terrain") || lower.includes("ground") || lower.includes("hill")) {
    for (let x = 200; x < 1200; x += rand(150, 250)) {
      addElement(find("grass"), x, rand(380, 480));
    }
    addElement(find("sand"), rand(300, 600), rand(400, 500));
    for (let i = 0; i < 3; i++) addElement(find("rock"), rand(200, 1200), rand(300, 500));
    return "Added varied terrain with grass, sand, and rocks. Want me to add trees or obstacles too?";
  }

  if (lower.includes("water") || lower.includes("lake") || lower.includes("river") || lower.includes("ocean")) {
    addElement(find("water"), rand(400, 900), rand(350, 450));
    addElement(find("water"), rand(400, 900), rand(370, 470));
    return "Added a water area! Players will be able to swim in it. Want me to add anything around the water?";
  }

  if (lower.includes("tree") || lower.includes("forest") || lower.includes("bush") || lower.includes("plant")) {
    const count = lower.includes("lot") || lower.includes("many") || lower.includes("forest") ? 12 : 6;
    for (let i = 0; i < count; i++) addElement(find("tree"), rand(150, 1250), rand(250, 550));
    for (let i = 0; i < Math.ceil(count / 2); i++) addElement(find("bush"), rand(150, 1250), rand(250, 550));
    return `Added ${count} trees and some bushes! The landscape is looking more natural now.`;
  }

  if (lower.includes("obstacle") || lower.includes("danger") || lower.includes("hard") || lower.includes("challenge")) {
    addElement(find("killbrick"), rand(300, 1100), rand(300, 480));
    addElement(find("killbrick"), rand(300, 1100), rand(300, 480));
    addElement(find("spikes"), rand(300, 1100), rand(300, 480));
    addElement(find("spinner"), rand(300, 1100), rand(300, 480));
    addElement(find("laser"), rand(300, 1100), rand(300, 480));
    return "Added obstacles: kill bricks, spikes, a spinner, and a laser. That should make things challenging! Want more or less?";
  }

  if (lower.includes("enemy") || lower.includes("npc") || lower.includes("character") || lower.includes("mob")) {
    addElement(find("enemy"), rand(300, 1100), rand(300, 500));
    addElement(find("enemy"), rand(300, 1100), rand(300, 500));
    addElement(find("npc"), rand(200, 600), rand(350, 450));
    addElement(find("shopkeeper"), rand(200, 500), rand(350, 450));
    if (lower.includes("boss")) addElement(find("boss"), rand(900, 1200), rand(350, 450));
    return "Added characters! There are enemies to fight, an NPC for quests, and a shopkeeper. Want me to add a boss?";
  }

  if (lower.includes("coin") || lower.includes("collect") || lower.includes("gem") || lower.includes("pickup")) {
    for (let i = 0; i < 10; i++) addElement(find("coin"), rand(200, 1200), rand(280, 500));
    for (let i = 0; i < 4; i++) addElement(find("gem"), rand(300, 1100), rand(300, 480));
    return "Scattered coins and gems around the level! Players will love collecting these.";
  }

  if (lower.includes("checkpoint") || lower.includes("spawn") || lower.includes("save")) {
    addElement(find("spawn"), rand(150, 300), rand(380, 420));
    addElement(find("checkpoint"), rand(500, 700), rand(380, 420));
    addElement(find("checkpoint"), rand(800, 1100), rand(380, 420));
    return "Added a spawn point and two checkpoints. Players will respawn at the last checkpoint they reached.";
  }

  if (lower.includes("platform") || lower.includes("jump") || lower.includes("obby")) {
    for (let i = 0; i < 6; i++) {
      const type = i % 3 === 0 ? "moving-platform" : i % 3 === 1 ? "bouncy" : "platform";
      addElement(find(type), rand(200, 1200), rand(280, 480));
    }
    return "Added platforms including some moving and bouncy ones! Great for an obby-style section.";
  }

  if (lower.includes("light") || lower.includes("lamp") || lower.includes("dark") || lower.includes("night")) {
    for (let i = 0; i < 5; i++) addElement(find("lamp"), rand(200, 1200), rand(300, 500));
    return "Added lamps around the level. They'll light up the area!";
  }

  if (lower.includes("clear") || lower.includes("reset") || lower.includes("start over") || lower.includes("remove all")) {
    useCanvasStore.getState().clearAll();
    return "Cleared everything! Fresh canvas ready to go. What should we build?";
  }

  // Default: try to add whatever they asked for
  addElement(find("platform"), rand(400, 1000), rand(350, 450));
  addElement(find("tree"), rand(300, 1100), rand(300, 500));
  return `I added some elements based on your request. Try being more specific — like "add a forest", "create obstacles", or "build a full level"!`;
}

// ── Chat message type ──

interface ChatMsg {
  id: number;
  role: "user" | "ai";
  text: string;
}

// ── Main Component ──

export function AiSceneChat({ projectPath }: { projectPath: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: 0, role: "ai", text: "Hey! I'm your AI game builder. Tell me what you want in your game and I'll create it for you — or use the quick buttons below to get started!" },
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

    // Simulate AI thinking delay
    await new Promise(r => setTimeout(r, 600 + Math.random() * 800));

    const response = aiGenerateScene(text, addElement);
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
            <p className="text-[13px] font-bold text-white">AI Builder</p>
            <p className="text-[10px] text-gray-500">Tell me what to build</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="border-b border-gray-800/40 p-3">
        <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Quick Build</p>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action)}
                disabled={isBuilding}
                className="flex items-center gap-1.5 rounded-lg border border-gray-800/40 bg-gray-800/20 px-2.5 py-2 text-left text-[11px] font-medium text-gray-300 hover:border-gray-700 hover:bg-gray-800/40 disabled:opacity-50 transition-colors"
              >
                <Icon size={13} className={action.color} />
                {action.label}
              </button>
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
