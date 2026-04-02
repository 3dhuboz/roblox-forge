import { useState, useRef, useEffect } from "react";
import { Search, Box, Folder, FileCode, Flag, ChevronRight, ChevronDown, Plus, Copy, Clipboard, Trash2, Edit3, X } from "lucide-react";
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

const CLASS_ICONS: Record<string, typeof Box> = {
  Part: Box,
  SpawnLocation: Flag,
  Folder: Folder,
  Script: FileCode,
  LocalScript: FileCode,
  ModuleScript: FileCode,
};

const CLASS_COLORS: Record<string, string> = {
  Part: "text-blue-400",
  SpawnLocation: "text-green-400",
  Folder: "text-yellow-400",
  Script: "text-red-400",
  LocalScript: "text-purple-400",
  ModuleScript: "text-orange-400",
};

function getIconForName(name: string) {
  if (name.includes("Script") || name.includes("Handler") || name.includes("Manager")) return { Icon: FileCode, color: "text-red-400" };
  if (name.includes("Spawn")) return { Icon: Flag, color: "text-green-400" };
  if (name === "Workspace" || name === "Lighting" || name === "SoundService") return { Icon: Folder, color: "text-yellow-400" };
  if (name.includes("Storage") || name.includes("Starter") || name.includes("Service")) return { Icon: Folder, color: "text-yellow-400" };
  return { Icon: Box, color: "text-blue-400" };
}

function instanceMatchesSearch(inst: GameInstance, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (inst.name.toLowerCase().includes(q)) return true;
  return inst.children.some((c) => instanceMatchesSearch(c, q));
}

interface TreeNodeProps {
  instance: GameInstance;
  depth: number;
  searchQuery: string;
}

