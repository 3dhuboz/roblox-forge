import { create } from "zustand";
import { getDefaultLogic, type GameLogicProperties } from "../lib/gameLogic";

// ── Types ──

export type ElementCategory = "terrain" | "platform" | "obstacle" | "character" | "decoration" | "mechanic" | "structure";
export type ToolMode = "select" | "move" | "delete" | "place";

export interface PaletteItem {
  type: string;
  category: ElementCategory;
  label: string;
  icon: string;
  defaultWidth: number;
  defaultHeight: number;
  color: string;
  description: string;
}

export interface CanvasElement {
  id: string;
  type: string;
  category: ElementCategory;
  label: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  rotation: number;
  locked: boolean;
  visible: boolean;
  properties: Record<string, unknown>;
  logic: GameLogicProperties;
}

// ── Palette catalog (Roblox Studio Toolbox equivalent) ──

export const PALETTE_ITEMS: PaletteItem[] = [
  // Terrain
  { type: "ground", category: "terrain", label: "Ground", icon: "square", defaultWidth: 200, defaultHeight: 40, color: "#4a5568", description: "Solid ground block" },
  { type: "grass", category: "terrain", label: "Grass", icon: "trees", defaultWidth: 200, defaultHeight: 40, color: "#2d6a4f", description: "Grass-covered ground" },
  { type: "water", category: "terrain", label: "Water", icon: "droplets", defaultWidth: 160, defaultHeight: 30, color: "#2563eb", description: "Water — players swim" },
  { type: "lava", category: "terrain", label: "Lava", icon: "flame", defaultWidth: 120, defaultHeight: 20, color: "#dc2626", description: "Deadly lava pool" },
  { type: "sand", category: "terrain", label: "Sand", icon: "sun", defaultWidth: 200, defaultHeight: 40, color: "#d4a574", description: "Sandy ground" },
  { type: "ice", category: "terrain", label: "Ice", icon: "snowflake", defaultWidth: 160, defaultHeight: 30, color: "#93c5fd", description: "Slippery ice" },

  // Platforms
  { type: "platform", category: "platform", label: "Platform", icon: "minus", defaultWidth: 100, defaultHeight: 16, color: "#6366f1", description: "Jump on this" },
  { type: "moving-platform", category: "platform", label: "Moving", icon: "move-horizontal", defaultWidth: 100, defaultHeight: 16, color: "#06b6d4", description: "Moves back and forth" },
  { type: "disappearing", category: "platform", label: "Vanishing", icon: "eye-off", defaultWidth: 80, defaultHeight: 16, color: "#fbbf24", description: "Disappears when stepped on" },
  { type: "bouncy", category: "platform", label: "Bouncy", icon: "arrow-up", defaultWidth: 80, defaultHeight: 16, color: "#f472b6", description: "Launches player up" },
  { type: "conveyor", category: "platform", label: "Conveyor", icon: "arrow-right", defaultWidth: 120, defaultHeight: 16, color: "#a78bfa", description: "Pushes sideways" },

  // Obstacles
  { type: "killbrick", category: "obstacle", label: "Kill Brick", icon: "skull", defaultWidth: 60, defaultHeight: 16, color: "#ef4444", description: "Instant KO on touch" },
  { type: "spinner", category: "obstacle", label: "Spinner", icon: "rotate-cw", defaultWidth: 80, defaultHeight: 12, color: "#f97316", description: "Spinning bar" },
  { type: "laser", category: "obstacle", label: "Laser", icon: "zap", defaultWidth: 8, defaultHeight: 80, color: "#ff0040", description: "Laser beam" },
  { type: "spikes", category: "obstacle", label: "Spikes", icon: "triangle", defaultWidth: 60, defaultHeight: 20, color: "#9ca3af", description: "Sharp spikes" },

  // Characters
  { type: "enemy", category: "character", label: "Enemy", icon: "ghost", defaultWidth: 32, defaultHeight: 40, color: "#dc2626", description: "Attacks players" },
  { type: "pet", category: "character", label: "Pet", icon: "heart", defaultWidth: 24, defaultHeight: 28, color: "#f472b6", description: "Follows the player" },
  { type: "npc", category: "character", label: "NPC", icon: "user", defaultWidth: 28, defaultHeight: 40, color: "#22c55e", description: "Gives quests" },
  { type: "boss", category: "character", label: "Boss", icon: "crown", defaultWidth: 48, defaultHeight: 56, color: "#7c3aed", description: "Big boss fight" },
  { type: "shopkeeper", category: "character", label: "Shop", icon: "shopping-bag", defaultWidth: 28, defaultHeight: 40, color: "#eab308", description: "Sells items" },

  // Decorations
  { type: "tree", category: "decoration", label: "Tree", icon: "tree-pine", defaultWidth: 30, defaultHeight: 60, color: "#166534", description: "Decorative tree" },
  { type: "rock", category: "decoration", label: "Rock", icon: "mountain", defaultWidth: 36, defaultHeight: 28, color: "#6b7280", description: "Decorative rock" },
  { type: "lamp", category: "decoration", label: "Lamp", icon: "lamp", defaultWidth: 16, defaultHeight: 48, color: "#fbbf24", description: "Adds light" },
  { type: "bush", category: "decoration", label: "Bush", icon: "leaf", defaultWidth: 32, defaultHeight: 24, color: "#15803d", description: "Decorative bush" },
  { type: "fence", category: "decoration", label: "Fence", icon: "grip-horizontal", defaultWidth: 80, defaultHeight: 28, color: "#92400e", description: "Wooden fence" },

  // Mechanics
  { type: "checkpoint", category: "mechanic", label: "Checkpoint", icon: "flag", defaultWidth: 40, defaultHeight: 40, color: "#22c55e", description: "Saves progress" },
  { type: "teleporter", category: "mechanic", label: "Teleporter", icon: "zap", defaultWidth: 36, defaultHeight: 44, color: "#8b5cf6", description: "Warps to another spot" },
  { type: "boost-pad", category: "mechanic", label: "Speed Pad", icon: "chevrons-right", defaultWidth: 60, defaultHeight: 12, color: "#06b6d4", description: "Speed boost" },
  { type: "coin", category: "mechanic", label: "Coin", icon: "coins", defaultWidth: 20, defaultHeight: 20, color: "#eab308", description: "Collectible coin" },
  { type: "gem", category: "mechanic", label: "Gem", icon: "diamond", defaultWidth: 20, defaultHeight: 20, color: "#8b5cf6", description: "Rare collectible" },
  { type: "spawn", category: "mechanic", label: "Spawn", icon: "user-plus", defaultWidth: 40, defaultHeight: 40, color: "#10b981", description: "Player spawn point" },

  // Structures (template-specific)
  { type: "house", category: "structure", label: "House", icon: "home", defaultWidth: 100, defaultHeight: 80, color: "#a0522d", description: "Walkable building" },
  { type: "shop-building", category: "structure", label: "Shop", icon: "store", defaultWidth: 80, defaultHeight: 70, color: "#daa520", description: "Item shop building" },
  { type: "cave", category: "structure", label: "Cave", icon: "mountain", defaultWidth: 120, defaultHeight: 60, color: "#4a4a4a", description: "Dark cave entrance" },
  { type: "tower", category: "structure", label: "Tower", icon: "building", defaultWidth: 40, defaultHeight: 120, color: "#808080", description: "Tall tower" },
  { type: "bridge", category: "structure", label: "Bridge", icon: "minus", defaultWidth: 150, defaultHeight: 20, color: "#8b7355", description: "Walkable bridge" },
  { type: "wall", category: "structure", label: "Wall", icon: "square", defaultWidth: 120, defaultHeight: 60, color: "#696969", description: "Barrier wall" },
  { type: "tunnel", category: "structure", label: "Tunnel", icon: "circle", defaultWidth: 60, defaultHeight: 60, color: "#555555", description: "Walk-through tunnel" },
  { type: "arena", category: "structure", label: "Arena", icon: "shield", defaultWidth: 120, defaultHeight: 120, color: "#8b0000", description: "Battle arena" },
  { type: "tycoon-plot", category: "structure", label: "Plot", icon: "grid-2x2", defaultWidth: 100, defaultHeight: 100, color: "#228b22", description: "Tycoon build plot" },
  { type: "machine", category: "structure", label: "Machine", icon: "cog", defaultWidth: 40, defaultHeight: 50, color: "#b0b0b0", description: "Tycoon dropper/machine" },
  { type: "dropper", category: "structure", label: "Dropper", icon: "arrow-down", defaultWidth: 40, defaultHeight: 60, color: "#a0a0a0", description: "Drops items onto conveyor" },
  { type: "conveyor-belt", category: "structure", label: "Conveyor", icon: "arrow-right", defaultWidth: 120, defaultHeight: 20, color: "#444444", description: "Moves items to collector" },
  { type: "collector", category: "structure", label: "Collector", icon: "coins", defaultWidth: 40, defaultHeight: 40, color: "#00cc00", description: "Sells items for cash" },
  { type: "upgrade-button", category: "structure", label: "Upgrade Pad", icon: "arrow-up", defaultWidth: 40, defaultHeight: 30, color: "#ffcc00", description: "Step on to buy upgrade" },
  { type: "race-track", category: "structure", label: "Track", icon: "route", defaultWidth: 200, defaultHeight: 30, color: "#333333", description: "Race track segment" },
  { type: "portal", category: "structure", label: "Portal", icon: "door-open", defaultWidth: 40, defaultHeight: 60, color: "#9400d3", description: "Zone teleporter" },
  { type: "market-stall", category: "structure", label: "Stall", icon: "tent", defaultWidth: 60, defaultHeight: 50, color: "#cd853f", description: "Market vendor stall" },
];

