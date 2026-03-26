import { useRef, useCallback, useState, useEffect } from "react";
import { useCanvasStore, type CanvasElement, type PaletteItem } from "../../stores/canvasStore";

const PLANE_W = 1400;
const PLANE_H = 700;
const GRID = 20;

// ── Simple CSS 3D-look element (reliable positioning) ──

function getElementStyle(el: CanvasElement): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: "4px",
    borderTop: "2px solid rgba(255,255,255,0.25)",
    borderLeft: "1px solid rgba(255,255,255,0.1)",
    borderRight: "2px solid rgba(0,0,0,0.15)",
    borderBottom: "3px solid rgba(0,0,0,0.25)",
    boxShadow: "2px 3px 6px rgba(0,0,0,0.35)",
  };

  switch (el.type) {
    case "ground":
    case "grass":
      return { ...base, background: `linear-gradient(180deg, #4ade80 0%, #22c55e 15%, #8B6914 16%, #6b4f12 100%)`, borderRadius: "3px" };
    case "water":
      return { ...base, background: `linear-gradient(180deg, #60a5fa 0%, #3b82f6 40%, #1d4ed8 100%)`, opacity: 0.85, borderRadius: "3px",
        backgroundImage: `linear-gradient(180deg, #60a5fa 0%, #3b82f6 40%, #1d4ed8 100%), repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(255,255,255,0.08) 10px, rgba(255,255,255,0.08) 12px)` };
    case "lava":
      return { ...base, background: `linear-gradient(180deg, #fb923c 0%, #ef4444 40%, #991b1b 100%)`, boxShadow: "2px 3px 6px rgba(0,0,0,0.35), 0 0 12px rgba(239,68,68,0.3)" };
    case "sand":
      return { ...base, background: `linear-gradient(180deg, #e8c872 0%, #d4a054 100%)` };
    case "ice":
      return { ...base, background: `linear-gradient(180deg, #bfdbfe 0%, #93c5fd 50%, #60a5fa 100%)` };
    case "platform":
      return { ...base, background: `linear-gradient(180deg, ${el.color} 0%, ${el.color}cc 100%)` };
    case "moving-platform":
      return { ...base, background: `linear-gradient(180deg, #22d3ee 0%, #06b6d4 100%)` };
    case "disappearing":
      return { ...base, background: `linear-gradient(180deg, #fbbf24 0%, #d97706 100%)`, opacity: 0.8 };
    case "bouncy":
      return { ...base, background: `linear-gradient(180deg, #f472b6 0%, #ec4899 100%)`, borderTop: "3px solid rgba(255,255,255,0.4)" };
    case "conveyor":
      return { ...base, background: `repeating-linear-gradient(90deg, #8b5cf6, #8b5cf6 8px, #7c3aed 8px, #7c3aed 16px)` };
    case "killbrick":
      return { ...base, background: `repeating-linear-gradient(45deg, #ef4444, #ef4444 4px, #b91c1c 4px, #b91c1c 8px)`, boxShadow: "2px 3px 6px rgba(0,0,0,0.35), 0 0 8px rgba(239,68,68,0.4)" };
    case "spinner":
      return { ...base, background: `linear-gradient(180deg, #fb923c 0%, #ea580c 100%)`, borderRadius: "50%" };
    case "laser":
      return { ...base, background: `linear-gradient(180deg, #ff0040 0%, #dc002f 100%)`, boxShadow: "0 0 10px rgba(255,0,64,0.5)", borderRadius: "2px" };
    case "spikes":
      return { ...base, background: `linear-gradient(180deg, #9ca3af 0%, #6b7280 100%)`, clipPath: "polygon(0% 100%, 10% 0%, 20% 100%, 30% 0%, 40% 100%, 50% 0%, 60% 100%, 70% 0%, 80% 100%, 90% 0%, 100% 100%)" };
    case "enemy":
      return { ...base, background: `linear-gradient(180deg, #ef4444 0%, #b91c1c 100%)`, borderRadius: "8px 8px 4px 4px" };
    case "pet":
      return { ...base, background: `linear-gradient(180deg, #f9a8d4 0%, #f472b6 100%)`, borderRadius: "50%" };
    case "npc":
      return { ...base, background: `linear-gradient(180deg, #4ade80 0%, #16a34a 100%)`, borderRadius: "8px 8px 4px 4px" };
    case "boss":
      return { ...base, background: `linear-gradient(180deg, #a78bfa 0%, #7c3aed 100%)`, borderRadius: "8px 8px 4px 4px" };
    case "shopkeeper":
      return { ...base, background: `linear-gradient(180deg, #fbbf24 0%, #d97706 100%)`, borderRadius: "8px 8px 4px 4px" };
    case "tree":
      return { ...base, background: `linear-gradient(180deg, #22c55e 0%, #16a34a 50%, #8b4513 51%, #6b3a1f 100%)`, borderRadius: "30% 30% 4px 4px" };
    case "rock":
      return { ...base, background: `linear-gradient(135deg, #9ca3af 0%, #6b7280 50%, #4b5563 100%)`, borderRadius: "30% 40% 30% 35%" };
    case "lamp":
      return { ...base, background: `linear-gradient(180deg, #fbbf24 0%, #fbbf24 20%, #6b7280 21%, #4b5563 100%)`, borderRadius: "50% 50% 3px 3px", boxShadow: "2px 3px 6px rgba(0,0,0,0.35), 0 -4px 12px rgba(251,191,36,0.3)" };
    case "bush":
      return { ...base, background: `radial-gradient(ellipse, #22c55e 0%, #15803d 100%)`, borderRadius: "50% 50% 40% 40%" };
    case "fence":
      return { ...base, background: `repeating-linear-gradient(90deg, #92400e 0px, #92400e 6px, #78350f 6px, #78350f 8px, transparent 8px, transparent 12px)` };
    case "checkpoint":
      return { ...base, background: `linear-gradient(180deg, #22c55e 0%, #22c55e 30%, #d1d5db 31%, #9ca3af 100%)`, borderRadius: "2px" };
    case "teleporter":
      return { ...base, background: `radial-gradient(circle, #c084fc 0%, #8b5cf6 50%, #6d28d9 100%)`, borderRadius: "50%", boxShadow: "2px 3px 6px rgba(0,0,0,0.35), 0 0 12px rgba(139,92,246,0.4)" };
    case "boost-pad":
      return { ...base, background: `linear-gradient(90deg, #06b6d4 0%, #22d3ee 50%, #06b6d4 100%)` };
    case "coin":
      return { ...base, background: `radial-gradient(circle at 35% 35%, #fde047, #eab308, #ca8a04)`, borderRadius: "50%", boxShadow: "2px 3px 6px rgba(0,0,0,0.35), 0 0 6px rgba(234,179,8,0.4)" };
    case "gem":
      return { ...base, background: `linear-gradient(135deg, #c084fc 0%, #8b5cf6 50%, #6d28d9 100%)`, borderRadius: "4px", transform: "rotate(45deg)", boxShadow: "2px 3px 6px rgba(0,0,0,0.35), 0 0 8px rgba(139,92,246,0.4)" };
    case "spawn":
      return { ...base, background: `radial-gradient(circle, rgba(34,197,94,0.4) 0%, rgba(34,197,94,0.15) 100%)`, border: "2px dashed #22c55e", borderRadius: "50%", boxShadow: "none" };
    default:
      return { ...base, background: `linear-gradient(180deg, ${el.color} 0%, ${el.color}cc 100%)` };
  }
}

