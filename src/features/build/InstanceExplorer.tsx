import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2, Copy, Box, Camera, Sun, Globe, FolderClosed, FileCode, Users, Monitor, Package, Shield, Volume2, Flag, Gamepad2, MessageSquare, Layers, Map } from "lucide-react";
import { useInstanceStore, type GameInstance } from "../../stores/instanceStore";

const DEFAULT_HIERARCHY: GameInstance[] = [
  {
    id: "datamodel",
    className: "DataModel",
    name: "Game",
    isExpanded: true,
    properties: {},
    children: [
      {
        id: "workspace",
        className: "Workspace",
        name: "Workspace",
        isExpanded: true,
        properties: {},
        children: [
          { id: "camera", className: "Camera", name: "Camera", isExpanded: false, properties: {}, children: [] },
          { id: "terrain", className: "Terrain", name: "Terrain", isExpanded: false, properties: {}, children: [] },
          { id: "baseplate", className: "Part", name: "Baseplate", isExpanded: false, properties: { Size: { Vector3: [512, 20, 512] }, CFrame: { CFrame: { position: [0, -10, 0], orientation: [1,0,0,0,1,0,0,0,1] } }, Color3uint8: { Color3uint8: [91, 154, 76] }, Material: { Enum: 1284 }, Anchored: { Bool: true } }, children: [] },
          { id: "spawnlocation", className: "SpawnLocation", name: "SpawnLocation", isExpanded: false, properties: { Size: { Vector3: [6, 1, 6] }, CFrame: { CFrame: { position: [0, 0.5, 0], orientation: [1,0,0,0,1,0,0,0,1] } }, Anchored: { Bool: true } }, children: [] },
        ],
      },
      { id: "players", className: "Players", name: "Players", isExpanded: false, properties: {}, children: [] },
      {
        id: "lighting", className: "Lighting", name: "Lighting", isExpanded: false, properties: {}, children: [
          { id: "atmosphere", className: "Atmosphere", name: "Atmosphere", isExpanded: false, properties: {}, children: [] },
          { id: "sky", className: "Sky", name: "Sky", isExpanded: false, properties: {}, children: [] },
        ],
      },
      { id: "replicated-first", className: "ReplicatedFirst", name: "ReplicatedFirst", isExpanded: false, properties: {}, children: [] },
      { id: "replicated-storage", className: "ReplicatedStorage", name: "ReplicatedStorage", isExpanded: false, properties: {}, children: [] },
      { id: "server-script-service", className: "ServerScriptService", name: "ServerScriptService", isExpanded: false, properties: {}, children: [] },
      { id: "server-storage", className: "ServerStorage", name: "ServerStorage", isExpanded: false, properties: {}, children: [] },
      { id: "starter-gui", className: "StarterGui", name: "StarterGui", isExpanded: false, properties: {}, children: [] },
      { id: "starter-pack", className: "StarterPack", name: "StarterPack", isExpanded: false, properties: {}, children: [] },
      {
        id: "starter-player", className: "StarterPlayer", name: "StarterPlayer", isExpanded: false, properties: {}, children: [
          { id: "starter-char-scripts", className: "StarterCharacterScripts", name: "StarterCharacterScripts", isExpanded: false, properties: {}, children: [] },
          { id: "starter-player-scripts", className: "StarterPlayerScripts", name: "StarterPlayerScripts", isExpanded: false, properties: {}, children: [] },
        ],
      },
      { id: "sound-service", className: "SoundService", name: "SoundService", isExpanded: false, properties: {}, children: [] },
      { id: "teams", className: "Teams", name: "Teams", isExpanded: false, properties: {}, children: [] },
      { id: "chat", className: "Chat", name: "Chat", isExpanded: false, properties: {}, children: [] },
    ],
  },
];

