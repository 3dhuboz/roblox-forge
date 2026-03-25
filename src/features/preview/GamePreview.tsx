import { useState } from "react";
import { ChevronRight, ChevronDown, FileCode, Box, Folder, Map, List } from "lucide-react";
import { useProjectStore } from "../../stores/projectStore";
import { StageMapView } from "./StageMapView";
import type { InstanceNode } from "../../types/project";

type PreviewTab = "map" | "tree";

export function GamePreview() {
  const { projectState } = useProjectStore();
  const [tab, setTab] = useState<PreviewTab>("map");

  if (!projectState) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        <p>Loading project...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-1 rounded-lg bg-gray-800 p-0.5">
          <button
            onClick={() => setTab("map")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "map"
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Map size={13} /> Map
          </button>
          <button
            onClick={() => setTab("tree")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === "tree"
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <List size={13} /> Tree
          </button>
        </div>
        <span className="text-xs text-gray-500">
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
        className={`flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm hover:bg-gray-800/50`}
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
        <span className={getClassColor()}>{node.name}</span>
        <span className="ml-auto text-xs text-gray-600">{node.className}</span>
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
