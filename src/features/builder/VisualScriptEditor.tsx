import { useCallback, useRef, useEffect, useState } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  addEdge,
  type Connection,
  type OnNodesChange,
  type OnEdgesChange,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { TriggerNode, ActionNode, LogicNode } from "./nodes/ScriptNode";
import { useVisualScriptStore, canConnect } from "../../stores/visualScriptStore";
import { NODE_TYPES, NODE_TYPE_LIST, NODE_CATEGORIES } from "../../lib/nodeTypes";
import { Play, Save, Trash2, Code, Plus, X, Search } from "lucide-react";

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  logic: LogicNode,
};

export function VisualScriptEditor({ projectPath }: { projectPath: string }) {
  const {
    nodes,
    edges,
    compiledCode,
    scriptName,
    graphs,
    activeGraphIndex,
    setNodes,
    setEdges,
    setScriptName,
    addNode,
    compile,
    saveToProject,
    saveGraphJson,
    clearGraph,
    addGraph,
    switchGraph,
    removeGraph,
    loadGraphJson,
  } = useVisualScriptStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [paletteSearch, setPaletteSearch] = useState("");

  // Load saved graph on mount / when project changes
  useEffect(() => {
    loadGraphJson(projectPath);
  }, [projectPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // ReactFlow change handlers — write directly to store
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes(applyNodeChanges(changes, nodes) as typeof nodes);
    },
    [nodes, setNodes],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setEdges(applyEdgeChanges(changes, edges) as typeof edges);
    },
    [edges, setEdges],
  );

  // Validate connection: check port type compatibility
  const isValidConnection = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return false;

      const sourceDef = NODE_TYPES[sourceNode.data.nodeType];
      const targetDef = NODE_TYPES[targetNode.data.nodeType];
      if (!sourceDef || !targetDef) return false;

      const sourcePort = sourceDef.outputs.find((p) => p.id === connection.sourceHandle);
      const targetPort = targetDef.inputs.find((p) => p.id === connection.targetHandle);
      if (!sourcePort || !targetPort) return false;

      return canConnect(sourcePort.type, targetPort.type);
    },
    [nodes],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges(addEdge({ ...connection, animated: true }, edges));
    },
    [edges, setEdges],
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
    compile();
  };

  const handleSave = async () => {
    compile();
    // Small delay for compile to finish, then save both Luau and JSON
    setTimeout(async () => {
      await saveToProject(projectPath);
      await saveGraphJson(projectPath);
    }, 20);
  };

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/visualscript-node", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex h-full w-80 flex-col border-l border-gray-800/40 bg-gray-950 lg:w-96">
      {/* Script tabs */}
      <div className="flex items-center border-b border-gray-800/40 overflow-x-auto">
        {graphs.map((g, i) => (
          <button
            key={i}
            onClick={() => switchGraph(i)}
            className={`flex shrink-0 items-center gap-1 px-3 py-1.5 text-[10px] font-medium border-b-2 transition-colors ${
              i === activeGraphIndex
                ? "border-indigo-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {g.name}
            {graphs.length > 1 && (
              <span
                onClick={(e) => { e.stopPropagation(); removeGraph(i); }}
                className="ml-1 rounded p-0.5 text-gray-600 hover:bg-gray-800 hover:text-gray-400"
              >
                <X size={8} />
              </span>
            )}
          </button>
        ))}
        <button
          onClick={addGraph}
          className="shrink-0 p-1.5 text-gray-600 hover:text-gray-300"
          title="New script"
        >
          <Plus size={12} />
        </button>
      </div>

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
          title="Save script + graph"
        >
          <Save size={10} /> Save
        </button>
        <button
          onClick={clearGraph}
          className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
          title="Clear all nodes"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Node palette + canvas split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Node Palette */}
        <div className="w-36 shrink-0 overflow-y-auto border-r border-gray-800/40 p-2">
          {/* Search */}
          <div className="mb-2 flex items-center gap-1 rounded border border-gray-800 bg-gray-900 px-1.5 py-1">
            <Search size={9} className="shrink-0 text-gray-600" />
            <input
              type="text"
              value={paletteSearch}
              onChange={(e) => setPaletteSearch(e.target.value)}
              placeholder="Search…"
              className="w-full bg-transparent text-[10px] text-gray-300 outline-none placeholder:text-gray-600"
            />
            {paletteSearch && (
              <button onClick={() => setPaletteSearch("")} className="shrink-0 text-gray-600 hover:text-gray-400">
                <X size={9} />
              </button>
            )}
          </div>
          {NODE_CATEGORIES.map((cat) => {
            const items = NODE_TYPE_LIST.filter(
              (n) =>
                n.category === cat.id &&
                (!paletteSearch ||
                  n.label.toLowerCase().includes(paletteSearch.toLowerCase()) ||
                  n.description.toLowerCase().includes(paletteSearch.toLowerCase())),
            );
            if (items.length === 0) return null;
            return (
              <div key={cat.id} className="mb-3">
                <p className={`mb-1 text-[9px] font-bold uppercase ${cat.color}`}>
                  {cat.label}
                </p>
                {items.map((nodeDef) => (
                  <div
                    key={nodeDef.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, nodeDef.type)}
                    className="mb-1 cursor-grab rounded border border-gray-800 bg-gray-900 px-2 py-1.5 text-[10px] text-gray-300 hover:border-gray-700 hover:bg-gray-800 active:cursor-grabbing"
                    title={nodeDef.description}
                  >
                    {nodeDef.label}
                  </div>
                ))}
              </div>
            );
          })}
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
              isValidConnection={isValidConnection}
              onDragOver={onDragOver}
              onDrop={onDrop}
              nodeTypes={nodeTypes}
              deleteKeyCode={["Backspace", "Delete"]}
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