const CLASS_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  DataModel: Globe,
  Workspace: Map,
  Camera: Camera,
  Terrain: Layers,
  Part: Box,
  SpawnLocation: Flag,
  MeshPart: Box,
  WedgePart: Box,
  UnionOperation: Box,
  Model: Package,
  Folder: FolderClosed,
  Script: FileCode,
  LocalScript: FileCode,
  ModuleScript: FileCode,
  Players: Users,
  Lighting: Sun,
  Atmosphere: Sun,
  Sky: Sun,
  ReplicatedFirst: FolderClosed,
  ReplicatedStorage: FolderClosed,
  ServerScriptService: Shield,
  ServerStorage: Shield,
  StarterGui: Monitor,
  StarterPack: Gamepad2,
  StarterPlayer: Users,
  StarterCharacterScripts: FileCode,
  StarterPlayerScripts: FileCode,
  SoundService: Volume2,
  Teams: Users,
  Chat: MessageSquare,
};

const CLASS_ICON_COLORS: Record<string, string> = {
  DataModel: "text-blue-400",
  Workspace: "text-blue-400",
  Camera: "text-green-400",
  Terrain: "text-emerald-500",
  Part: "text-indigo-400",
  SpawnLocation: "text-green-400",
  Model: "text-orange-400",
  Folder: "text-yellow-400",
  Script: "text-blue-500",
  LocalScript: "text-blue-300",
  ModuleScript: "text-purple-400",
  Players: "text-blue-400",
  Lighting: "text-yellow-300",
  Atmosphere: "text-cyan-300",
  Sky: "text-sky-400",
  ReplicatedFirst: "text-yellow-400",
  ReplicatedStorage: "text-yellow-400",
  ServerScriptService: "text-red-400",
  ServerStorage: "text-red-400",
  StarterGui: "text-green-300",
  StarterPack: "text-green-400",
  StarterPlayer: "text-teal-400",
  StarterCharacterScripts: "text-blue-300",
  StarterPlayerScripts: "text-blue-300",
  SoundService: "text-purple-300",
  Teams: "text-blue-400",
  Chat: "text-gray-400",
};

const ADD_CLASS_OPTIONS = [
  "Part", "Model", "Folder", "Script", "LocalScript", "ModuleScript",
  "SpawnLocation", "MeshPart",
];

const DEFAULT_PROPERTIES: Record<string, Record<string, unknown>> = {
  Part: { Size: { Vector3: [4, 1, 2] }, Anchored: { Bool: true } },
  SpawnLocation: { Size: { Vector3: [6, 1, 6] }, Anchored: { Bool: true } },
};

interface InstanceNodeProps {
  instance: GameInstance;
  depth: number;
}

export function InstanceNode({ instance, depth }: InstanceNodeProps) {
  const { selectedId, selectInstance, toggleNode, removeInstance, duplicateInstance } = useInstanceStore();
  const [hovered, setHovered] = useState(false);

  const isSelected = selectedId === instance.id;
  const hasChildren = instance.children.length > 0;
  const IconComponent = CLASS_ICONS[instance.className] ?? Box;
  const iconColor = CLASS_ICON_COLORS[instance.className] ?? "text-indigo-400";

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
        <IconComponent size={12} className={`flex-shrink-0 mr-1 ${isSelected ? "text-indigo-200" : iconColor}`} />
        <span className="flex-1 truncate text-[12px]">{instance.name}</span>
        <span className="text-[9px] text-gray-500 ml-1 flex-shrink-0">{instance.className}</span>
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
  const [newClassName, setNewClassName] = useState("Part");

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
      className: newClassName,
      name,
      isExpanded: false,
      children: [],
      properties: DEFAULT_PROPERTIES[newClassName] ?? {},
    });
    setNewName("");
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800 w-[280px] flex-shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Explorer</span>
      </div>

      <div className="flex flex-col gap-1 px-2 py-1.5 border-b border-gray-800/60">
        <div className="flex items-center gap-1">
          <select
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            className="rounded bg-gray-800 px-1.5 py-1 text-[11px] text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
          >
            {ADD_CLASS_OPTIONS.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Name…"
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