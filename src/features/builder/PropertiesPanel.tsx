import {
  Square, Trees, Droplets, Flame, Sun, Snowflake,
  Minus, MoveHorizontal, EyeOff, ArrowUp, ArrowRight,
  Skull, RotateCw, Zap, Triangle,
  Ghost, Heart, User, Crown, ShoppingBag,
  TreePine, Mountain, Lamp, Leaf, GripHorizontal,
  Flag, ChevronRight, Coins, Diamond, UserPlus,
  Trash2, Copy, Lock, Unlock, Eye, EyeOffIcon,
} from "lucide-react";
import { useCanvasStore } from "../../stores/canvasStore";

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

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f472b6",
  "#4a5568", "#6b7280", "#9ca3af", "#d4a574", "#92400e",
];

export function PropertiesPanel() {
  const { elements, selectedId, updateElement, removeElement, duplicateElement } = useCanvasStore();
  const el = elements.find((e) => e.id === selectedId);

  if (!el) {
    return (
      <div className="flex h-full w-[220px] flex-col border-l border-gray-800/40 bg-gray-950">
        <div className="border-b border-gray-800/40 px-3 py-2.5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Properties</p>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-center text-[12px] text-gray-600">
            Select a part to edit its properties
          </p>
        </div>
      </div>
    );
  }

  const Icon = ICON_MAP[el.icon] || Square;

  return (
    <div className="flex h-full w-[220px] flex-col border-l border-gray-800/40 bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800/40 px-3 py-2.5">
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Properties</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Element identity */}
        <div className="flex items-center gap-2.5 rounded-lg bg-gray-800/40 p-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: el.color + "40", color: el.color }}
          >
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={el.label}
              onChange={(e) => updateElement(el.id, { label: e.target.value })}
              className="w-full bg-transparent text-[13px] font-bold text-white outline-none"
            />
            <p className="text-[10px] text-gray-500 capitalize">{el.category}</p>
          </div>
        </div>

        {/* Position */}
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">Position</p>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[10px] text-gray-600">X</label>
              <input
                type="number"
                value={Math.round(el.x)}
                onChange={(e) => updateElement(el.id, { x: Number(e.target.value) })}
                className="w-full rounded-md border border-gray-800/50 bg-gray-900/60 px-2 py-1 text-[12px] text-white outline-none focus:border-indigo-500/40"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-600">Y</label>
              <input
                type="number"
                value={Math.round(el.y)}
                onChange={(e) => updateElement(el.id, { y: Number(e.target.value) })}
                className="w-full rounded-md border border-gray-800/50 bg-gray-900/60 px-2 py-1 text-[12px] text-white outline-none focus:border-indigo-500/40"
              />
            </div>
          </div>
        </div>

        {/* Size */}
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">Size</p>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="text-[10px] text-gray-600">Width</label>
              <input
                type="number"
                value={el.width}
                onChange={(e) => updateElement(el.id, { width: Math.max(8, Number(e.target.value)) })}
                className="w-full rounded-md border border-gray-800/50 bg-gray-900/60 px-2 py-1 text-[12px] text-white outline-none focus:border-indigo-500/40"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-600">Height</label>
              <input
                type="number"
                value={el.height}
                onChange={(e) => updateElement(el.id, { height: Math.max(4, Number(e.target.value)) })}
                className="w-full rounded-md border border-gray-800/50 bg-gray-900/60 px-2 py-1 text-[12px] text-white outline-none focus:border-indigo-500/40"
              />
            </div>
          </div>
        </div>

        {/* Color */}
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">Color</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => updateElement(el.id, { color: c })}
                className={`h-5 w-5 rounded ${el.color === c ? "ring-2 ring-white ring-offset-1 ring-offset-gray-950" : ""}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <input
            type="color"
            value={el.color}
            onChange={(e) => updateElement(el.id, { color: e.target.value })}
            className="mt-1.5 h-7 w-full cursor-pointer rounded border border-gray-800/50"
          />
        </div>

        {/* Rotation */}
        <div>
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">Rotation</p>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={360}
              value={el.rotation}
              onChange={(e) => updateElement(el.id, { rotation: Number(e.target.value) })}
              className="flex-1"
            />
            <span className="text-[11px] text-gray-400 w-8 text-right">{el.rotation}°</span>
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-1.5">
          <button
            onClick={() => updateElement(el.id, { locked: !el.locked })}
            className="flex w-full items-center gap-2 rounded-lg bg-gray-800/30 px-2.5 py-2 text-left hover:bg-gray-800/50"
          >
            {el.locked ? <Lock size={13} className="text-yellow-400" /> : <Unlock size={13} className="text-gray-500" />}
            <span className="text-[11px] text-gray-300">{el.locked ? "Locked" : "Unlocked"}</span>
          </button>
          <button
            onClick={() => updateElement(el.id, { visible: !el.visible })}
            className="flex w-full items-center gap-2 rounded-lg bg-gray-800/30 px-2.5 py-2 text-left hover:bg-gray-800/50"
          >
            {el.visible ? <Eye size={13} className="text-gray-500" /> : <EyeOffIcon size={13} className="text-gray-500" />}
            <span className="text-[11px] text-gray-300">{el.visible ? "Visible" : "Hidden"}</span>
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-gray-800/40 p-2 flex gap-1.5">
        <button
          onClick={() => duplicateElement(el.id)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-800/50 py-2 text-[11px] text-gray-300 hover:bg-gray-800"
        >
          <Copy size={12} /> Duplicate
        </button>
        <button
          onClick={() => removeElement(el.id)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-950/30 py-2 text-[11px] text-red-400 hover:bg-red-950/50"
        >
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  );
}
