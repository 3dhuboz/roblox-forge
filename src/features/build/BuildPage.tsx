import { useState } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { useNavigate } from "react-router-dom";
import { Map, Sparkles, X } from "lucide-react";
import { ElementPalette } from "../builder/ElementPalette";
import { GameCanvas } from "../builder/GameCanvas";
import { PropertiesPanel } from "../builder/PropertiesPanel";
import { BuilderToolbar } from "../builder/BuilderToolbar";
import { ChatPanel } from "../chat/ChatPanel";

export function BuildPage() {
  const { project } = useProjectStore();
  const navigate = useNavigate();
  const [aiOpen, setAiOpen] = useState(false);

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

  return (
    <div className="flex h-full flex-col bg-gray-950">
      {/* Toolbar */}
      <BuilderToolbar
        gameName={project.name}
        onAiAssist={() => setAiOpen(!aiOpen)}
      />

      {/* Main studio layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Element Palette (Toolbox) */}
        <ElementPalette />

        {/* Center: Game Canvas (Viewport) */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <GameCanvas />

          {/* AI Assist drawer (collapsible from bottom) */}
          {aiOpen && (
            <div className="flex flex-col border-t border-gray-800/40" style={{ height: "280px" }}>
              <div className="flex items-center justify-between border-b border-gray-800/30 px-4 py-1.5">
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-indigo-400" />
                  <span className="text-[11px] font-bold text-gray-400">AI Assistant</span>
                </div>
                <button
                  onClick={() => setAiOpen(false)}
                  className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-white"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatPanel projectPath={project.path} />
              </div>
            </div>
          )}
        </div>

        {/* Right: Properties Panel */}
        <PropertiesPanel />
      </div>
    </div>
  );
}
