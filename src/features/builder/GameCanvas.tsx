import { useRef, useCallback, useState, useEffect } from "react";
import {
  Square, Trees, Droplets, Flame, Sun, Snowflake,
  Minus, MoveHorizontal, EyeOff, ArrowUp, ArrowRight,
  Skull, RotateCw, Zap, Triangle,
  Ghost, Heart, User, Crown, ShoppingBag,
  TreePine, Mountain, Lamp, Leaf, GripHorizontal,
  Flag, ChevronRight, Coins, Diamond, UserPlus,
} from "lucide-react";
import { useCanvasStore, type CanvasElement, type PaletteItem } from "../../stores/canvasStore";

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

const CANVAS_W = 2400;
const CANVAS_H = 900;
const GRID_SIZE = 10;

// ── Rendered Element on Canvas ──

function CanvasItem({ el }: { el: CanvasElement }) {
  const { selectedId, selectElement, tool, moveElement, removeElement } = useCanvasStore();
  const isSelected = selectedId === el.id;
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const Icon = ICON_MAP[el.icon] || Square;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (tool === "delete") {
      removeElement(el.id);
      return;
    }

    selectElement(el.id);

    if (tool === "select" || tool === "move") {
      setDragging(true);
      dragOffset.current = {
        x: e.clientX - el.x,
        y: e.clientY - el.y,
      };
    }
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      moveElement(el.id, e.clientX - dragOffset.current.x, e.clientY - dragOffset.current.y);
    };

    const handleUp = () => {
      setDragging(false);
      // Save undo state on drop
      const { elements, undoStack } = useCanvasStore.getState();
      useCanvasStore.setState({ undoStack: [...undoStack, elements], redoStack: [] });
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, el.id, moveElement]);

  // Visual shape based on category
  const getBorderRadius = () => {
    if (el.category === "character") return "50%";
    if (el.type === "coin" || el.type === "gem") return "50%";
    if (el.type === "tree") return "30% 30% 4px 4px";
    if (el.category === "terrain") return "4px";
    return "6px";
  };

  // Special visual patterns
  const getPattern = () => {
    if (el.type === "water") return "repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.08) 8px, rgba(255,255,255,0.08) 10px)";
    if (el.type === "lava") return "repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(255,200,0,0.2) 6px, rgba(255,200,0,0.2) 8px)";
    if (el.type === "ice") return "repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 6px)";
    if (el.type === "grass") return "repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(100,200,100,0.15) 10px, rgba(100,200,100,0.15) 12px)";
    if (el.type === "conveyor") return "repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 14px)";
    return "none";
  };

  return (
    <div
      className={`absolute transition-shadow duration-100 ${dragging ? "cursor-grabbing z-50" : "cursor-pointer"} ${
        tool === "delete" ? "cursor-crosshair hover:opacity-50" : ""
      }`}
      style={{
        left: `${el.x}px`,
        top: `${el.y}px`,
        width: `${el.width}px`,
        height: `${el.height}px`,
        backgroundColor: el.color,
        backgroundImage: getPattern(),
        borderRadius: getBorderRadius(),
        opacity: el.visible ? (el.type === "water" ? 0.7 : 0.9) : 0.3,
        border: isSelected
          ? "2px solid #818cf8"
          : `1px solid ${el.color}88`,
        boxShadow: isSelected
          ? "0 0 0 3px rgba(129,140,248,0.25), 0 4px 12px rgba(0,0,0,0.4)"
          : dragging
            ? "0 8px 24px rgba(0,0,0,0.5)"
            : "0 2px 6px rgba(0,0,0,0.3)",
        transform: dragging ? "scale(1.02)" : "scale(1)",
        zIndex: isSelected ? 40 : dragging ? 50 : 10,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Icon centered */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Icon
          size={Math.min(el.width * 0.5, el.height * 0.6, 20)}
          className="text-white/60"
        />
      </div>

      {/* Label on hover or selected */}
      {isSelected && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-7 whitespace-nowrap rounded-md bg-gray-900 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg border border-gray-700/50 pointer-events-none z-50">
          {el.label}
        </div>
      )}

      {/* Resize handles when selected */}
      {isSelected && !dragging && (
        <>
          <div className="absolute -right-1.5 -bottom-1.5 h-3 w-3 rounded-full bg-indigo-500 border-2 border-gray-900 cursor-se-resize z-50" />
          <div className="absolute -left-1.5 -bottom-1.5 h-3 w-3 rounded-full bg-indigo-500 border-2 border-gray-900 cursor-sw-resize z-50" />
        </>
      )}
    </div>
  );
}