function getElementEmoji(type: string): string {
  const map: Record<string, string> = {
    enemy: "👾", pet: "🐾", npc: "🧑", boss: "👑", shopkeeper: "🛒",
    tree: "🌲", rock: "🪨", lamp: "💡", bush: "🌿",
    checkpoint: "🏁", teleporter: "✨", coin: "$", gem: "💎", spawn: "👤",
    "boost-pad": "⚡", "moving-platform": "↔", bouncy: "⬆", conveyor: "→",
    killbrick: "☠", spinner: "🔄", laser: "⚡", spikes: "△",
  };
  return map[type] || "";
}

// ── Canvas Item (simple div, reliable drag) ──

function CanvasItem({ el }: { el: CanvasElement }) {
  const { selectedId, selectElement, tool, moveElement, removeElement } = useCanvasStore();
  const isSelected = selectedId === el.id;
  const dragOffset = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tool === "delete") { removeElement(el.id); return; }
    selectElement(el.id);
    if (tool === "select" || tool === "move") {
      setDragging(true);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  };

  useEffect(() => {
    if (!dragging) return;
    const canvas = document.getElementById("game-canvas");
    const handleMove = (e: MouseEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const zoom = useCanvasStore.getState().zoom;
      const x = (e.clientX - rect.left) / zoom - dragOffset.current.x;
      const y = (e.clientY - rect.top) / zoom - dragOffset.current.y;
      const snappedX = Math.round(x / GRID) * GRID;
      const snappedY = Math.round(y / GRID) * GRID;
      moveElement(el.id, snappedX, snappedY);
    };
    const handleUp = () => {
      setDragging(false);
      const { elements, undoStack } = useCanvasStore.getState();
      useCanvasStore.setState({ undoStack: [...undoStack, elements], redoStack: [] });
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
  }, [dragging, el.id, moveElement]);

  const emoji = getElementEmoji(el.type);
  const style = getElementStyle(el);

  return (
    <div
      className={`absolute select-none ${dragging ? "cursor-grabbing" : "cursor-pointer"} ${tool === "delete" ? "cursor-crosshair hover:opacity-40" : ""}`}
      style={{
        left: `${el.x}px`,
        top: `${el.y}px`,
        width: `${el.width}px`,
        height: `${el.height}px`,
        opacity: el.visible ? 1 : 0.3,
        outline: isSelected ? "2px solid #818cf8" : "none",
        outlineOffset: "2px",
        zIndex: isSelected ? 40 : dragging ? 50 : 10,
        transition: dragging ? "none" : "outline 0.1s",
        ...style,
        ...(isSelected ? { boxShadow: `${style.boxShadow || ""}, 0 0 0 4px rgba(129,140,248,0.2)` } : {}),
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Emoji/icon centered */}
      {emoji && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
          style={{ fontSize: `${Math.min(el.width, el.height) * 0.45}px`, lineHeight: 1 }}>
          {emoji}
        </div>
      )}

      {/* Label when selected */}
      {isSelected && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-6 whitespace-nowrap rounded bg-gray-900/95 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg border border-gray-700/50 pointer-events-none z-50">
          {el.label} <span className="text-gray-500 font-normal">{el.width}×{el.height}</span>
        </div>
      )}

      {/* Resize handle */}
      {isSelected && !dragging && (
        <div className="absolute -right-1.5 -bottom-1.5 h-3 w-3 rounded-full bg-indigo-500 border-2 border-gray-900 cursor-se-resize z-50" />
      )}
    </div>
  );
}

