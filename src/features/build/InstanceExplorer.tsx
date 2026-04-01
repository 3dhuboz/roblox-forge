import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, Copy, Box } from "lucide-react";
import { useInstanceStore, type GameInstance } from "../../stores/instanceStore";

const DEFAULT_HIERARCHY: GameInstance[] = [
  {
    id: "datamodel",
    name: "DataModel",
    isExpanded: true,
    children: [
      { id: "workspace", name: "Workspace", isExpanded: false, children: [] },
      { id: "lighting", name: "Lighting", isExpanded: false, children: [] },
      { id: "replicated-storage", name: "ReplicatedStorage", isExpanded: false, children: [] },
      { id: "starter-player", name: "StarterPlayer", isExpanded: false, children: [] },
      { id: "starter-gui", name: "StarterGui", isExpanded: false, children: [] },
      { id: "server-script-service", name: "ServerScriptService", isExpanded: false, children: [] },
      { id: "server-storage", name: "ServerStorage", isExpanded: false, children: [] },
    ],
  },
];

interface InstanceNodeProps {
  instance: GameInstance;
  depth: number;
}

export function InstanceNode({ instance, depth }: InstanceNodeProps) {
  const { selectedId, selectInstance, toggleNode, removeInstance, duplicateInstance } = useInstanceStore();
  const [hovered, setHovered] = useState(false);

  const isSelected = selectedId === instance.id;
  const hasChildren = instance.children.length > 0;

  return (
    <div>
      <div
        className={`flex items-center gap-1 cursor-pointer rounded px-1 py-0.5 group ${
          isSelected ? "bg-indigo-600 text-white" : "text-gray-300 hover:bg-gray-800"
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => selectInstance(isSelected ? null : instance.id)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-gray-500"
          onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleNode(instance.id); }}
        >
          {hasChildren ? (
            instance.isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : null}
        </span>
        <Box size={12} className={`flex-shrink-0 mr-1 ${isSelected ? "text-indigo-200" : "text-indigo-400"}`} />
        <span className="flex-1 truncate text-[12px]">{instance.name}</span>
        {hovered && (
          <span className="flex items-center gap-0.5 ml-1">
            <button
              className="rounded p-0.5 hover:bg-indigo-500/40 hover:text-white text-gray-400"
              onClick={(e) => { e.stopPropagation(); duplicateInstance(instance.id); }}
              title="Duplicate"
            >
              <Copy size={11} />
            </button>
            <button
              className="rounded p-0.5 hover:bg-red-600/40 hover:text-red-300 text-gray-400"
              onClick={(e) => { e.stopPropagation(); removeInstance(instance.id); }}
              title="Delete"
            >
              <Trash2 size={11} />
            </button>
          </span>
        )}
      </div>
      {instance.isExpanded && instance.children.map((child) => (
        <InstanceNode key={child.id} instance={child} depth={depth + 1} />
      ))}
    </div>
  );
}

export function InstanceExplorer() {
  const { instances, addInstance, countInstances, loadFromHierarchy } = useInstanceStore();
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (instances.length === 0) {
      loadFromHierarchy(DEFAULT_HIERARCHY);
    }
  }, []);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addInstance({
      id: `inst_${Date.now()}`,
      name,
      isExpanded: false,
      children: [],
    });
    setNewName("");
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800 w-[280px] flex-shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Explorer</span>
      </div>

      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-800/60">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="New instance…"
          className="flex-1 min-w-0 rounded bg-gray-800 px-2 py-1 text-[11px] text-white placeholder-gray-500 border border-gray-700 focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleAdd}
          disabled={!newName.trim()}
          className="rounded bg-indigo-600 px-2 py-1 text-white hover:bg-indigo-500 disabled:opacity-40"
          title="Add instance"
        >
          <Plus size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 text-[12px] gap-2 py-8">
            <Box size={24} />
            <span>No instances yet</span>
          </div>
        ) : (
          instances.map((inst) => (
            <InstanceNode key={inst.id} instance={inst} depth={0} />
          ))
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-gray-800 text-[10px] text-gray-500">
        {countInstances()} instance{countInstances() !== 1 ? "s" : ""}
      </div>
    </div>
  );
}