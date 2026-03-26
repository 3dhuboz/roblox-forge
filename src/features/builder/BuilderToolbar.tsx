import {
  MousePointer2,
  Move,
  Trash2,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Download,
  Eraser,
} from "lucide-react";
import { useCanvasStore, type ToolMode } from "../../stores/canvasStore";

const TOOLS: { mode: ToolMode; icon: React.ElementType; label: string; shortcut: string }[] = [
  { mode: "select", icon: MousePointer2, label: "Select", shortcut: "V" },
  { mode: "move", icon: Move, label: "Move", shortcut: "G" },
  { mode: "delete", icon: Trash2, label: "Delete", shortcut: "X" },
];

interface BuilderToolbarProps {
  onAiAssist: () => void;
  gameName: string;
}

export function BuilderToolbar({ onAiAssist, gameName }: BuilderToolbarProps) {
  const { tool, setTool, undo, redo, zoom, setZoom, clearAll, elements, undoStack, redoStack } = useCanvasStore();

  return (
    <div className="flex items-center gap-1 border-b border-gray-800/40 bg-gray-950 px-3 py-1.5">
      {/* Game name */}
      <div className="flex items-center gap-2 mr-3">
        <div className="h-5 w-5 rounded bg-gradient-to-br from-indigo-500 to-purple-600" />
        <span className="text-[13px] font-bold text-white truncate max-w-[140px]">{gameName}</span>
        <span className="rounded bg-gray-800/60 px-1.5 py-0.5 text-[10px] text-gray-400">
          {elements.length} parts
        </span>
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-gray-800 mx-1" />

      {/* Tools */}
      {TOOLS.map((t) => {
        const Icon = t.icon;
        const isActive = tool === t.mode;
        return (
          <button
            key={t.mode}
            onClick={() => setTool(t.mode)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
              isActive
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
            title={`${t.label} (${t.shortcut})`}
          >
            <Icon size={14} />
            {t.label}
          </button>
        );
      })}

      {/* Divider */}
      <div className="h-5 w-px bg-gray-800 mx-1" />

      {/* Undo / Redo */}
      <button
        onClick={undo}
        disabled={undoStack.length === 0}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={15} />
      </button>
      <button
        onClick={redo}
        disabled={redoStack.length === 0}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
        title="Redo (Ctrl+Y)"
      >
        <Redo2 size={15} />
      </button>

      {/* Divider */}
      <div className="h-5 w-px bg-gray-800 mx-1" />

      {/* Zoom */}
      <button
        onClick={() => setZoom(zoom - 0.15)}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
        title="Zoom Out"
      >
        <ZoomOut size={15} />
      </button>
      <span className="text-[11px] text-gray-500 w-10 text-center font-mono">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => setZoom(zoom + 0.15)}
        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
        title="Zoom In"
      >
        <ZoomIn size={15} />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Clear all */}
      <button
        onClick={clearAll}
        disabled={elements.length === 0}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-500 hover:bg-gray-800 hover:text-gray-300 disabled:opacity-30"
        title="Clear canvas"
      >
        <Eraser size={13} /> Clear
      </button>

      {/* AI Assist */}
      <button
        onClick={onAiAssist}
        className="flex items-center gap-1.5 rounded-lg bg-indigo-600/20 px-3 py-1.5 text-[11px] font-semibold text-indigo-300 hover:bg-indigo-600/30"
        title="Ask AI to help build"
      >
        <Sparkles size={13} /> AI Assist
      </button>

      {/* Export */}
      <button
        className="flex items-center gap-1.5 rounded-lg bg-green-600/20 px-3 py-1.5 text-[11px] font-semibold text-green-300 hover:bg-green-600/30"
        title="Export to Roblox"
      >
        <Download size={13} /> Export
      </button>
    </div>
  );
}
