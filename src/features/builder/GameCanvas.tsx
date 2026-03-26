import { useRef, useCallback, useState, useEffect } from "react";
import { useCanvasStore, type CanvasElement, type PaletteItem } from "../../stores/canvasStore";

const CANVAS_W = 2400;
const CANVAS_H = 800;
const GRID_SIZE = 10;
const GROUND_Y = 620; // where the ground starts

// ── Rich visual rendering per element type ──

function renderElementVisual(el: CanvasElement) {
  const w = el.width;
  const h = el.height;

  // TERRAIN: Ground / Grass — brown dirt with green grass top
  if (el.type === "ground" || el.type === "grass") {
    return (
      <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: "3px" }}>
        <div className="absolute inset-0" style={{ background: "#5a3e28" }} />
        <div className="absolute inset-0" style={{
          background: "repeating-linear-gradient(90deg, rgba(0,0,0,0.05) 0px, transparent 2px, transparent 8px)",
        }} />
        {/* Grass top strip */}
        <div className="absolute top-0 left-0 right-0" style={{
          height: `${Math.min(h * 0.25, 12)}px`,
          background: "linear-gradient(180deg, #4ade80, #22c55e 40%, #16a34a)",
          borderRadius: "3px 3px 0 0",
        }} />
        {/* Grass blades */}
        <svg className="absolute top-0 left-0 right-0 pointer-events-none" style={{ height: "16px", marginTop: "-6px" }}>
          {Array.from({ length: Math.floor(w / 8) }).map((_, i) => (
            <polygon key={i} points={`${i * 8 + 2},16 ${i * 8 + 4},${4 + Math.random() * 4} ${i * 8 + 6},16`}
              fill={`hsl(${120 + Math.random() * 20}, ${60 + Math.random() * 20}%, ${35 + Math.random() * 15}%)`} />
          ))}
        </svg>
      </div>
    );
  }

  // TERRAIN: Sand
  if (el.type === "sand") {
    return (
      <div className="absolute inset-0" style={{
        background: "linear-gradient(180deg, #e8c872, #d4a054)",
        borderRadius: "3px",
      }}>
        <div className="absolute inset-0" style={{
          background: "repeating-radial-gradient(circle at 10px 10px, rgba(0,0,0,0.03) 0px, transparent 2px, transparent 6px)",
        }} />
      </div>
    );
  }

  // TERRAIN: Water — animated blue with wave top
  if (el.type === "water") {
    return (
      <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: "3px" }}>
        <div className="absolute inset-0" style={{
          background: "linear-gradient(180deg, #3b82f6 0%, #1d4ed8 50%, #1e3a5f 100%)",
        }} />
        {/* Wave shimmer */}
        <div className="absolute inset-0" style={{
          background: "repeating-linear-gradient(90deg, transparent, transparent 12px, rgba(255,255,255,0.1) 12px, rgba(255,255,255,0.1) 16px)",
          animation: "none",
        }} />
        {/* Wave top SVG */}
        <svg className="absolute -top-2 left-0 right-0 pointer-events-none" viewBox={`0 0 ${w} 12`} preserveAspectRatio="none" style={{ height: "10px" }}>
          <path d={`M0,8 ${Array.from({ length: Math.ceil(w / 20) }).map((_, i) => `Q${i * 20 + 10},${i % 2 === 0 ? 2 : 12} ${(i + 1) * 20},8`).join(" ")} V12 H0 Z`}
            fill="#3b82f6" opacity="0.8" />
        </svg>
        {/* Sparkle dots */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white/20"
            style={{ width: "3px", height: "3px", left: `${20 + i * w / 5}px`, top: `${6 + (i % 2) * 8}px` }} />
        ))}
      </div>
    );
  }

  // TERRAIN: Lava — glowing red/orange with bubbles
  if (el.type === "lava") {
    return (
      <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: "3px" }}>
        <div className="absolute inset-0" style={{
          background: "linear-gradient(180deg, #ff6b00 0%, #dc2626 40%, #991b1b 100%)",
        }} />
        <div className="absolute inset-0" style={{
          background: "repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,200,0,0.25) 8px, rgba(255,200,0,0.25) 12px)",
        }} />
        {/* Glow */}
        <div className="absolute -inset-2 pointer-events-none" style={{
          boxShadow: "inset 0 0 20px rgba(255,100,0,0.4), 0 0 15px rgba(255,50,0,0.3)",
          borderRadius: "6px",
        }} />
        {/* Bubbles */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="absolute rounded-full border border-orange-400/40"
            style={{ width: `${4 + i * 2}px`, height: `${4 + i * 2}px`, left: `${15 + i * w / 4}px`, top: `${4 + (i % 2) * 6}px`, backgroundColor: "rgba(255,150,0,0.3)" }} />
        ))}
      </div>
    );
  }

  // TERRAIN: Ice
  if (el.type === "ice") {
    return (
      <div className="absolute inset-0" style={{
        background: "linear-gradient(180deg, #bfdbfe, #93c5fd 50%, #60a5fa)",
        borderRadius: "3px",
      }}>
        <div className="absolute inset-0" style={{
          background: "repeating-linear-gradient(135deg, transparent, transparent 6px, rgba(255,255,255,0.2) 6px, rgba(255,255,255,0.2) 8px)",
        }} />
        {/* Shine streak */}
        <div className="absolute" style={{
          top: "3px", left: "10%", width: "30%", height: "3px",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
          borderRadius: "2px",
        }} />
      </div>
    );
  }

  // PLATFORM: Static — solid with 3D depth
  if (el.type === "platform") {
    return (
      <div className="absolute inset-0" style={{ borderRadius: "4px" }}>
        <div className="absolute inset-0" style={{
          background: `linear-gradient(180deg, ${el.color} 0%, ${el.color}cc 100%)`,
          borderRadius: "4px",
          borderTop: "2px solid rgba(255,255,255,0.2)",
          borderBottom: "2px solid rgba(0,0,0,0.3)",
        }} />
      </div>
    );
  }

  // PLATFORM: Moving — with arrows
  if (el.type === "moving-platform") {
    return (
      <div className="absolute inset-0" style={{ borderRadius: "4px" }}>
        <div className="absolute inset-0" style={{
          background: `linear-gradient(180deg, #06b6d4 0%, #0891b2 100%)`,
          borderRadius: "4px",
          borderTop: "2px solid rgba(255,255,255,0.2)",
        }} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-white/40 text-[10px] font-bold tracking-widest">◄ ►</span>
        </div>
      </div>
    );
  }

  // PLATFORM: Bouncy
  if (el.type === "bouncy") {
    return (
      <div className="absolute inset-0" style={{ borderRadius: "6px 6px 4px 4px" }}>
        <div className="absolute inset-0" style={{
          background: "linear-gradient(180deg, #f472b6, #ec4899)",
          borderRadius: "6px 6px 4px 4px",
          borderTop: "3px solid rgba(255,255,255,0.3)",
        }} />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-white/50 text-[10px] font-bold">↑</span>
        </div>
      </div>
    );
  }

  // OBSTACLE: Kill Brick — red with warning stripes
  if (el.type === "killbrick") {
    return (
      <div className="absolute inset-0" style={{ borderRadius: "2px" }}>
        <div className="absolute inset-0" style={{
          background: `repeating-linear-gradient(45deg, #ef4444, #ef4444 4px, #dc2626 4px, #dc2626 8px)`,
          borderRadius: "2px",
        }} />
        <div className="absolute -inset-1 pointer-events-none" style={{
          boxShadow: "0 0 8px rgba(239,68,68,0.4)",
        }} />
      </div>
    );
  }

  // OBSTACLE: Spikes — triangular shapes
  if (el.type === "spikes") {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 w-full h-full">
          {Array.from({ length: Math.ceil(w / 12) }).map((_, i) => (
            <polygon key={i} points={`${i * 12},${h} ${i * 12 + 6},2 ${i * 12 + 12},${h}`} fill="#9ca3af" stroke="#6b7280" strokeWidth="0.5" />
          ))}
        </svg>
      </div>
    );
  }

  // CHARACTER: Tree — trunk + foliage
  if (el.type === "tree") {
    const trunkW = Math.max(w * 0.25, 6);
    const trunkH = h * 0.4;
    const leafH = h * 0.65;
    return (
      <div className="absolute inset-0">
        {/* Trunk */}
        <div className="absolute bottom-0" style={{
          left: `${(w - trunkW) / 2}px`, width: `${trunkW}px`, height: `${trunkH}px`,
          background: "linear-gradient(90deg, #6b3a1f, #8b4513, #6b3a1f)",
          borderRadius: "2px",
        }} />
        {/* Foliage */}
        <svg className="absolute top-0 left-0" viewBox={`0 0 ${w} ${leafH}`} style={{ width: `${w}px`, height: `${leafH}px` }}>
          <ellipse cx={w / 2} cy={leafH * 0.55} rx={w * 0.48} ry={leafH * 0.45} fill="#16a34a" />
          <ellipse cx={w * 0.35} cy={leafH * 0.4} rx={w * 0.3} ry={leafH * 0.35} fill="#22c55e" />
          <ellipse cx={w * 0.65} cy={leafH * 0.45} rx={w * 0.28} ry={leafH * 0.32} fill="#15803d" />
        </svg>
      </div>
    );
  }

  // CHARACTER: Rock
  if (el.type === "rock") {
    return (
      <div className="absolute inset-0">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
          <path d={`M${w * 0.1},${h} L${w * 0.05},${h * 0.4} L${w * 0.3},${h * 0.1} L${w * 0.6},${h * 0.05} L${w * 0.85},${h * 0.2} L${w * 0.95},${h * 0.5} L${w * 0.9},${h} Z`}
            fill="#6b7280" stroke="#4b5563" strokeWidth="1" />
          <path d={`M${w * 0.2},${h * 0.5} L${w * 0.4},${h * 0.3} L${w * 0.55},${h * 0.35}`}
            fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        </svg>
      </div>
    );
  }

  // CHARACTER: Enemy — red body with angry eyes
  if (el.type === "enemy") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-end">
        {/* Head */}
        <div style={{ width: `${w * 0.7}px`, height: `${w * 0.7}px`, background: "#dc2626", borderRadius: "50%", position: "relative" }}>
          <div className="absolute" style={{ top: "30%", left: "20%", width: "20%", height: "20%", background: "white", borderRadius: "50%" }}>
            <div style={{ width: "50%", height: "50%", background: "#000", borderRadius: "50%", marginTop: "25%", marginLeft: "25%" }} />
          </div>
          <div className="absolute" style={{ top: "30%", right: "20%", width: "20%", height: "20%", background: "white", borderRadius: "50%" }}>
            <div style={{ width: "50%", height: "50%", background: "#000", borderRadius: "50%", marginTop: "25%", marginLeft: "25%" }} />
          </div>
          {/* Angry brows */}
          <div className="absolute" style={{ top: "22%", left: "15%", width: "30%", height: "2px", background: "#7f1d1d", transform: "rotate(-15deg)" }} />
          <div className="absolute" style={{ top: "22%", right: "15%", width: "30%", height: "2px", background: "#7f1d1d", transform: "rotate(15deg)" }} />
        </div>
        {/* Body */}
        <div style={{ width: `${w * 0.55}px`, height: `${h * 0.35}px`, background: "#b91c1c", borderRadius: "4px 4px 6px 6px" }} />
      </div>
    );
  }

  // CHARACTER: Pet — cute pink blob with heart eyes
  if (el.type === "pet") {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{ width: `${w * 0.85}px`, height: `${h * 0.85}px`, background: "#f472b6", borderRadius: "40%", position: "relative" }}>
          <div className="absolute" style={{ top: "25%", left: "20%", fontSize: `${w * 0.2}px`, lineHeight: 1 }}>♥</div>
          <div className="absolute" style={{ top: "25%", right: "20%", fontSize: `${w * 0.2}px`, lineHeight: 1 }}>♥</div>
          <div className="absolute" style={{ bottom: "20%", left: "50%", transform: "translateX(-50%)", width: "30%", height: "10%", background: "#e11d48", borderRadius: "0 0 50% 50%" }} />
        </div>
      </div>
    );
  }

  // CHARACTER: NPC
  if (el.type === "npc" || el.type === "shopkeeper") {
    const bodyColor = el.type === "shopkeeper" ? "#eab308" : "#22c55e";
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-end">
        <div style={{ width: `${w * 0.65}px`, height: `${w * 0.65}px`, background: "#fbbf24", borderRadius: "50%" }}>
          <div className="absolute" style={{ top: "35%", left: "25%", width: "12%", height: "12%", background: "#000", borderRadius: "50%" }} />
          <div className="absolute" style={{ top: "35%", right: "25%", width: "12%", height: "12%", background: "#000", borderRadius: "50%" }} />
          <div className="absolute" style={{ bottom: "25%", left: "50%", transform: "translateX(-50%)", width: "20%", height: "3px", background: "#000", borderRadius: "2px" }} />
        </div>
        <div style={{ width: `${w * 0.5}px`, height: `${h * 0.35}px`, background: bodyColor, borderRadius: "3px 3px 5px 5px" }} />
      </div>
    );
  }

  // CHARACTER: Boss — bigger with crown
  if (el.type === "boss") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-end">
        {/* Crown */}
        <svg viewBox="0 0 24 12" style={{ width: `${w * 0.5}px`, height: `${w * 0.25}px` }}>
          <polygon points="2,12 4,4 8,8 12,2 16,8 20,4 22,12" fill="#eab308" stroke="#ca8a04" strokeWidth="0.5" />
        </svg>
        <div style={{ width: `${w * 0.6}px`, height: `${w * 0.6}px`, background: "#7c3aed", borderRadius: "50%", position: "relative" }}>
          <div className="absolute" style={{ top: "30%", left: "20%", width: "18%", height: "18%", background: "#fbbf24", borderRadius: "50%" }} />
          <div className="absolute" style={{ top: "30%", right: "20%", width: "18%", height: "18%", background: "#fbbf24", borderRadius: "50%" }} />
        </div>
        <div style={{ width: `${w * 0.5}px`, height: `${h * 0.25}px`, background: "#6d28d9", borderRadius: "4px" }} />
      </div>
    );
  }

  // MECHANIC: Checkpoint — flag on pole
  if (el.type === "checkpoint") {
    return (
      <div className="absolute inset-0">
        <div className="absolute bottom-0" style={{ left: `${w * 0.45}px`, width: "3px", height: `${h * 0.9}px`, background: "#d1d5db" }} />
        <div className="absolute top-1" style={{ left: `${w * 0.48}px`, width: `${w * 0.45}px`, height: `${h * 0.3}px`, background: "#22c55e", borderRadius: "2px", clipPath: "polygon(0 0, 100% 15%, 100% 85%, 0 100%)" }} />
      </div>
    );
  }

  // MECHANIC: Coin — golden circle with shine
  if (el.type === "coin") {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{ width: `${Math.min(w, h) * 0.85}px`, height: `${Math.min(w, h) * 0.85}px`, background: "radial-gradient(circle at 35% 35%, #fde047, #eab308, #ca8a04)", borderRadius: "50%", boxShadow: "0 0 8px rgba(234,179,8,0.4)" }}>
          <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: `${Math.min(w, h) * 0.4}px`, color: "#92400e", fontWeight: "bold" }}>$</div>
        </div>
      </div>
    );
  }

  // MECHANIC: Gem — diamond shape
  if (el.type === "gem") {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{ width: `${Math.min(w, h) * 0.7}px`, height: `${Math.min(w, h) * 0.7}px`, background: "linear-gradient(135deg, #c084fc, #8b5cf6, #6d28d9)", transform: "rotate(45deg)", borderRadius: "3px", boxShadow: "0 0 10px rgba(139,92,246,0.5)" }} />
      </div>
    );
  }

  // MECHANIC: Spawn — green circle with player silhouette
  if (el.type === "spawn") {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{ width: `${Math.min(w, h) * 0.85}px`, height: `${Math.min(w, h) * 0.85}px`, background: "radial-gradient(circle, rgba(34,197,94,0.3), rgba(34,197,94,0.1))", border: "2px dashed #22c55e", borderRadius: "50%" }}>
          <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: `${Math.min(w, h) * 0.35}px`, color: "#22c55e" }}>⬆</div>
        </div>
      </div>
    );
  }

  // DECORATION: Lamp
  if (el.type === "lamp") {
    return (
      <div className="absolute inset-0">
        <div className="absolute bottom-0" style={{ left: `${w * 0.4}px`, width: "3px", height: `${h * 0.85}px`, background: "#6b7280" }} />
        <div className="absolute top-0" style={{ left: `${w * 0.15}px`, width: `${w * 0.7}px`, height: `${h * 0.2}px`, background: "#fbbf24", borderRadius: "50% 50% 30% 30%", boxShadow: "0 4px 16px rgba(251,191,36,0.4)" }} />
        {/* Light cone */}
        <div className="absolute pointer-events-none" style={{ top: `${h * 0.18}px`, left: "0", width: `${w}px`, height: `${h * 0.5}px`, background: "radial-gradient(ellipse at 50% 0%, rgba(251,191,36,0.15), transparent 70%)" }} />
      </div>
    );
  }

  // DEFAULT: colored block with border
  return (
    <div className="absolute inset-0" style={{
      background: `linear-gradient(180deg, ${el.color}, ${el.color}cc)`,
      borderRadius: "4px",
      borderTop: "2px solid rgba(255,255,255,0.15)",
      borderBottom: "2px solid rgba(0,0,0,0.2)",
    }} />
  );
}

