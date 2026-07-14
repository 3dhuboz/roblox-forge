import { useState, useEffect, useRef, useCallback } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useNavigate } from "react-router-dom";
import { Map, ArrowLeft, Undo2, Redo2, Download, ZoomIn, ZoomOut, Save, Loader2, Check, AlertCircle, Play, MessageSquare, Code, DollarSign } from "lucide-react";
import { GameCanvas3D } from "../builder/GameCanvas3D";
import { AiSceneChat } from "../builder/AiSceneChat";
import { VisualScriptEditor } from "../builder/VisualScriptEditor";
import { MonetizationPanel } from "./MonetizationPanel";
import { InstanceExplorer } from "./InstanceExplorer";
import { PropertyInspector } from "./PropertyInspector";
import { useCanvasStore } from "../../stores/canvasStore";
import {
  buildCommands,
  isOperationUnavailableError,
} from "../../services/tauriCommands";
import { openPath } from "@tauri-apps/plugin-opener";
import { isTauriRuntime } from "../../lib/isTauriRuntime";

type BuildUiError = {
  scope: "export" | "studio";
  message: string;
  recoveryAction?: string;
};

type StudioState = "idle" | "opening" | "opened";

type ExportResult = Awaited<ReturnType<typeof buildCommands.buildProject>>;

type OwnedExportArtifact = {
  result: ExportResult;
  projectPath: string;
  exportAttemptId: number;
};

type BuildAttemptOwnership = {
  mounted: boolean;
  attemptId: number;
  currentAttemptId: number;
  projectPath: string | undefined;
  currentProjectPath: string | undefined;
};

export function isBuildAttemptCurrent({
  mounted,
  attemptId,
  currentAttemptId,
  projectPath,
  currentProjectPath,
}: BuildAttemptOwnership): boolean {
  return (
    mounted &&
    attemptId === currentAttemptId &&
    projectPath === currentProjectPath
  );
}

function toBuildUiError(
  scope: BuildUiError["scope"],
  error: unknown,
  fallbackMessage: string,
): BuildUiError {
  if (isOperationUnavailableError(error)) {
    return {
      scope,
      message: error.message,
      recoveryAction: error.receipt.recoveryAction,
    };
  }

  return {
    scope,
    message:
      error instanceof Error && error.message ? error.message : fallbackMessage,
  };
}

