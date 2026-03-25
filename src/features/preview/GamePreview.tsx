import { useState } from "react";
import { ChevronRight, ChevronDown, FileCode, Box, Folder, Map, List, Loader2 } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { StageMapView } from "./StageMapView";
import type { InstanceNode } from "../../types/project";

type PreviewTab = "map" | "tree";

export function GamePreview() {
  const { projectState } = useProjectStore();
  const [tab, setTab] = useState<PreviewTab>("map");

  if (!projectState) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-500">
        <Loader2 size={24} className="animate-spin text-indigo-400" />
        <p className="text-sm">Loading your game...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-gray-950">
      <div className="flex items-center justify-between border-b border-gray-800/40 px-4 py-3">
        <div className="flex items-center gap-1 rounded-xl bg-gray-800/60 p-1">
          <button
            onClick={() => setTab("map")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all ${
              tab === "map"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Map size={14} /> Game Map
          </button>
          <button
            onClick={() => setTab("tree")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all ${
              tab === "tree"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <List size={14} /> Parts List
          </button>
        </div>
        <span className="rounded-lg bg-gray-800/50 px-2.5 py-1 text-xs font-medium text-gray-400">
          {projectState.stageCount} stages
        </span>
      </div>

      {tab === "map" ? (
        <StageMapView />
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          <InstanceTreeNode node={projectState.hierarchy} depth={0} />
        </div>
      )}
    </div>
  );
}

function InstanceTreeNode({
  node,
  depth,
}: {
  node: InstanceNode;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isScript =
    node.className === "Script" ||
    node.className === "LocalScript" ||
    node.className === "ModuleScript";
  const isFolder = node.className === "Folder";

  const getIcon = () => {
    if (isScript) return <FileCode size={14} className="text-blue-400" />;
    if (isFolder) return <Folder size={14} className="text-yellow-400" />;
    if (node.className === "SpawnLocation")
      return <Box size={14} className="text-green-400" />;
    if (node.tags?.includes("KillBrick"))
      return <Box size={14} className="text-red-400" />;
    if (node.className === "Part")
      return <Box size={14} className="text-gray-400" />;
    return <Box size={14} className="text-gray-500" />;
  };

  const getClassColor = () => {
    if (node.className === "DataModel") return "text-gray-300";
    if (
      [
        "ServerScriptService",
        "ReplicatedStorage",
        "StarterPlayerScripts",
        "Workspace",
        "StarterGui",
        "Lighting",
        "SoundService",
      ].includes(node.className)
    )
      return "text-indigo-300";
    if (isScript) return "text-blue-300";
    if (node.className === "SpawnLocation") return "text-green-300";
    return "text-gray-400";
  };

  return (
    <div>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-gray-800/50`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown size={14} className="shrink-0 text-gray-500" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-gray-500" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {getIcon()}
        <span className={`font-medium ${getClassColor()}`}>{node.name}</span>
        <span className="ml-auto rounded bg-gray-800/60 px-1.5 py-0.5 text-[10px] text-gray-600">{node.className}</span>
      </button>
      {expanded &&
        hasChildren &&
        node.children.map((child, i) => (
          <InstanceTreeNode
            key={`${child.name}-${i}`}
            node={child}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}