// ── Canvas Item wrapper (handles selection, dragging) ──

function CanvasItem({ el }: { el: CanvasElement }) {
  const { selectedId, selectElement, tool, moveElement, removeElement } = useCanvasStore();
  const isSelected = selectedId === el.id;
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tool === "delete") { removeElement(el.id); return; }
    selectElement(el.id);
    if (tool === "select" || tool === "move") {
      setDragging(true);
      dragOffset.current = { x: e.clientX - el.x, y: e.clientY - el.y };
    }
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      moveElement(el.id, e.clientX - dragOffset.current.x, e.clientY - dragOffset.current.y);
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

  return (
    <div
      className={`absolute ${dragging ? "cursor-grabbing" : "cursor-pointer"} ${tool === "delete" ? "cursor-crosshair hover:opacity-50" : ""}`}
      style={{
        left: `${el.x}px`,
        top: `${el.y}px`,
        width: `${el.width}px`,
        height: `${el.height}px`,
        opacity: el.visible ? 1 : 0.3,
        outline: isSelected ? "2px solid #818cf8" : "none",
        outlineOffset: "2px",
        boxShadow: isSelected ? "0 0 0 5px rgba(129,140,248,0.15)" : dragging ? "0 8px 24px rgba(0,0,0,0.5)" : "none",
        transform: dragging ? "scale(1.02)" : "scale(1)",
        zIndex: isSelected ? 40 : dragging ? 50 : el.category === "decoration" ? 5 : 10,
        transition: dragging ? "none" : "box-shadow 0.15s, transform 0.15s",
      }}
      onMouseDown={handleMouseDown}
    >
      {renderElementVisual(el)}

      {/* Label when selected */}
      {isSelected && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-7 whitespace-nowrap rounded-md bg-gray-900/95 px-2.5 py-1 text-[10px] font-bold text-white shadow-lg border border-gray-700/50 pointer-events-none z-50">
          {el.label}
          <span className="ml-1.5 text-gray-400 font-normal">{el.width}×{el.height}</span>
        </div>
      )}

      {/* Resize handles */}
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
  const { elements, tool, placingItem, addElement, selectElement, setPlacingItem, setTool, zoom } = useCanvasStore();
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    if (tool === "place" && placingItem) {
      addElement(placingItem, x - placingItem.defaultWidth / 2, y - placingItem.defaultHeight / 2);
      return;
    }
    selectElement(null);
  }, [tool, placingItem, addElement, selectElement, zoom]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/palette-item");
    if (!data || !canvasRef.current) return;
    const item: PaletteItem = JSON.parse(data);
    const rect = canvasRef.current.getBoundingClientRect();
    addElement(item, (e.clientX - rect.left) / zoom - item.defaultWidth / 2, (e.clientY - rect.top) / zoom - item.defaultHeight / 2);
    setTool("select");
    setPlacingItem(null);
  }, [addElement, setTool, setPlacingItem, zoom]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (tool !== "place" || !placingItem || !canvasRef.current) { setGhostPos(null); return; }
    const rect = canvasRef.current.getBoundingClientRect();
    setGhostPos({
      x: Math.round(((e.clientX - rect.left) / zoom - placingItem.defaultWidth / 2) / GRID_SIZE) * GRID_SIZE,
      y: Math.round(((e.clientY - rect.top) / zoom - placingItem.defaultHeight / 2) / GRID_SIZE) * GRID_SIZE,
    });
  }, [tool, placingItem, zoom]);

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
    <div className="relative flex-1 overflow-auto">
      <div
        ref={canvasRef}
        className={`relative ${tool === "place" || tool === "delete" ? "cursor-crosshair" : "cursor-default"}`}
        style={{ width: `${CANVAS_W}px`, height: `${CANVAS_H}px`, transform: `scale(${zoom})`, transformOrigin: "0 0" }}
        onClick={handleCanvasClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setGhostPos(null)}
      >
        {/* ── Sky ── */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(180deg, #1e3a5f 0%, #2563eb 25%, #60a5fa 50%, #93c5fd 70%, #bfdbfe 85%, #e0f2fe 100%)",
        }} />

        {/* Sun */}
        <div className="absolute pointer-events-none" style={{
          top: "40px", right: "180px", width: "60px", height: "60px",
          background: "radial-gradient(circle, #fde047, #facc15 40%, transparent 70%)",
          borderRadius: "50%",
          boxShadow: "0 0 40px rgba(253,224,71,0.4), 0 0 80px rgba(253,224,71,0.15)",
        }} />

        {/* Clouds */}
        {[
          { x: 100, y: 60, s: 1 }, { x: 400, y: 30, s: 1.3 }, { x: 750, y: 80, s: 0.9 },
          { x: 1100, y: 40, s: 1.1 }, { x: 1500, y: 70, s: 1.2 }, { x: 1900, y: 50, s: 0.8 },
        ].map((c, i) => (
          <div key={`cloud-${i}`} className="absolute pointer-events-none" style={{ left: `${c.x}px`, top: `${c.y}px`, transform: `scale(${c.s})` }}>
            <div className="relative">
              <div className="absolute rounded-full bg-white/80" style={{ width: "50px", height: "24px", top: "8px", left: "0px" }} />
              <div className="absolute rounded-full bg-white/90" style={{ width: "40px", height: "30px", top: "0px", left: "12px" }} />
              <div className="absolute rounded-full bg-white/80" style={{ width: "45px", height: "22px", top: "10px", left: "30px" }} />
            </div>
          </div>
        ))}

        {/* Background mountains */}
        <svg className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ height: `${CANVAS_H - GROUND_Y + 120}px`, bottom: `${CANVAS_H - GROUND_Y - 20}px` }} viewBox={`0 0 ${CANVAS_W} 200`} preserveAspectRatio="none">
          <polygon points={`0,200 0,120 100,60 250,100 400,40 550,90 700,30 850,80 1000,50 1150,110 1300,45 1450,85 1600,55 1750,95 1900,35 2050,75 2200,100 2400,70 2400,200`}
            fill="rgba(30,58,95,0.3)" />
          <polygon points={`0,200 0,140 150,100 300,130 500,80 650,120 800,70 950,110 1100,85 1300,130 1500,75 1700,110 1900,90 2100,120 2400,95 2400,200`}
            fill="rgba(30,58,95,0.2)" />
        </svg>

        {/* ── Ground ── */}
        <div className="absolute left-0 right-0 bottom-0" style={{ top: `${GROUND_Y}px` }}>
          {/* Dirt body */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #8B6914 0%, #6b4f12 30%, #5a3e0e 100%)" }} />
          {/* Grass strip on top */}
          <div className="absolute top-0 left-0 right-0" style={{ height: "12px", background: "linear-gradient(180deg, #4ade80, #22c55e 50%, #16a34a)" }} />
          {/* Grass blades */}
          <svg className="absolute left-0 right-0 pointer-events-none" style={{ top: "-10px", height: "18px" }}>
            {Array.from({ length: Math.floor(CANVAS_W / 6) }).map((_, i) => (
              <polygon key={i}
                points={`${i * 6 + 1},18 ${i * 6 + 3},${2 + (i * 7 % 5)} ${i * 6 + 5},18`}
                fill={`hsl(${118 + (i * 3 % 15)}, ${55 + (i * 7 % 20)}%, ${32 + (i * 11 % 12)}%)`}
              />
            ))}
          </svg>
          {/* Dirt texture */}
          <div className="absolute inset-0" style={{
            backgroundImage: "repeating-radial-gradient(circle at 15px 15px, rgba(0,0,0,0.04) 0px, transparent 3px, transparent 8px)",
          }} />
        </div>

        {/* Subtle grid (faded so it's not dominant) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.15 }} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid100" width={100} height={100} patternUnits="userSpaceOnUse">
              <path d={`M 100 0 L 0 0 0 100`} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height={GROUND_Y} fill="url(#grid100)" />
        </svg>

        {/* ── Placed elements ── */}
        {elements.map((el) => (
          <CanvasItem key={el.id} el={el} />
        ))}

        {/* Ghost preview */}
        {ghostPos && placingItem && (
          <div className="absolute pointer-events-none" style={{
            left: `${ghostPos.x}px`, top: `${ghostPos.y}px`,
            width: `${placingItem.defaultWidth}px`, height: `${placingItem.defaultHeight}px`,
            backgroundColor: `${placingItem.color}44`,
            borderRadius: "4px", border: "2px dashed rgba(255,255,255,0.4)",
          }} />
        )}

        {/* Empty state hint (only if no elements) */}
        {elements.length === 0 && (
          <div className="absolute pointer-events-none" style={{ top: `${GROUND_Y - 100}px`, left: "50%", transform: "translateX(-50%)" }}>
            <div className="text-center rounded-2xl bg-black/30 backdrop-blur-sm px-8 py-5 border border-white/10">
              <p className="text-[15px] font-bold text-white/80">Drag parts from the Toolbox to start building</p>
              <p className="mt-1 text-[13px] text-white/50">Place ground, platforms, enemies, and more!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