function TreeNode({ instance, depth, searchQuery }: TreeNodeProps) {
  const { selectedId, selectInstance, toggleNode, removeInstance, duplicateInstance, renameInstance, copyInstance, pasteInstance, reparentInstance, clipboard } = useInstanceStore();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(instance.name);
  const [showContext, setShowContext] = useState(false);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [hovered, setHovered] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  const isSelected = selectedId === instance.id;
  const hasChildren = instance.children.length > 0;
  const { Icon, color } = getIconForName(instance.name);

  if (searchQuery && !instanceMatchesSearch(instance, searchQuery)) return null;

  const handleDoubleClick = () => {
    setIsRenaming(true);
    setRenameValue(instance.name);
    setTimeout(() => renameRef.current?.select(), 0);
  };

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue !== instance.name) {
      renameInstance(instance.id, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextPos({ x: e.clientX, y: e.clientY });
    setShowContext(true);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", instance.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const sourceId = e.dataTransfer.getData("text/plain");
    if (sourceId && sourceId !== instance.id) {
      reparentInstance(sourceId, instance.id);
    }
  };

  useEffect(() => {
    if (!showContext) return;
    const handler = () => setShowContext(false);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [showContext]);

  return (
    <>
      <div
        className={`flex items-center gap-1 cursor-pointer select-none group ${
          isSelected ? "bg-indigo-600/20 text-white" : "text-gray-300 hover:bg-gray-800/40"
        } ${dragOver ? "ring-1 ring-indigo-500 bg-indigo-900/20" : ""}`}
        style={{ paddingLeft: depth * 16 + 4 }}
        onClick={() => { selectInstance(isSelected ? null : instance.id); }}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Expand arrow */}
        <span
          className="w-3 flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleNode(instance.id); }}
        >
          {hasChildren ? (
            instance.isExpanded ? <ChevronDown size={10} className="text-gray-500" /> : <ChevronRight size={10} className="text-gray-500" />
          ) : null}
        </span>

        {/* Class icon */}
        <Icon size={12} className={color} />

        {/* Name */}
        {isRenaming ? (
          <input
            ref={renameRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => { if (e.key === "Enter") handleRenameSubmit(); if (e.key === "Escape") setIsRenaming(false); }}
            className="flex-1 bg-gray-800 border border-indigo-500 rounded px-1 py-0 text-[11px] text-white outline-none"
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <span className="text-[11px] truncate flex-1">{instance.name}</span>
        )}

        {/* Hover actions */}
        {hovered && !isRenaming && (
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

      {/* Context Menu */}
      {showContext && (
        <ContextMenu
          x={contextPos.x}
          y={contextPos.y}
          instanceId={instance.id}
          hasClipboard={!!clipboard}
          onRename={() => { setShowContext(false); handleDoubleClick(); }}
          onDuplicate={() => { setShowContext(false); duplicateInstance(instance.id); }}
          onDelete={() => { setShowContext(false); removeInstance(instance.id); }}
          onCopy={() => { setShowContext(false); copyInstance(instance.id); }}
          onPaste={() => { setShowContext(false); pasteInstance(instance.id); }}
          onAddChild={(name) => {
            setShowContext(false);
            const { addInstance } = useInstanceStore.getState();
            addInstance({ id: `inst_${Date.now()}`, name, isExpanded: false, children: [] }, instance.id);
          }}
        />
      )}

      {/* Children */}
      {instance.isExpanded && instance.children.map((child) => (
        <TreeNode key={child.id} instance={child} depth={depth + 1} searchQuery={searchQuery} />
      ))}
    </>
  );
}

interface ContextMenuProps {
  x: number;
  y: number;
  instanceId: string;
  hasClipboard: boolean;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onAddChild: (name: string) => void;
}

function ContextMenu({ x, y, hasClipboard, onRename, onDuplicate, onDelete, onCopy, onPaste, onAddChild }: ContextMenuProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  const addOptions = [
    { name: "NewFolder", icon: Folder, color: "text-yellow-400", label: "Folder" },
    { name: "Part", icon: Box, color: "text-blue-400", label: "Part" },
    { name: "SpawnLocation", icon: Flag, color: "text-green-400", label: "SpawnLocation" },
  ];

  return (
    <div
      className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onRename} className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800">
        <Edit3 size={11} /> Rename
      </button>
      <button onClick={onDuplicate} className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800">
        <Copy size={11} /> Duplicate
      </button>
      <button onClick={onCopy} className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800">
        <Copy size={11} /> Copy
      </button>
      {hasClipboard && (
        <button onClick={onPaste} className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800">
          <Clipboard size={11} /> Paste
        </button>
      )}

      <div className="h-px bg-gray-800 my-1" />

      <div className="relative">
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800"
        >
          <Plus size={11} /> Add Child
          <ChevronRight size={10} className="ml-auto" />
        </button>
        {showAddMenu && (
          <div className="absolute left-full top-0 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[140px]">
            {addOptions.map((opt) => (
              <button
                key={opt.name}
                onClick={() => onAddChild(opt.name)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800"
              >
                <opt.icon size={11} className={opt.color} /> {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-px bg-gray-800 my-1" />

      <button onClick={onDelete} className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-red-400 hover:bg-red-900/20">
        <Trash2 size={11} /> Delete
      </button>
    </div>
  );
}

export function InstanceExplorer() {
  const { instances, searchQuery, setSearchQuery, addInstance, countInstances, loadFromHierarchy } = useInstanceStore();
  const [collapsed, setCollapsed] = useState(false);
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

  if (collapsed) {
    return (
      <div className="w-8 border-r border-gray-800/40 bg-gray-950 flex flex-col items-center pt-2">
        <button onClick={() => setCollapsed(false)} className="p-1 text-gray-500 hover:text-white" title="Show Explorer">
          <Folder size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800 w-[220px] flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-800">
        <div className="flex items-center gap-1.5">
          <Folder size={12} className="text-yellow-400" />
          <span className="text-[11px] font-bold text-white">Explorer</span>
        </div>
        <button onClick={() => setCollapsed(true)} className="p-0.5 text-gray-600 hover:text-white">
          <X size={11} />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-gray-800/60">
        <div className="flex items-center gap-1.5 bg-gray-800 rounded px-2 py-1">
          <Search size={10} className="text-gray-500" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter..."
            className="flex-1 bg-transparent text-[10px] text-white outline-none placeholder-gray-600"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-gray-500 hover:text-white">
              <X size={9} />
            </button>
          )}
        </div>
      </div>

      {/* Add instance bar */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-800/60">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="New instance..."
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

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 text-[12px] gap-2 py-8">
            <Box size={24} />
            <span>No instances yet</span>
          </div>
        ) : (
          instances.map((inst) => (
            <TreeNode key={inst.id} instance={inst} depth={0} searchQuery={searchQuery} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-gray-800 text-[10px] text-gray-500">
        {countInstances()} instance{countInstances() !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