// ── Main Canvas ──

export function GameCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const {
    elements,
    tool,
    placingItem,
    addElement,
    selectElement,
    setPlacingItem,
    setTool,
    zoom,
  } = useCanvasStore();

  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);

  // Handle click on empty canvas
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      if (tool === "place" && placingItem) {
        addElement(placingItem, x - placingItem.defaultWidth / 2, y - placingItem.defaultHeight / 2);
        // Keep placing mode active for multiple placements
        return;
      }

      // Deselect if clicking empty space
      selectElement(null);
    },
    [tool, placingItem, addElement, selectElement, zoom]
  );

  // Handle drag-and-drop from palette
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const data = e.dataTransfer.getData("application/palette-item");
      if (!data || !canvasRef.current) return;

      const item: PaletteItem = JSON.parse(data);
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom - item.defaultWidth / 2;
      const y = (e.clientY - rect.top) / zoom - item.defaultHeight / 2;
      addElement(item, x, y);
      setTool("select");
      setPlacingItem(null);
    },
    [addElement, setTool, setPlacingItem, zoom]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  // Ghost cursor for placement mode
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (tool !== "place" || !placingItem || !canvasRef.current) {
        setGhostPos(null);
        return;
      }
      const rect = canvasRef.current.getBoundingClientRect();
      const gx = Math.round(((e.clientX - rect.left) / zoom - placingItem.defaultWidth / 2) / GRID_SIZE) * GRID_SIZE;
      const gy = Math.round(((e.clientY - rect.top) / zoom - placingItem.defaultHeight / 2) / GRID_SIZE) * GRID_SIZE;
      setGhostPos({ x: gx, y: gy });
    },
    [tool, placingItem, zoom]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPlacingItem(null);
        setTool("select");
        selectElement(null);
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedId, removeElement: remove } = useCanvasStore.getState();
        if (selectedId) remove(selectedId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setPlacingItem, setTool, selectElement]);

  return (
    <div className="relative flex-1 overflow-auto bg-gray-900">
      <div
        ref={canvasRef}
        className={`relative ${
          tool === "place" ? "cursor-crosshair" : tool === "delete" ? "cursor-crosshair" : "cursor-default"
        }`}
        style={{
          width: `${CANVAS_W}px`,
          height: `${CANVAS_H}px`,
          transform: `scale(${zoom})`,
          transformOrigin: "0 0",
        }}
        onClick={handleCanvasClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setGhostPos(null)}
      >
        {/* Sky gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-slate-900 to-gray-950" />

        {/* Grid */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="smallGrid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
            </pattern>
            <pattern id="bigGrid" width={GRID_SIZE * 10} height={GRID_SIZE * 10} patternUnits="userSpaceOnUse">
              <rect width={GRID_SIZE * 10} height={GRID_SIZE * 10} fill="url(#smallGrid)" />
              <path d={`M ${GRID_SIZE * 10} 0 L 0 0 0 ${GRID_SIZE * 10}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bigGrid)" />
        </svg>

        {/* Ground reference line */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-green-800/40"
          style={{ top: `${CANVAS_H - 100}px` }}
        >
          <span className="absolute -top-4 left-2 text-[9px] text-green-700/60 font-mono">
            ground level
          </span>
        </div>

        {/* Render all placed elements */}
        {elements.map((el) => (
          <CanvasItem key={el.id} el={el} />
        ))}

        {/* Ghost preview when placing */}
        {ghostPos && placingItem && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${ghostPos.x}px`,
              top: `${ghostPos.y}px`,
              width: `${placingItem.defaultWidth}px`,
              height: `${placingItem.defaultHeight}px`,
              backgroundColor: placingItem.color,
              opacity: 0.4,
              borderRadius: "6px",
              border: "2px dashed rgba(255,255,255,0.3)",
            }}
          />
        )}

        {/* Empty state */}
        {elements.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-600">Drag parts here to build your game</p>
              <p className="mt-1 text-sm text-gray-700">
                Pick from the Toolbox on the left, or click a part then click here to place it
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
