import { useState } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useUserStore } from "../../stores/userStore";
import { ChatPanel } from "../chat/ChatPanel";
import { GamePreview } from "../preview/GamePreview";
import { GuidedWizard } from "./GuidedWizard";
import { ScriptEditor } from "./ScriptEditor";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wand2, MessageSquare, HelpCircle, FileCode, Eye } from "lucide-react";

type RightPanel = "preview" | "scripts";

export function BuildPage() {
  const { project, projectState } = useProjectStore();
  const { profile } = useUserStore();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"wizard" | "chat">(
    profile.preferGuidedMode ? "wizard" : "chat",
  );
  const [wizardDone, setWizardDone] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>("preview");

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-gray-400">
        <p className="text-lg">No project open.</p>
        <button
          onClick={() => navigate("/")}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500"
        >
          Pick a Template
        </button>
      </div>
    );
  }

  // Show guided wizard for beginners on first creation
  const showWizard = mode === "wizard" && !wizardDone;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-gray-800 px-6 py-3">
        <button
          onClick={() => navigate("/")}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          <ArrowLeft size={18} />
        </button>
        <h2 className="text-lg font-semibold">{project.name}</h2>
        <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs text-gray-400">
          {project.template}
        </span>
        {projectState && (
          <span className="rounded-full bg-indigo-900/50 px-2.5 py-0.5 text-xs text-indigo-300">
            {projectState.stageCount} stages
          </span>
        )}

        {/* Left panel mode toggle */}
        <div className="ml-auto flex items-center gap-1 rounded-lg bg-gray-800 p-1">
          <button
            onClick={() => { setMode("wizard"); setWizardDone(false); }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "wizard" && !wizardDone
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Wand2 size={14} /> Wizard
          </button>
          <button
            onClick={() => { setMode("chat"); setWizardDone(true); }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === "chat" || wizardDone
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <MessageSquare size={14} /> Chat
          </button>
        </div>

        {/* Right panel toggle */}
        <div className="flex items-center gap-1 rounded-lg bg-gray-800 p-1">
          <button
            onClick={() => setRightPanel("preview")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              rightPanel === "preview"
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Eye size={14} /> Preview
          </button>
          <button
            onClick={() => setRightPanel("scripts")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              rightPanel === "scripts"
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <FileCode size={14} /> Scripts
          </button>
        </div>

        {profile.showTooltips && (
          <button
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
            title="Help"
          >
            <HelpCircle size={18} />
          </button>
        )}
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Wizard or Chat */}
        <div className="flex w-1/2 flex-col border-r border-gray-800">
          {showWizard ? (
            <GuidedWizard
              projectPath={project.path}
              templateType={project.template}
              onComplete={() => {
                setWizardDone(true);
                setMode("chat");
              }}
            />
          ) : (
            <ChatPanel projectPath={project.path} />
          )}
        </div>

        {/* Right panel: Preview or Scripts */}
        <div className="flex w-1/2 flex-col">
          {rightPanel === "preview" ? (
            <GamePreview />
          ) : (
            <ScriptEditor projectPath={project.path} />
          )}
        </div>
      </div>
    </div>
  );
}
