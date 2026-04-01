import { useState } from "react";
import { ChevronRight, ChevronDown, Folder, Plus, Trash2, Copy } from "lucide-react";
import useInstanceStore, { GameInstance } from "../../stores/instanceStore";

// ── Helpers ────────────────────────────────────────────────────────────────

function deepCopyWithNewIds(instance: GameInstance): GameInstance {
  return {
    ...instance,
    id: crypto.randomUUID(),
    children: instance.children.map(deepCopyWithNewIds),
  };
}

function countAll(instances: GameInstance[]): number {
  return instances.reduce(
    (count, inst) => count + 1 + countAll(inst.children),
    0,
  );
}

// ── InstanceNode ───────────────────────────────────────────────────────────

interface InstanceNodeProps {
  instance: GameInstance;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (instance: GameInstance, parentId?: string) => void;
}

export function InstanceNode({
  instance,
  depth,
  selectedId,
  onSelect,
  onDelete,
  onDuplicate,
}: InstanceNodeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { expandNode, collapseNode } = useInstanceStore();

  const isSelected = selectedId === instance.id;
  const hasChildren = instance.children.length > 0;

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (instance.isExpanded) {
      collapseNode(instance.id);
    } else {
      expandNode(instance.id);
    }
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 pr-2 cursor-pointer rounded-md transition-colors ${
          isSelected
            ? "bg-indigo-600 text-white"
            : "text-gray-300 hover:bg-gray-800"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(instance.id)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Expand/collapse chevron */}
        <span
          className="flex w-4 flex-shrink-0 items-center"
          onClick={toggleExpand}
        >
          {hasChildren ? (
            instance.isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : null}
        </span>

        {/* Folder icon */}
        <Folder
          size={14}
          className={isSelected ? "text-indigo-200" : "text-yellow-400"}
        />

        {/* Instance name */}
        <span className="ml-1 flex-1 truncate text-[13px] font-medium">
          {instance.name}
        </span>

        {/* Action buttons revealed on hover */}
        {isHovered && (
          <div className="ml-1 flex items-center gap-0.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(instance);
              }}
              className="rounded p-0.5 text-gray-400 hover:bg-gray-700 hover:text-white"
              title="Duplicate"
            >
              <Copy size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(instance.id);
              }}
              className="rounded p-0.5 text-gray-400 hover:bg-red-800 hover:text-red-300"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      {instance.isExpanded && hasChildren && (
        <div>
          {instance.children.map((child) => (
            <InstanceNode
              key={child.id}
              instance={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              onDuplicate={(inst) => onDuplicate(inst, instance.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── InstanceExplorer ───────────────────────────────────────────────────────

const InstanceExplorer = () => {
  const { instances, addInstance, removeInstance } = useInstanceStore();
  const [newInstanceName, setNewInstanceName] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleAddInstance = () => {
    const name = newInstanceName.trim() || "NewInstance";
    addInstance({
      id: crypto.randomUUID(),
      name,
      children: [],
      isExpanded: false,
    });
    setNewInstanceName("");
  };

  const handleDelete = (id: string) => {
    removeInstance(id);
    if (selectedId === id) setSelectedId(null);
  };

  const handleDuplicate = (instance: GameInstance, parentId?: string) => {
    const copy = deepCopyWithNewIds(instance);
    copy.name = `${instance.name} (Copy)`;
    addInstance(copy, parentId);
  };

  const totalCount = countAll(instances);

  return (
    <div className="flex h-full flex-col bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          Explorer
        </span>
      </div>

      {/* Add instance input */}
      <div className="flex items-center gap-1.5 border-b border-gray-800 px-2 py-2">
        <input
          type="text"
          value={newInstanceName}
          onChange={(e) => setNewInstanceName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddInstance()}
          placeholder="New instance..."
          className="flex-1 rounded-md bg-gray-800 px-2 py-1 text-[12px] text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          onClick={handleAddInstance}
          className="flex items-center justify-center rounded-md bg-indigo-600 p-1 text-white hover:bg-indigo-500"
          title="Add Instance"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {instances.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <Folder size={32} className="mb-2 text-gray-600" />
            <p className="text-[12px] text-gray-500">No instances yet.</p>
            <p className="mt-1 text-[11px] text-gray-600">
              Add an instance above to get started.
            </p>
          </div>
        ) : (
          instances.map((instance) => (
            <InstanceNode
              key={instance.id}
              instance={instance}
              depth={0}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-800 px-3 py-1.5">
        <span className="text-[10px] text-gray-500">
          {totalCount} instance{totalCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
};

export default InstanceExplorer;