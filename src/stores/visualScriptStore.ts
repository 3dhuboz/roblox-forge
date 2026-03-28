import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";
import { NODE_TYPES } from "../lib/nodeTypes";
import { compileGraphToLuau } from "../lib/luauCodeGen";
import { projectCommands } from "../services/tauriCommands";

interface NodeData {
  nodeType: string;
  values: Record<string, string | number | boolean>;
}

interface VisualScriptStore {
  nodes: Node<NodeData>[];
  edges: Edge[];
  scriptName: string;
  compiledCode: string | null;

  setNodes: (nodes: Node<NodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  setScriptName: (name: string) => void;

  addNode: (nodeType: string, x: number, y: number) => void;
  removeNode: (id: string) => void;
  updateNodeValue: (nodeId: string, inputId: string, value: string | number | boolean) => void;

  compile: () => void;
  saveToProject: (projectPath: string) => Promise<void>;
  clearGraph: () => void;
}

let nodeCounter = 0;

export const useVisualScriptStore = create<VisualScriptStore>()((set, get) => ({
  nodes: [],
  edges: [],
  scriptName: "VisualScript1",
  compiledCode: null,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setScriptName: (scriptName) => set({ scriptName }),

  addNode: (nodeType, x, y) => {
    const def = NODE_TYPES[nodeType];
    if (!def) return;

    nodeCounter++;
    const id = `vs_${nodeType}_${nodeCounter}`;

    // Build default values from port definitions
    const values: Record<string, string | number | boolean> = {};
    for (const input of def.inputs) {
      if (input.defaultValue !== undefined) {
        values[input.id] = input.defaultValue;
      }
    }

    const newNode: Node<NodeData> = {
      id,
      type: def.category, // "trigger" | "action" | "logic" — maps to custom node components
      position: { x, y },
      data: { nodeType, values },
    };

    set((state) => ({ nodes: [...state.nodes, newNode] }));
  },

  removeNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
    }));
  },

  updateNodeValue: (nodeId, inputId, value) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, values: { ...n.data.values, [inputId]: value } } }
          : n,
      ),
    }));
  },

  compile: () => {
    const { nodes, edges, scriptName } = get();
    const code = compileGraphToLuau(nodes, edges, scriptName);
    set({ compiledCode: code });
  },

  saveToProject: async (projectPath) => {
    const { compiledCode, scriptName } = get();
    if (!compiledCode) return;

    await projectCommands.writeFile(
      projectPath,
      `src/server/VisualScripts/${scriptName}.server.luau`,
      compiledCode,
    );
  },

  clearGraph: () => {
    set({ nodes: [], edges: [], compiledCode: null });
    nodeCounter = 0;
  },
}));
