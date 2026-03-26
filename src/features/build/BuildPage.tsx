import { useState } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useUserStore } from "../../stores/userStore";
import { ChatPanel } from "../chat/ChatPanel";
import { VisualScenePreview } from "../preview/VisualScenePreview";
import { GamePreview } from "../preview/GamePreview";
import { GuidedWizard } from "./GuidedWizard";
import { ScriptEditor } from "./ScriptEditor";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Map, FileCode, Eye, MessageCircle, List } from "lucide-react";

type ViewTab = "world" | "map" | "code";

export function BuildPage() {
  const { project, projectState } = useProjectStore();
  const { profile } = useUserStore();
  const navigate = useNavigate();
  const [wizardDone, setWizardDone] = useState(false);
  const [viewTab, setViewTab] = useState<ViewTab>("world");

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

  const showWizard = profile.preferGuidedMode && !wizardDone;
  const isAdvanced = profile.experienceLevel === "advanced";

  return (
    <div className="flex h-full flex-col bg-gray-950">
      {/* Compact header */}
      <div className="flex items-center gap-3 border-b border-gray-800/40 px-4 py-2">
        <button
          onClick={() => navigate("/")}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white"
        >
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-[13px] font-bold text-white">{project.name}</h2>
        {projectState && projectState.stageCount > 0 && (
          <span className="rounded-md bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
            {projectState.stageCount} {project.template === "obby" ? "stages" : project.template === "rpg" ? "zones" : "parts"}
          </span>
        )}

        {/* View tabs */}
        <div className="ml-auto flex items-center gap-1 rounded-xl bg-gray-800/50 p-0.5">
          <button
            onClick={() => setViewTab("world")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
              viewTab === "world" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Eye size={12} /> World
          </button>
          <button
            onClick={() => setViewTab("map")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
              viewTab === "map" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <List size={12} /> Stages
          </button>
          {isAdvanced && (
            <button
              onClick={() => setViewTab("code")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
                viewTab === "code" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <FileCode size={12} /> Code
            </button>
          )}
        </div>
      </div>

      {/* Main area: Visual preview on top, chat/wizard below */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top: Game world visualization (dominant) */}
        <div className="relative flex-[3] border-b border-gray-800/40 overflow-hidden">
          {viewTab === "world" && <VisualScenePreview />}
          {viewTab === "map" && <GamePreview />}
          {viewTab === "code" && isAdvanced && <ScriptEditor projectPath={project.path} />}
        </div>

        {/* Bottom: Chat or Wizard (interaction layer) */}
        <div className="flex flex-[2] flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-800/30 px-4 py-1.5">
            <MessageCircle size={12} className="text-indigo-400" />
            <span className="text-[11px] font-bold text-gray-400">
              {showWizard ? "Game Setup" : "AI Builder"}
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            {showWizard ? (
              <GuidedWizard
                projectPath={project.path}
                templateType={project.template}
                onComplete={() => setWizardDone(true)}
              />
            ) : (
              <ChatPanel projectPath={project.path} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
