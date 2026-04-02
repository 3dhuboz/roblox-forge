import { useState, useRef, useEffect } from "react";
import { Search, Box, Folder, FileCode, Flag, ChevronRight, ChevronDown, Plus, Copy, Clipboard, Trash2, Edit3, X } from "lucide-react";
import { useInstanceStore } from "../../stores/instanceStore";
import { useProjectStore } from "../../stores/projectStore";
import type { InstanceNode } from "../../types/project";

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
  Terrain: "text-emerald-400",
};

interface TreeNodeProps {
  node: InstanceNode;
  path: string;
  depth: number;
  searchQuery: string;
}

function TreeNode({ node, path, depth, searchQuery }: TreeNodeProps) {
  const { selectedPath, expandedPaths, selectInstance, toggleExpand, renameInstance, deleteInstance, duplicateInstance, addChildInstance, copyInstance, pasteInstance, clipboard, reparentInstance } = useInstanceStore();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [showContext, setShowContext] = useState(false);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [dragOver, setDragOver] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);

  const isExpanded = expandedPaths.has(path);
  const isSelected = selectedPath === path;
  const hasChildren = node.children.length > 0;
  const Icon = CLASS_ICONS[node.className] || Box;
  const colorClass = CLASS_COLORS[node.className] || "text-gray-400";

  // Filter by search
  const matchesSearch = !searchQuery || node.name.toLowerCase().includes(searchQuery.toLowerCase()) || node.className.toLowerCase().includes(searchQuery.toLowerCase());
  const childrenMatchSearch = !searchQuery || node.children.some((c) => nodeOrDescendantMatches(c, searchQuery));

  if (searchQuery && !matchesSearch && !childrenMatchSearch) return null;

  const handleDoubleClick = () => {
    setIsRenaming(true);
    setRenameValue(node.name);
    setTimeout(() => renameRef.current?.select(), 0);
  };

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue !== node.name) {
      renameInstance(path, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextPos({ x: e.clientX, y: e.clientY });
    setShowContext(true);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", path);
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
    const sourcePath = e.dataTransfer.getData("text/plain");
    if (sourcePath && sourcePath !== path) {
      reparentInstance(sourcePath, path);
    }
  };

  // Close context menu on click outside
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
        onClick={() => { selectInstance(path); if (hasChildren) toggleExpand(path); }}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Expand arrow */}
        <span className="w-3 flex-shrink-0">
          {hasChildren ? (
            isExpanded ? <ChevronDown size={10} className="text-gray-500" /> : <ChevronRight size={10} className="text-gray-500" />
          ) : null}
        </span>

        {/* Class icon */}
        <Icon size={12} className={colorClass} />

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
          <span className="text-[11px] truncate">{node.name}</span>
        )}

        {/* Class badge */}
        <span className="text-[8px] text-gray-600 ml-auto mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {node.className}
        </span>
      </div>

      {/* Context Menu */}
      {showContext && (
        <ContextMenu
          x={contextPos.x}
          y={contextPos.y}
          path={path}
          node={node}
          hasClipboard={!!clipboard}
          onRename={() => { setShowContext(false); handleDoubleClick(); }}
          onDuplicate={() => { setShowContext(false); duplicateInstance(path); }}
          onDelete={() => { setShowContext(false); deleteInstance(path); }}
          onCopy={() => { setShowContext(false); copyInstance(path); }}
          onPaste={() => { setShowContext(false); pasteInstance(path); }}
          onAddChild={(className, name) => { setShowContext(false); addChildInstance(path, className, name); }}
          onClose={() => setShowContext(false)}
        />
      )}

      {/* Children */}
      {isExpanded && hasChildren && node.children.map((child, i) => (
        <TreeNode
          key={`${path}.${child.name}-${i}`}
          node={child}
          path={`${path}.${child.name}`}
          depth={depth + 1}
          searchQuery={searchQuery}
        />
      ))}
    </>
  );
}

function nodeOrDescendantMatches(node: InstanceNode, query: string): boolean {
  if (node.name.toLowerCase().includes(query.toLowerCase())) return true;
  if (node.className.toLowerCase().includes(query.toLowerCase())) return true;
  return node.children.some((c) => nodeOrDescendantMatches(c, query));
}

interface ContextMenuProps {
  x: number;
  y: number;
  path: string;
  node: InstanceNode;
  hasClipboard: boolean;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onAddChild: (className: string, name: string) => void;
  onClose: () => void;
}

function ContextMenu({ x, y, hasClipboard, onRename, onDuplicate, onDelete, onCopy, onPaste, onAddChild }: ContextMenuProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  const addOptions = [
    { className: "Folder", name: "NewFolder", icon: Folder, color: "text-yellow-400" },
    { className: "Part", name: "Part", icon: Box, color: "text-blue-400" },
    { className: "SpawnLocation", name: "SpawnLocation", icon: Flag, color: "text-green-400" },
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
                key={opt.className}
                onClick={() => onAddChild(opt.className, opt.name)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-gray-300 hover:bg-gray-800"
              >
                <opt.icon size={11} className={opt.color} /> {opt.className}
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
  const { hierarchy, setHierarchy, searchQuery, setSearchQuery, expandPath } = useInstanceStore();
  const { projectState } = useProjectStore();
  const [collapsed, setCollapsed] = useState(false);

  // Sync hierarchy from project state
  useEffect(() => {
    if (projectState?.hierarchy) {
      setHierarchy(projectState.hierarchy);
      // Auto-expand root + Workspace
      expandPath("root.Workspace");
    }
  }, [projectState?.hierarchy, setHierarchy, expandPath]);

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
    <div className="w-[220px] flex flex-col border-r border-gray-800/40 bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-800/40">
        <div className="flex items-center gap-1.5">
          <Folder size={12} className="text-yellow-400" />
          <span className="text-[11px] font-bold text-white">Explorer</span>
        </div>
        <button onClick={() => setCollapsed(true)} className="p-0.5 text-gray-600 hover:text-white">
          <X size={11} />
        </button>
      </div>

      {/* Search */}
      <div className="px-2 py-1.5 border-b border-gray-800/40">
        <div className="flex items-center gap-1.5 bg-gray-900 rounded px-2 py-1">
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

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {hierarchy ? (
          <TreeNode
            node={hierarchy}
            path="root"
            depth={0}
            searchQuery={searchQuery}
          />
        ) : (
          <div className="px-3 py-4 text-center text-[10px] text-gray-600">
            No project loaded
          </div>
        )}
      </div>
    </div>
  );
}