export function BuildPage() {
  const { project, projectState } = useProjectStore();
  const navigate = useNavigate();
  const { undo, redo, zoom, setZoom, elements, undoStack, redoStack, setTemplate, saveToProject, loadFromProject, isSaving, lastSavedAt } = useCanvasStore();
  const [sidebarTab, setSidebarTab] = useState<"chat" | "script" | "monetize">("chat");
  const [isExporting, setIsExporting] = useState(false);
  const [ownedExportArtifact, setOwnedExportArtifact] =
    useState<OwnedExportArtifact | null>(null);
  const [studioState, setStudioState] = useState<StudioState>("idle");
  const [uiError, setUiError] = useState<BuildUiError | null>(null);
  const exportInFlightRef = useRef(false);
  const studioInFlightRef = useRef(false);
  const exportAttemptIdRef = useRef(0);
  const studioAttemptIdRef = useRef(0);
  const ownedExportArtifactRef = useRef<OwnedExportArtifact | null>(null);
  const mountedRef = useRef(true);
  const projectPathRef = useRef(project?.path);

  const invalidateProjectOwnership = useCallback(
    (nextProjectPath: string | undefined) => {
      if (projectPathRef.current === nextProjectPath) return;

      projectPathRef.current = nextProjectPath;
      exportAttemptIdRef.current += 1;
      studioAttemptIdRef.current += 1;
      exportInFlightRef.current = false;
      studioInFlightRef.current = false;
      ownedExportArtifactRef.current = null;
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = useProjectStore.subscribe((state, previousState) => {
      const nextProjectPath = state.project?.path;
      if (nextProjectPath === previousState.project?.path) return;

      invalidateProjectOwnership(nextProjectPath);
      setIsExporting(false);
      setOwnedExportArtifact(null);
      setStudioState("idle");
      setUiError(null);
    });

    return () => {
      unsubscribe();
      mountedRef.current = false;
      exportInFlightRef.current = false;
      studioInFlightRef.current = false;
      exportAttemptIdRef.current += 1;
      studioAttemptIdRef.current += 1;
      ownedExportArtifactRef.current = null;
    };
  }, [invalidateProjectOwnership]);

  const handleExport = async () => {
    const currentProject = useProjectStore.getState().project;
    if (
      !project ||
      !currentProject ||
      project.path !== currentProject.path ||
      exportInFlightRef.current
    ) {
      return;
    }

    const projectPath = currentProject.path;
    const attemptId = ++exportAttemptIdRef.current;
    studioAttemptIdRef.current += 1;
    exportInFlightRef.current = true;
    studioInFlightRef.current = false;
    ownedExportArtifactRef.current = null;
    setIsExporting(true);
    setOwnedExportArtifact(null);
    setStudioState("idle");
    setUiError(null);

    const isCurrentAttempt = () =>
      isBuildAttemptCurrent({
        mounted: mountedRef.current,
        attemptId,
        currentAttemptId: exportAttemptIdRef.current,
        projectPath,
        currentProjectPath: useProjectStore.getState().project?.path,
      });

    try {
      const result = await buildCommands.buildProject(projectPath);
      if (isCurrentAttempt()) {
        const artifact: OwnedExportArtifact = {
          result,
          projectPath,
          exportAttemptId: attemptId,
        };
        ownedExportArtifactRef.current = artifact;
        setOwnedExportArtifact(artifact);
      }
    } catch (error) {
      if (isCurrentAttempt()) {
        setUiError(
          toBuildUiError(
            "export",
            error,
            "Export failed. Please try again.",
          ),
        );
      }
    } finally {
      if (isCurrentAttempt()) {
        exportInFlightRef.current = false;
        setIsExporting(false);
      }
    }
  };

  const handleOpenInStudio = async () => {
    if (exportInFlightRef.current || studioInFlightRef.current) return;

    const artifact = ownedExportArtifactRef.current;
    const currentProjectPath = useProjectStore.getState().project?.path;
    if (
      !artifact ||
      !isBuildAttemptCurrent({
        mounted: mountedRef.current,
        attemptId: artifact.exportAttemptId,
        currentAttemptId: exportAttemptIdRef.current,
        projectPath: artifact.projectPath,
        currentProjectPath,
      })
    ) {
      return;
    }

    const projectPath = artifact.projectPath;
    const rbxlPath = artifact.result.rbxlPath;
    const attemptId = ++studioAttemptIdRef.current;
    setUiError(null);

    if (!isTauriRuntime()) {
      setStudioState("idle");
      setUiError({
        scope: "studio",
        message:
          "Testing in Roblox Studio is unavailable in browser preview.",
        recoveryAction: "Open RobloxForge Desktop to test this game.",
      });
      return;
    }

    studioInFlightRef.current = true;
    setStudioState("opening");

    const isCurrentAttempt = () => {
      const studioAttemptIsCurrent = isBuildAttemptCurrent({
        mounted: mountedRef.current,
        attemptId,
        currentAttemptId: studioAttemptIdRef.current,
        projectPath,
        currentProjectPath: useProjectStore.getState().project?.path,
      });
      const artifactIsCurrent = isBuildAttemptCurrent({
        mounted: mountedRef.current,
        attemptId: artifact.exportAttemptId,
        currentAttemptId: exportAttemptIdRef.current,
        projectPath: artifact.projectPath,
        currentProjectPath: useProjectStore.getState().project?.path,
      });

      return (
        studioAttemptIsCurrent &&
        artifactIsCurrent &&
        !exportInFlightRef.current &&
        ownedExportArtifactRef.current === artifact
      );
    };

    try {
      await openPath(rbxlPath);
      if (isCurrentAttempt()) {
        setStudioState("opened");
      }
    } catch (error) {
      if (isCurrentAttempt()) {
        setStudioState("idle");
        setUiError(
          toBuildUiError(
            "studio",
            error,
            "Could not open Roblox Studio. Please try again.",
          ),
        );
      }
    } finally {
      if (isCurrentAttempt()) {
        studioInFlightRef.current = false;
      }
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

  const renderableExportArtifact =
    ownedExportArtifact !== null &&
    ownedExportArtifactRef.current === ownedExportArtifact &&
    isBuildAttemptCurrent({
      mounted: mountedRef.current,
      attemptId: ownedExportArtifact.exportAttemptId,
      currentAttemptId: exportAttemptIdRef.current,
      projectPath: ownedExportArtifact.projectPath,
      currentProjectPath: project?.path,
    })
      ? ownedExportArtifact
      : null;
  const exportResult = renderableExportArtifact?.result ?? null;

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
          ) : uiError?.scope === "export" ? (
            <AlertCircle size={13} />
          ) : (
            <Download size={13} />
          )}
          {isExporting ? "Building..." : exportResult ? "Exported!" : "Export to Roblox"}
        </button>
        {exportResult && (
          <button
            onClick={handleOpenInStudio}
            disabled={studioState === "opening"}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600/20 px-3 py-1.5 text-[11px] font-semibold text-blue-300 hover:bg-blue-600/30"
          >
            {studioState === "opening" ? (
              <Loader2 size={13} className="animate-spin" />
            ) : studioState === "opened" ? (
              <Check size={13} />
            ) : (
              <Play size={13} />
            )}
            {studioState === "opening"
              ? "Opening..."
              : studioState === "opened"
                ? "Opened in Studio"
                : "Test in Studio"}
          </button>
        )}
      </div>

      {uiError && (
        <div
          role="alert"
          className="border-b border-red-900/40 bg-red-950/40 px-4 py-2 text-xs text-red-200"
        >
          <div>{uiError.message}</div>
          {uiError.recoveryAction && (
            <div className="mt-1 text-red-300">{uiError.recoveryAction}</div>
          )}
        </div>
      )}

      {/* Main layout: Explorer + 3D viewport + sidebar + Properties */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Instance Explorer */}
        <InstanceExplorer />

        {/* Center: 3D Viewport + sidebar */}
        <div className="flex flex-1 overflow-hidden">
          <GameCanvas3D />

          {/* Right: Tabbed sidebar */}
          <div className="flex flex-col">
            {/* Tab buttons */}
            <div className="flex border-l border-b border-gray-800/40">
              <button
                onClick={() => setSidebarTab("chat")}
                className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold transition-colors ${
                  sidebarTab === "chat"
                    ? "border-b-2 border-indigo-500 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <MessageSquare size={12} /> AI Chat
              </button>
              <button
                onClick={() => setSidebarTab("script")}
                className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold transition-colors ${
                  sidebarTab === "script"
                    ? "border-b-2 border-indigo-500 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <Code size={12} /> Visual Script
              </button>
              <button
                onClick={() => setSidebarTab("monetize")}
                className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold transition-colors ${
                  sidebarTab === "monetize"
                    ? "border-b-2 border-green-500 text-white"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <DollarSign size={12} /> Monetize
              </button>
            </div>

            {/* Tab content */}
            {sidebarTab === "chat" ? (
              <AiSceneChat />
            ) : sidebarTab === "script" ? (
              <VisualScriptEditor projectPath={project.path} />
            ) : (
              <MonetizationPanel projectPath={project.path} />
            )}
          </div>
        </div>

        {/* Right: Property Inspector */}
        <PropertyInspector />
      </div>
    </div>
  );
}
