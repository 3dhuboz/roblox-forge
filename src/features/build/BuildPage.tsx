import { useState, useEffect, useRef, useCallback } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useNavigate } from "react-router-dom";
import { Map, ArrowLeft, Undo2, Redo2, Download, ZoomIn, ZoomOut, Save, Loader2, Check, AlertCircle } from "lucide-react";
import { GameCanvas3D } from "../builder/GameCanvas3D";
import { AiSceneChat } from "../builder/AiSceneChat";
import { useCanvasStore } from "../../stores/canvasStore";
import { buildCommands } from "../../services/tauriCommands";

export function BuildPage() {
  const { project, projectState, refreshProjectState } = useProjectStore();
  const navigate = useNavigate();
  const { undo, redo, zoom, setZoom, elements, undoStack, redoStack, setTemplate, saveToProject, loadFromProject, isSaving, lastSavedAt } = useCanvasStore();
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ rbxlPath: string; warnings: string[] } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!project || isExporting) return;
    setIsExporting(true);
    setExportError(null);
    setExportResult(null);
    try {
      const result = await buildCommands.buildProject(project.path);
      setExportResult(result);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsExporting(false);
    }
  };

  // Sync template to canvas store so game logic is template-aware
  useEffect(() => {
    if (project?.template) setTemplate(project.template);
  }, [project?.template, setTemplate]);

  // Load real project state into canvas preview
  useEffect(() => {
    if (projectState?.hierarchy && project?.template) {
      loadFromProject(projectState.hierarchy, project.template);
    }
  }, [projectState?.hierarchy, project?.template, loadFromProject]);

  // Auto-save canvas to project files when elements change (debounced)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSave = useCallback(() => {
    if (!project) return;
    saveToProject(project.path);
  }, [project, saveToProject]);

  useEffect(() => {
    if (!project || elements.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(handleSave, 2000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [elements, project, handleSave]);

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-600/20">
          <Map size={40} className="text-indigo-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">No game yet</h2>
          <p className="mt-2 text-gray-400">Pick a game type to start building!</p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500"
        >
          Choose a Game Type
        </button>
      </div>
    );
  }

  const savedRecently = lastSavedAt && Date.now() - lastSavedAt < 3000;

  return (
    <div className="flex h-full flex-col bg-gray-950">
      {/* Compact toolbar */}
      <div className="flex items-center gap-2 border-b border-gray-800/40 bg-gray-950 px-3 py-1.5">
        <button onClick={() => navigate("/")} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white">
          <ArrowLeft size={16} />
        </button>
        <div className="h-5 w-5 rounded bg-gradient-to-br from-indigo-500 to-purple-600" />
        <span className="text-[13px] font-bold text-white">{project.name}</span>
        <span className="rounded bg-gray-800/60 px-1.5 py-0.5 text-[10px] text-gray-400">{elements.length} parts</span>

        <div className="h-4 w-px bg-gray-800 mx-1" />

        <button onClick={undo} disabled={undoStack.length === 0} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-30" title="Undo">
          <Undo2 size={14} />
        </button>
        <button onClick={redo} disabled={redoStack.length === 0} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-30" title="Redo">
          <Redo2 size={14} />
        </button>

        <div className="h-4 w-px bg-gray-800 mx-1" />

        <button onClick={() => setZoom(zoom - 0.15)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"><ZoomOut size={14} /></button>
        <span className="text-[10px] text-gray-500 w-8 text-center font-mono">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(zoom + 0.15)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"><ZoomIn size={14} /></button>

        <div className="h-4 w-px bg-gray-800 mx-1" />

        <button
          onClick={handleSave}
          disabled={isSaving || elements.length === 0}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-gray-400 hover:bg-gray-800 hover:text-white disabled:opacity-30"
          title="Save to project"
        >
          {isSaving ? (
            <Loader2 size={13} className="animate-spin" />
          ) : savedRecently ? (
            <Check size={13} className="text-green-400" />
          ) : (
            <Save size={13} />
          )}
          {isSaving ? "Saving..." : savedRecently ? "Saved" : "Save"}
        </button>

        <div className="flex-1" />

        <button
          onClick={handleExport}
          disabled={isExporting || elements.length === 0}
          className="flex items-center gap-1.5 rounded-lg bg-green-600/20 px-3 py-1.5 text-[11px] font-semibold text-green-300 hover:bg-green-600/30 disabled:opacity-40"
        >
          {isExporting ? (
            <Loader2 size={13} className="animate-spin" />
          ) : exportResult ? (
            <Check size={13} />
          ) : exportError ? (
            <AlertCircle size={13} />
          ) : (
            <Download size={13} />
          )}
          {isExporting ? "Building..." : exportResult ? "Exported!" : "Export to Roblox"}
        </button>
      </div>

      {/* Main layout: 3D viewport + AI chat */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: 3D Viewport (primary) */}
        <GameCanvas3D />

        {/* Right: AI Chat Sidebar */}
        <AiSceneChat projectPath={project.path} />
      </div>
    </div>
  );
}
