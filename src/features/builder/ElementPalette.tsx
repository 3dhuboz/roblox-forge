import { useState } from "react";
import {
  Square, Trees, Droplets, Flame, Sun, Snowflake,
  Minus, MoveHorizontal, EyeOff, ArrowUp, ArrowRight,
  Skull, RotateCw, Zap, Triangle,
  Ghost, Heart, User, Crown, ShoppingBag,
  TreePine, Mountain, Lamp, Leaf, GripHorizontal,
  Flag, ChevronRight, Coins, Diamond, UserPlus,
  Search, ChevronDown,
} from "lucide-react";
import { useCanvasStore, PALETTE_ITEMS, type PaletteItem, type ElementCategory } from "../../stores/canvasStore";

const ICON_MAP: Record<string, React.ElementType> = {
  "square": Square, "trees": Trees, "droplets": Droplets, "flame": Flame,
  "sun": Sun, "snowflake": Snowflake, "minus": Minus, "move-horizontal": MoveHorizontal,
  "eye-off": EyeOff, "arrow-up": ArrowUp, "arrow-right": ArrowRight,
  "skull": Skull, "rotate-cw": RotateCw, "zap": Zap, "triangle": Triangle,
  "ghost": Ghost, "heart": Heart, "user": User, "crown": Crown,
  "shopping-bag": ShoppingBag, "tree-pine": TreePine, "mountain": Mountain,
  "lamp": Lamp, "leaf": Leaf, "grip-horizontal": GripHorizontal,
  "flag": Flag, "chevrons-right": ChevronRight, "coins": Coins,
  "diamond": Diamond, "user-plus": UserPlus,
};

const CATEGORY_INFO: Record<ElementCategory, { label: string; color: string }> = {
  terrain: { label: "Terrain", color: "text-emerald-400" },
  platform: { label: "Platforms", color: "text-indigo-400" },
  obstacle: { label: "Obstacles", color: "text-red-400" },
  character: { label: "Characters", color: "text-pink-400" },
  decoration: { label: "Decorations", color: "text-yellow-400" },
  mechanic: { label: "Mechanics", color: "text-cyan-400" },
};

const CATEGORIES: ElementCategory[] = ["terrain", "platform", "obstacle", "character", "decoration", "mechanic"];

function PaletteItemCard({ item }: { item: PaletteItem }) {
  const { setPlacingItem, placingItem } = useCanvasStore();
  const Icon = ICON_MAP[item.icon] || Square;
  const isActive = placingItem?.type === item.type;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/palette-item", JSON.stringify(item));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <button
      draggable
      onDragStart={handleDragStart}
      onClick={() => setPlacingItem(isActive ? null : item)}
      className={`group flex items-center gap-2.5 rounded-lg border p-2 text-left transition-all ${
        isActive
          ? "border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500/30"
          : "border-gray-800/40 bg-gray-800/20 hover:border-gray-700 hover:bg-gray-800/40"
      }`}
      title={item.description}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: item.color + "30", color: item.color }}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-gray-200 truncate">{item.label}</p>
        <p className="text-[10px] text-gray-500 truncate">{item.description}</p>
      </div>
    </button>
  );
}

export function ElementPalette() {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = search.trim()
    ? PALETTE_ITEMS.filter(
        (i) =>
          i.label.toLowerCase().includes(search.toLowerCase()) ||
          i.description.toLowerCase().includes(search.toLowerCase())
      )
    : PALETTE_ITEMS;

  const toggleCategory = (cat: string) => {
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <div className="flex h-full w-[220px] flex-col border-r border-gray-800/40 bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800/40 px-3 py-2.5">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Toolbox</p>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search parts..."
            className="w-full rounded-lg border border-gray-800/50 bg-gray-900/60 pl-8 pr-3 py-1.5 text-[12px] text-white placeholder-gray-600 outline-none focus:border-indigo-500/40"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {CATEGORIES.map((cat) => {
          const info = CATEGORY_INFO[cat];
          const items = filtered.filter((i) => i.category === cat);
          if (items.length === 0) return null;
          const isCollapsed = collapsed[cat];

          return (
            <div key={cat} className="mb-1">
              <button
                onClick={() => toggleCategory(cat)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left hover:bg-gray-800/30"
              >
                <ChevronDown
                  size={12}
                  className={`text-gray-500 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                />
                <span className={`text-[11px] font-bold ${info.color}`}>{info.label}</span>
                <span className="text-[10px] text-gray-600">{items.length}</span>
              </button>
              {!isCollapsed && (
                <div className="mt-0.5 space-y-1 px-1">
                  {items.map((item) => (
                    <PaletteItemCard key={item.type} item={item} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Drag hint */}
      <div className="border-t border-gray-800/40 px-3 py-2">
        <p className="text-[10px] text-gray-600 text-center">
          Click to place or drag onto canvas
        </p>
      </div>
    </div>
  );
}
