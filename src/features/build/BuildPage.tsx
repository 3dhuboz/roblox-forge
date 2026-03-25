import { useState } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useUserStore } from "../../stores/userStore";
import { ChatPanel } from "../chat/ChatPanel";
import { GamePreview } from "../preview/GamePreview";
import { GuidedWizard } from "./GuidedWizard";
import { ScriptEditor } from "./ScriptEditor";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Map, FileCode } from "lucide-react";

type RightTab = "map" | "code";

export function BuildPage() {
  const { project, projectState } = useProjectStore();
  const { profile } = useUserStore();
  const navigate = useNavigate();
  const [wizardDone, setWizardDone] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("map");

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
    <div className="flex h-full flex-col">
      {/* Simple header */}
      <div className="flex items-center gap-3 border-b border-gray-800/60 px-5 py-2.5">
        <button
          onClick={() => navigate("/")}
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-white">{project.name}</h2>
          {projectState && projectState.stageCount > 0 && (
            <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
              {projectState.stageCount} {project.template === "obby" ? "stages" : project.template === "rpg" ? "zones" : "parts"}
            </span>
          )}
        </div>

        {/* Only show code tab for intermediate+ users */}
        {isAdvanced && (
          <div className="ml-auto flex items-center gap-1 rounded-lg bg-gray-800/50 p-0.5">
            <button
              onClick={() => setRightTab("map")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium ${
                rightTab === "map" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Map size={12} /> Game Map
            </button>
            <button
              onClick={() => setRightTab("code")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium ${
                rightTab === "code" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <FileCode size={12} /> Code
            </button>
          </div>
        )}
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chat is always the main interaction */}
        <div className="flex flex-1 flex-col border-r border-gray-800/40">
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

        {/* Right: Game preview (always visible, code only for advanced) */}
        <div className="hidden w-[380px] flex-col lg:flex">
          {rightTab === "code" && isAdvanced ? (
            <ScriptEditor projectPath={project.path} />
          ) : (
            <GamePreview />
          )}
        </div>
      </div>
    </div>
  );
}