// ── Main Canvas — FLAT for reliable interaction, isometric VISUALS ──

export function GameCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { elements, tool, placingItem, addElement, selectElement, setPlacingItem, setTool, zoom } = useCanvasStore();
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);

  // Convert screen coords to canvas coords (accounts for scroll + zoom)
  const toCanvas = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    };
  }, [zoom]);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    const { x, y } = toCanvas(e.clientX, e.clientY);
    if (tool === "place" && placingItem) {
      addElement(placingItem, x - placingItem.defaultWidth / 2, y - placingItem.defaultHeight / 2);
      return;
    }
    selectElement(null);
  }, [tool, placingItem, addElement, selectElement, toCanvas]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/palette-item");
    if (!data) return;
    const item: PaletteItem = JSON.parse(data);
    const { x, y } = toCanvas(e.clientX, e.clientY);
    addElement(item, x - item.defaultWidth / 2, y - item.defaultHeight / 2);
    setTool("select");
    setPlacingItem(null);
  }, [addElement, setTool, setPlacingItem, toCanvas]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (tool !== "place" || !placingItem) { setGhostPos(null); return; }
    const { x, y } = toCanvas(e.clientX, e.clientY);
    setGhostPos({
      x: Math.round((x - placingItem.defaultWidth / 2) / GRID) * GRID,
      y: Math.round((y - placingItem.defaultHeight / 2) / GRID) * GRID,
    });
  }, [tool, placingItem, toCanvas]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPlacingItem(null); setTool("select"); selectElement(null); }
      if (e.key === "Delete" || e.key === "Backspace") {
        const { selectedId, removeElement: rem } = useCanvasStore.getState();
        if (selectedId) rem(selectedId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setPlacingItem, setTool, selectElement]);

  return (
    <div ref={scrollRef} className="relative flex-1 overflow-auto bg-gray-800">
      {/* Flat scrollable canvas — NO CSS 3D transforms so mouse coords are accurate */}
      <div
        id="game-canvas"
        ref={canvasRef}
        className={`relative ${tool === "place" || tool === "delete" ? "cursor-crosshair" : "cursor-default"}`}
        style={{
          width: `${PLANE_W}px`,
          height: `${PLANE_H}px`,
          transform: `scale(${zoom})`,
          transformOrigin: "0 0",
        }}
        onClick={handleCanvasClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setGhostPos(null)}
      >
        {/* ── Sky (top 45%) ── */}
        <div className="absolute left-0 right-0 top-0" style={{
          height: "45%",
          background: "linear-gradient(180deg, #4a90d9 0%, #87CEEB 40%, #B0E0E6 70%, #d4edfa 100%)",
        }}>
          {/* Sun */}
          <div className="absolute pointer-events-none" style={{
            top: "30px", right: "120px", width: "50px", height: "50px",
            background: "radial-gradient(circle, #fde047, #facc15 40%, transparent 70%)",
            borderRadius: "50%",
            boxShadow: "0 0 30px rgba(253,224,71,0.5)",
          }} />
          {/* Clouds */}
          {[{ x: 80, y: 40 }, { x: 350, y: 20 }, { x: 650, y: 55 }, { x: 1000, y: 30 }, { x: 1300, y: 50 }].map((c, i) => (
            <div key={`c${i}`} className="absolute pointer-events-none" style={{ left: c.x, top: c.y }}>
              <div className="rounded-full bg-white/70" style={{ width: "60px", height: "22px" }} />
              <div className="absolute rounded-full bg-white/80" style={{ width: "40px", height: "26px", top: "-8px", left: "10px" }} />
            </div>
          ))}
          {/* Distant mountains */}
          <svg className="absolute bottom-0 left-0 right-0 pointer-events-none" viewBox={`0 0 ${PLANE_W} 80`} preserveAspectRatio="none" style={{ height: "60px" }}>
            <polygon points={`0,80 50,30 150,50 280,15 400,45 520,10 680,35 800,20 950,50 1100,25 1250,40 1400,18 1600,80`} fill="#7ba87e" opacity="0.5" />
            <polygon points={`0,80 100,45 250,60 400,30 550,55 700,28 850,48 1000,35 1200,55 1400,30 1600,80`} fill="#6b9a6e" opacity="0.4" />
          </svg>
        </div>

        {/* ── Ground (bottom 55%) ── */}
        <div className="absolute left-0 right-0 bottom-0" style={{ height: "55%" }}>
          {/* Green grass surface */}
          <div className="absolute inset-0" style={{
            background: "linear-gradient(180deg, #5cb85c 0%, #4a9e4a 15%, #3d8a3d 40%, #2d6e2d 70%, #1e521e 100%)",
          }} />
          {/* Grid on ground */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="gGrid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#gGrid)" />
          </svg>
          {/* Grass texture dots */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: "radial-gradient(circle, rgba(100,200,60,0.12) 1px, transparent 2px)",
            backgroundSize: "18px 18px",
          }} />
        </div>

        {/* ── Elements ── */}
        {elements.map((el) => (
          <CanvasItem key={el.id} el={el} />
        ))}

        {/* Ghost preview when placing */}
        {ghostPos && placingItem && (
          <div className="absolute pointer-events-none z-30" style={{
            left: `${ghostPos.x}px`, top: `${ghostPos.y}px`,
            width: `${placingItem.defaultWidth}px`, height: `${placingItem.defaultHeight}px`,
            backgroundColor: `${placingItem.color}55`,
            border: "2px dashed rgba(255,255,255,0.5)",
            borderRadius: "4px",
          }} />
        )}

        {/* Empty state hint */}
        {elements.length === 0 && (
          <div className="absolute pointer-events-none" style={{ top: "38%", left: "50%", transform: "translate(-50%, -50%)" }}>
            <div className="text-center rounded-2xl bg-black/30 backdrop-blur-sm px-10 py-6 border border-white/15 shadow-xl">
              <p className="text-[16px] font-bold text-white/90">Drag parts here to build your game</p>
              <p className="mt-2 text-[13px] text-white/50">Pick from the Toolbox on the left — place ground, platforms, enemies, and more</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
