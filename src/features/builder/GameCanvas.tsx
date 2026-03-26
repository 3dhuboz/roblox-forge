import { useRef, useCallback, useState, useEffect } from "react";
import { useCanvasStore, type CanvasElement, type PaletteItem } from "../../stores/canvasStore";

const PLANE_W = 1600;
const PLANE_H = 1000;
const GRID = 40;

// ── Color helpers for 3D faces ──

function lighten(hex: string, pct: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.min(255, r + pct)},${Math.min(255, g + pct)},${Math.min(255, b + pct)})`;
}

function darken(hex: string, pct: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.max(0, r - pct)},${Math.max(0, g - pct)},${Math.max(0, b - pct)})`;
}

function safeHex(color: string): string {
  if (color.startsWith("#") && color.length === 7) return color;
  if (color.startsWith("#") && color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return "#6366f1";
}

// ── 3D Isometric block renderer ──
// Each element = 3 faces: top (light), front (mid), right side (dark)

function IsoBlock({ el, isSelected, onMouseDown }: {
  el: CanvasElement;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
}) {
  // Element dimensions in the 3D world
  const w = el.width;   // width (X axis)
  const d = Math.max(el.width * 0.6, 20); // depth (Z axis - into screen)
  const h = el.height;  // height (Y axis - up)
  const color = safeHex(el.color);

  // Isometric projection: 2:1 ratio
  // screenX = (worldX - worldZ) * 1
  // screenY = (worldX + worldZ) * 0.5 - worldY
  const isoW = w + d;       // total screen width
  const isoH = (w + d) * 0.5 + h; // total screen height

  const topColor = lighten(color, 40);
  const frontColor = color;
  const sideColor = darken(color, 40);

  // Special textures for certain types
  const isWater = el.type === "water";
  const isLava = el.type === "lava";
  const isGrass = el.type === "grass" || el.type === "ground";
  const isTree = el.type === "tree";
  const isCheckpoint = el.type === "checkpoint";
  const isCoin = el.type === "coin" || el.type === "gem";
  const isCharacter = el.category === "character";

  return (
    <div
      className={`absolute ${isSelected ? "z-40" : "z-10"}`}
      style={{
        left: `${el.x}px`,
        top: `${el.y - isoH}px`,
        width: `${isoW}px`,
        height: `${isoH}px`,
        filter: isSelected ? "drop-shadow(0 0 8px rgba(129,140,248,0.6))" : "drop-shadow(2px 4px 3px rgba(0,0,0,0.3))",
        cursor: "pointer",
      }}
      onMouseDown={onMouseDown}
    >
      <svg
        viewBox={`0 0 ${isoW} ${isoH}`}
        width={isoW}
        height={isoH}
        className="overflow-visible"
      >
        {/* TOP FACE */}
        <polygon
          points={`${isoW / 2},0 ${isoW},${d * 0.5} ${isoW / 2},${d} 0,${d * 0.5}`}
          fill={isGrass ? "#4ade80" : isWater ? "#60a5fa" : isLava ? "#fb923c" : topColor}
          stroke={isSelected ? "#818cf8" : "rgba(255,255,255,0.1)"}
          strokeWidth={isSelected ? 2 : 0.5}
        />
        {/* Grass texture on top */}
        {isGrass && (
          <>
            {Array.from({ length: 8 }).map((_, i) => (
              <circle key={`gt${i}`}
                cx={isoW * 0.2 + (i * isoW * 0.08)}
                cy={d * 0.3 + (i % 3) * 4}
                r={2}
                fill="#22c55e"
                opacity={0.5}
              />
            ))}
          </>
        )}
        {/* Water ripples on top */}
        {isWater && (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <line key={`wr${i}`}
                x1={isoW * 0.2 + i * isoW * 0.15}
                y1={d * 0.25 + i * 3}
                x2={isoW * 0.2 + i * isoW * 0.15 + 20}
                y2={d * 0.25 + i * 3 - 2}
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            ))}
          </>
        )}
        {/* Lava bubbles on top */}
        {isLava && (
          <>
            {Array.from({ length: 3 }).map((_, i) => (
              <circle key={`lb${i}`}
                cx={isoW * 0.3 + i * isoW * 0.2}
                cy={d * 0.35 + (i % 2) * 4}
                r={3}
                fill="#fde047"
                opacity={0.6}
              />
            ))}
          </>
        )}

        {/* FRONT FACE */}
        <polygon
          points={`0,${d * 0.5} ${isoW / 2},${d} ${isoW / 2},${d + h} 0,${d * 0.5 + h}`}
          fill={isGrass ? "#8B6914" : isWater ? "#1d4ed8" : isLava ? "#dc2626" : frontColor}
          stroke={isSelected ? "#818cf8" : "rgba(0,0,0,0.15)"}
          strokeWidth={isSelected ? 2 : 0.5}
        />
        {/* Dirt texture on front of grass blocks */}
        {isGrass && (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <circle key={`dt${i}`}
                cx={10 + i * 15}
                cy={d * 0.5 + h * 0.3 + (i % 2) * 8}
                r={2}
                fill="rgba(0,0,0,0.1)"
              />
            ))}
          </>
        )}

        {/* RIGHT FACE */}
        <polygon
          points={`${isoW / 2},${d} ${isoW},${d * 0.5} ${isoW},${d * 0.5 + h} ${isoW / 2},${d + h}`}
          fill={isGrass ? "#6b4f12" : isWater ? "#1e40af" : isLava ? "#991b1b" : sideColor}
          stroke={isSelected ? "#818cf8" : "rgba(0,0,0,0.2)"}
          strokeWidth={isSelected ? 2 : 0.5}
        />

        {/* Icon/label on front face for characters and special types */}
        {isCharacter && (
          <>
            {/* Eyes */}
            <circle cx={isoW * 0.2} cy={d * 0.5 + h * 0.3} r={3} fill="white" />
            <circle cx={isoW * 0.35} cy={d * 0.5 + h * 0.3} r={3} fill="white" />
            <circle cx={isoW * 0.2} cy={d * 0.5 + h * 0.3} r={1.5} fill="black" />
            <circle cx={isoW * 0.35} cy={d * 0.5 + h * 0.3} r={1.5} fill="black" />
            {el.type === "enemy" && (
              <>
                <line x1={isoW * 0.13} y1={d * 0.5 + h * 0.2} x2={isoW * 0.27} y2={d * 0.5 + h * 0.25} stroke="#7f1d1d" strokeWidth={2} />
                <line x1={isoW * 0.28} y1={d * 0.5 + h * 0.25} x2={isoW * 0.42} y2={d * 0.5 + h * 0.2} stroke="#7f1d1d" strokeWidth={2} />
              </>
            )}
          </>
        )}

        {isTree && (
          <>
            {/* Tree trunk on front */}
            <rect x={isoW * 0.35} y={d * 0.5 + h * 0.5} width={isoW * 0.1} height={h * 0.5} fill="#8b4513" />
            {/* Foliage circles */}
            <circle cx={isoW * 0.25} cy={d * 0.3 + h * 0.15} r={w * 0.2} fill="#22c55e" />
            <circle cx={isoW * 0.4} cy={d * 0.15 + h * 0.1} r={w * 0.25} fill="#16a34a" />
            <circle cx={isoW * 0.35} cy={d * 0.35 + h * 0.2} r={w * 0.18} fill="#15803d" />
          </>
        )}

        {isCheckpoint && (
          <>
            {/* Flag pole */}
            <rect x={isoW * 0.45} y={d * 0.3} width={2} height={h * 0.8} fill="#d1d5db" />
            {/* Flag */}
            <polygon
              points={`${isoW * 0.47},${d * 0.3} ${isoW * 0.75},${d * 0.3 + 8} ${isoW * 0.47},${d * 0.3 + 16}`}
              fill="#22c55e"
            />
          </>
        )}

        {isCoin && (
          <circle
            cx={isoW / 2}
            cy={d * 0.5 + h * 0.4}
            r={Math.min(w, h) * 0.3}
            fill={el.type === "gem" ? "#a78bfa" : "#fde047"}
            stroke={el.type === "gem" ? "#7c3aed" : "#ca8a04"}
            strokeWidth={1.5}
          />
        )}

        {/* Label */}
        <text
          x={isoW * 0.25}
          y={d + h + 14}
          fontSize={10}
          fill="rgba(255,255,255,0.7)"
          fontWeight="bold"
          fontFamily="system-ui"
        >
          {el.label}
        </text>
      </svg>

      {/* Selection outline glow */}
      {isSelected && (
        <div className="absolute inset-0 rounded pointer-events-none" style={{
          boxShadow: "0 0 0 2px #818cf8, 0 0 15px rgba(129,140,248,0.3)",
        }} />
      )}
    </div>
  );
}

// ── Interactive canvas item (wraps IsoBlock with drag logic) ──

function CanvasIsoItem({ el }: { el: CanvasElement }) {
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

  return <IsoBlock el={el} isSelected={isSelected} onMouseDown={handleMouseDown} />;
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

        {/* ── Elements (isometric SVG blocks) ── */}
        {elements.map((el) => (
          <CanvasIsoItem key={el.id} el={el} />
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
