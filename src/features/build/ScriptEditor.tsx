import { useState, useEffect } from "react";
import { FileCode, Save, X, ChevronDown } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { projectCommands } from "../../services/tauriCommands";
import type { ScriptFile } from "../../types/project";

interface ScriptEditorProps {
  projectPath: string;
}

export function ScriptEditor({ projectPath }: ScriptEditorProps) {
  const { projectState, refreshProjectState } = useProjectStore();
  const scripts = projectState?.scripts ?? [];
  const [activeScript, setActiveScript] = useState<ScriptFile | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (scripts.length > 0 && !activeScript) {
      setActiveScript(scripts[0]);
      setEditedContent(scripts[0].content);
    }
  }, [scripts, activeScript]);

  const handleSelect = (script: ScriptFile) => {
    setActiveScript(script);
    setEditedContent(script.content);
    setIsDirty(false);
    setShowPicker(false);
  };

  const handleSave = async () => {
    if (!activeScript || !isDirty) return;
    setIsSaving(true);
    try {
      await projectCommands.writeFile(
        projectPath,
        activeScript.relativePath,
        editedContent,
      );
      setIsDirty(false);
      await refreshProjectState();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const typeColors: Record<string, string> = {
    server: "text-blue-400",
    client: "text-green-400",
    module: "text-purple-400",
  };

  const typeBadgeColors: Record<string, string> = {
    server: "bg-blue-900/50 text-blue-300",
    client: "bg-green-900/50 text-green-300",
    module: "bg-purple-900/50 text-purple-300",
  };

  if (scripts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        No scripts in this project yet.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Script selector bar */}
      <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-2">
        <FileCode size={14} className="shrink-0 text-indigo-400" />

        <div className="relative flex-1">
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="flex w-full items-center justify-between rounded-md bg-gray-800 px-3 py-1.5 text-left text-sm hover:bg-gray-750"
          >
            <div className="flex items-center gap-2">
              <span className={typeColors[activeScript?.scriptType ?? "module"]}>
                {activeScript?.name ?? "Select script"}
              </span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${typeBadgeColors[activeScript?.scriptType ?? "module"]}`}
              >
                {activeScript?.scriptType}
              </span>
            </div>
            <ChevronDown size={14} className="text-gray-500" />
          </button>

          {showPicker && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-xl">
              {scripts.map((script) => (
                <button
                  key={script.relativePath}
                  onClick={() => handleSelect(script)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-800 ${
                    activeScript?.relativePath === script.relativePath
                      ? "bg-gray-800"
                      : ""
                  }`}
                >
                  <span className={typeColors[script.scriptType]}>
                    {script.name}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${typeBadgeColors[script.scriptType]}`}
                  >
                    {script.scriptType}
                  </span>
                  <span className="ml-auto text-[10px] text-gray-600">
                    {script.relativePath}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {isDirty && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              <Save size={12} />
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                if (activeScript) {
                  setEditedContent(activeScript.content);
                  setIsDirty(false);
                }
              }}
              className="rounded-md p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {isDirty && (
          <span className="h-2 w-2 rounded-full bg-amber-500" title="Unsaved changes" />
        )}
      </div>

      {/* Editor area */}
      <div className="relative flex-1 overflow-hidden">
        {/* Line numbers + content */}
        <div className="flex h-full">
          {/* Line numbers */}
          <div className="flex shrink-0 flex-col overflow-hidden border-r border-gray-800 bg-gray-950 px-2 pt-3 text-right font-mono text-xs leading-5 text-gray-600 select-none">
            {editedContent.split("\n").map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>

          {/* Textarea */}
          <textarea
            value={editedContent}
            onChange={(e) => {
              setEditedContent(e.target.value);
              setIsDirty(true);
            }}
            onKeyDown={(e) => {
              // Ctrl+S to save
              if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                handleSave();
              }
              // Tab key inserts tab character
              if (e.key === "Tab") {
                e.preventDefault();
                const start = e.currentTarget.selectionStart;
                const end = e.currentTarget.selectionEnd;
                const value = e.currentTarget.value;
                setEditedContent(
                  value.substring(0, start) + "\t" + value.substring(end),
                );
                setIsDirty(true);
                // Restore cursor position after React re-render
                requestAnimationFrame(() => {
                  e.currentTarget.selectionStart = start + 1;
                  e.currentTarget.selectionEnd = start + 1;
                });
              }
            }}
            spellCheck={false}
            className="flex-1 resize-none bg-gray-950 px-3 pt-3 font-mono text-sm leading-5 text-gray-200 outline-none"
          />
        </div>

        {/* File path indicator */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-800 bg-gray-900/90 px-3 py-1 text-[10px] text-gray-500">
          {activeScript?.relativePath}
          {isDirty && " (modified)"}
        </div>
      </div>
    </div>
  );
}