// ── Store ──

interface CanvasStore {
  elements: CanvasElement[];
  selectedId: string | null;
  tool: ToolMode;
  placingItem: PaletteItem | null;
  gridSnap: number;
  zoom: number;
  canvasOffset: { x: number; y: number };
  undoStack: CanvasElement[][];
  redoStack: CanvasElement[][];
  template: string;

  // Actions
  setTemplate: (template: string) => void;
  addElement: (item: PaletteItem, x: number, y: number) => void;
  removeElement: (id: string) => void;
  updateElement: (id: string, changes: Partial<CanvasElement>) => void;
  moveElement: (id: string, x: number, y: number) => void;
  selectElement: (id: string | null) => void;
  setTool: (tool: ToolMode) => void;
  setPlacingItem: (item: PaletteItem | null) => void;
  setZoom: (zoom: number) => void;
  setCanvasOffset: (offset: { x: number; y: number }) => void;
  duplicateElement: (id: string) => void;
  undo: () => void;
  redo: () => void;
  clearAll: () => void;
  getSelected: () => CanvasElement | null;
}

let idCounter = 0;
function nextId() {
  return `el_${++idCounter}_${Date.now()}`;
}

function snapToGrid(val: number, grid: number): number {
  return Math.round(val / grid) * grid;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  elements: [],
  selectedId: null,
  tool: "select",
  placingItem: null,
  gridSnap: 10,
  zoom: 1,
  canvasOffset: { x: 0, y: 0 },
  undoStack: [],
  redoStack: [],
  template: "obby",

  setTemplate: (template) => set({ template }),

  addElement: (item, x, y) => {
    const { elements, gridSnap, template } = get();
    const snappedX = snapToGrid(x, gridSnap);
    const snappedY = snapToGrid(y, gridSnap);
    const el: CanvasElement = {
      id: nextId(),
      type: item.type,
      category: item.category,
      label: item.label,
      icon: item.icon,
      x: snappedX,
      y: snappedY,
      width: item.defaultWidth,
      height: item.defaultHeight,
      color: item.color,
      rotation: 0,
      locked: false,
      visible: true,
      properties: {},
      logic: getDefaultLogic(item.type, template),
    };
    set({
      elements: [...elements, el],
      selectedId: el.id,
      undoStack: [...get().undoStack, elements],
      redoStack: [],
    });
  },

  removeElement: (id) => {
    const { elements } = get();
    set({
      elements: elements.filter((e) => e.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
      undoStack: [...get().undoStack, elements],
      redoStack: [],
    });
  },

  updateElement: (id, changes) => {
    const { elements } = get();
    set({
      elements: elements.map((e) => (e.id === id ? { ...e, ...changes } : e)),
      undoStack: [...get().undoStack, elements],
      redoStack: [],
    });
  },

  moveElement: (id, x, y) => {
    const { elements, gridSnap } = get();
    const snappedX = snapToGrid(x, gridSnap);
    const snappedY = snapToGrid(y, gridSnap);
    set({
      elements: elements.map((e) =>
        e.id === id ? { ...e, x: snappedX, y: snappedY } : e
      ),
    });
  },

  selectElement: (id) => set({ selectedId: id }),

  setTool: (tool) => set({ tool, placingItem: tool !== "place" ? null : get().placingItem }),

  setPlacingItem: (item) => set({ placingItem: item, tool: item ? "place" : "select" }),

  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(3, zoom)) }),

  setCanvasOffset: (offset) => set({ canvasOffset: offset }),

  duplicateElement: (id) => {
    const el = get().elements.find((e) => e.id === id);
    if (!el) return;
    const newEl: CanvasElement = {
      ...el,
      id: nextId(),
      x: el.x + 20,
      y: el.y + 20,
    };
    const { elements } = get();
    set({
      elements: [...elements, newEl],
      selectedId: newEl.id,
      undoStack: [...get().undoStack, elements],
      redoStack: [],
    });
  },

  undo: () => {
    const { undoStack, elements } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      elements: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, elements],
      selectedId: null,
    });
  },

  redo: () => {
    const { redoStack, elements } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      elements: next,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, elements],
      selectedId: null,
    });
  },

  clearAll: () => {
    const { elements } = get();
    set({
      elements: [],
      selectedId: null,
      undoStack: [...get().undoStack, elements],
      redoStack: [],
    });
  },

  getSelected: () => {
    const { elements, selectedId } = get();
    return elements.find((e) => e.id === selectedId) || null;
  },
}));
