import { useCallback, useRef } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { TriggerNode, ActionNode, LogicNode } from "./nodes/ScriptNode";
import { useVisualScriptStore } from "../../stores/visualScriptStore";
import { NODE_TYPE_LIST, NODE_CATEGORIES } from "../../lib/nodeTypes";
import { Play, Save, Trash2, Code } from "lucide-react";

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  logic: LogicNode,
};

export function VisualScriptEditor({ projectPath }: { projectPath: string }) {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    compiledCode,
    scriptName,
    setNodes: setStoreNodes,
    setEdges: setStoreEdges,
    setScriptName,
    addNode,
    compile,
    saveToProject,
    clearGraph,
  } = useVisualScriptStore();

  const [nodes, setNodes, onNodesChange] = useNodesState(storeNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(storeEdges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // Sync local state back to store on change
  const syncToStore = useCallback(() => {
    setStoreNodes(nodes);
    setStoreEdges(edges);
  }, [nodes, edges, setStoreNodes, setStoreEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
      setTimeout(syncToStore, 0);
    },
    [setEdges, syncToStore],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData("application/visualscript-node");
      if (!nodeType) return;

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const x = event.clientX - bounds.left - 80;
      const y = event.clientY - bounds.top - 20;

      addNode(nodeType, x, y);
    },
    [addNode],
  );

  const handleCompile = () => {
    // Sync current state first
    setStoreNodes(nodes);
    setStoreEdges(edges);
    // Small delay to let store update
    setTimeout(() => {
      compile();
    }, 10);
  };

  const handleSave = async () => {
    if (!compiledCode) {
      handleCompile();
      // Wait for compile, then save
      setTimeout(async () => {
        await saveToProject(projectPath);
      }, 50);
    } else {
      await saveToProject(projectPath);
    }
  };

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/visualscript-node", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex h-full w-80 flex-col border-l border-gray-800/40 bg-gray-950 lg:w-96">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-800/40 px-3 py-2">
        <Code size={14} className="text-indigo-400" />
        <input
          type="text"
          value={scriptName}
          onChange={(e) => setScriptName(e.target.value)}
          className="flex-1 bg-transparent text-[12px] font-bold text-white outline-none"
        />
        <button
          onClick={handleCompile}
          className="flex items-center gap-1 rounded bg-green-600/20 px-2 py-1 text-[10px] font-semibold text-green-300 hover:bg-green-600/30"
          title="Compile to Luau"
        >
          <Play size={10} /> Compile
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-1 rounded bg-blue-600/20 px-2 py-1 text-[10px] font-semibold text-blue-300 hover:bg-blue-600/30"
          title="Save script"
        >
          <Save size={10} /> Save
        </button>
        <button
          onClick={clearGraph}
          className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
          title="Clear all"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Node palette + canvas split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Node Palette */}
        <div className="w-36 shrink-0 overflow-y-auto border-r border-gray-800/40 p-2">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-gray-500">
            Drag to add
          </p>
          {NODE_CATEGORIES.map((cat) => (
            <div key={cat.id} className="mb-3">
              <p className={`mb-1 text-[9px] font-bold uppercase ${cat.color}`}>
                {cat.label}
              </p>
              {NODE_TYPE_LIST.filter((n) => n.category === cat.id).map(
                (nodeDef) => (
                  <div
                    key={nodeDef.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, nodeDef.type)}
                    className="mb-1 cursor-grab rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-[10px] text-gray-300 hover:border-gray-700 hover:bg-gray-800 active:cursor-grabbing"
                    title={nodeDef.description}
                  >
                    {nodeDef.label}
                  </div>
                ),
              )}
            </div>
          ))}
        </div>

        {/* Right: ReactFlow canvas + code preview */}
        <div className="flex flex-1 flex-col">
          {/* Graph canvas */}
          <div
            ref={reactFlowWrapper}
            className={`flex-1 ${compiledCode ? "h-1/2" : ""}`}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDragOver={onDragOver}
              onDrop={onDrop}
              nodeTypes={nodeTypes}
              fitView
              proOptions={{ hideAttribution: true }}
              colorMode="dark"
            >
              <Controls
                showInteractive={false}
                position="bottom-right"
                style={{ bottom: 8, right: 8 }}
              />
              <Background
                variant={BackgroundVariant.Dots}
                gap={16}
                size={1}
                color="#333"
              />
            </ReactFlow>
          </div>

          {/* Code preview (shown after compile) */}
          {compiledCode && (
            <div className="h-1/2 border-t border-gray-800/40 overflow-auto">
              <div className="sticky top-0 flex items-center gap-1.5 bg-gray-900 px-2 py-1 text-[9px] font-bold uppercase text-gray-500">
                <Code size={10} /> Generated Luau
              </div>
              <pre className="p-2 text-[10px] leading-relaxed text-gray-300 font-mono whitespace-pre-wrap">
                {compiledCode}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
