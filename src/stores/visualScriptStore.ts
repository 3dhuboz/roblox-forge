import { create } from "zustand";
import type { Node, Edge } from "@xyflow/react";
import { NODE_TYPES } from "../lib/nodeTypes";
import type { PortType } from "../lib/nodeTypes";
import { compileGraphToLuau } from "../lib/luauCodeGen";
import { projectCommands } from "../services/tauriCommands";

interface NodeData {
  nodeType: string;
  values: Record<string, string | number | boolean>;
}

interface ScriptGraph {
  name: string;
  nodes: Node<NodeData>[];
  edges: Edge[];
}

interface VisualScriptStore {
  // Multi-script support
  graphs: ScriptGraph[];
  activeGraphIndex: number;

  // Convenience getters set by actions
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

  // Multi-script actions
  addGraph: () => void;
  switchGraph: (index: number) => void;
  removeGraph: (index: number) => void;

  compile: () => void;
  saveToProject: (projectPath: string) => Promise<void>;
  saveGraphJson: (projectPath: string) => Promise<void>;
  loadGraphJson: (projectPath: string) => Promise<void>;
  clearGraph: () => void;
}

let nodeCounter = 0;

/** Check if two port types are compatible for connection. */
export function canConnect(sourceType: PortType, targetType: PortType): boolean {
  if (sourceType === targetType) return true;
  // Signal can only connect to signal
  if (sourceType === "signal" || targetType === "signal") {
    return sourceType === "signal" && targetType === "signal";
  }
  // Data ports: allow flexible connections between non-signal types
  return true;
}

function syncActiveGraph(state: VisualScriptStore) {
  const g = state.graphs[state.activeGraphIndex];
  if (!g) return state;
  return {
    nodes: g.nodes,
    edges: g.edges,
    scriptName: g.name,
  };
}

export const useVisualScriptStore = create<VisualScriptStore>()((set, get) => ({
  graphs: [{ name: "VisualScript1", nodes: [], edges: [] }],
  activeGraphIndex: 0,
  nodes: [],
  edges: [],
  scriptName: "VisualScript1",
  compiledCode: null,

  setNodes: (nodes) => {
    set((state) => {
      const graphs = [...state.graphs];
      graphs[state.activeGraphIndex] = { ...graphs[state.activeGraphIndex], nodes };
      return { graphs, nodes };
    });
  },

  setEdges: (edges) => {
    set((state) => {
      const graphs = [...state.graphs];
      graphs[state.activeGraphIndex] = { ...graphs[state.activeGraphIndex], edges };
      return { graphs, edges };
    });
  },

  setScriptName: (name) => {
    set((state) => {
      const graphs = [...state.graphs];
      graphs[state.activeGraphIndex] = { ...graphs[state.activeGraphIndex], name };
      return { graphs, scriptName: name };
    });
  },

  addNode: (nodeType, x, y) => {
    const def = NODE_TYPES[nodeType];
    if (!def) return;

    nodeCounter++;
    const id = `vs_${nodeType}_${nodeCounter}`;

    const values: Record<string, string | number | boolean> = {};
    for (const input of def.inputs) {
      if (input.defaultValue !== undefined) {
        values[input.id] = input.defaultValue;
      }
    }

    const newNode: Node<NodeData> = {
      id,
      type: def.category,
      position: { x, y },
      data: { nodeType, values },
    };

    set((state) => {
      const graphs = [...state.graphs];
      const g = graphs[state.activeGraphIndex];
      const nodes = [...g.nodes, newNode];
      graphs[state.activeGraphIndex] = { ...g, nodes };
      return { graphs, nodes };
    });
  },

  removeNode: (id) => {
    set((state) => {
      const graphs = [...state.graphs];
      const g = graphs[state.activeGraphIndex];
      const nodes = g.nodes.filter((n) => n.id !== id);
      const edges = g.edges.filter((e) => e.source !== id && e.target !== id);
      graphs[state.activeGraphIndex] = { ...g, nodes, edges };
      return { graphs, nodes, edges };
    });
  },

  updateNodeValue: (nodeId, inputId, value) => {
    set((state) => {
      const graphs = [...state.graphs];
      const g = graphs[state.activeGraphIndex];
      const nodes = g.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, values: { ...n.data.values, [inputId]: value } } }
          : n,
      );
      graphs[state.activeGraphIndex] = { ...g, nodes };
      return { graphs, nodes };
    });
  },

  addGraph: () => {
    set((state) => {
      const newIndex = state.graphs.length;
      const graphs = [
        ...state.graphs,
        { name: `VisualScript${newIndex + 1}`, nodes: [], edges: [] },
      ];
      return {
        graphs,
        activeGraphIndex: newIndex,
        ...syncActiveGraph({ ...state, graphs, activeGraphIndex: newIndex }),
        compiledCode: null,
      };
    });
  },

  switchGraph: (index) => {
    set((state) => {
      if (index < 0 || index >= state.graphs.length) return state;
      const g = state.graphs[index];
      return {
        activeGraphIndex: index,
        nodes: g.nodes,
        edges: g.edges,
        scriptName: g.name,
        compiledCode: null,
      };
    });
  },

  removeGraph: (index) => {
    set((state) => {
      if (state.graphs.length <= 1) return state; // Keep at least one
      const graphs = state.graphs.filter((_, i) => i !== index);
      const newIndex = Math.min(state.activeGraphIndex, graphs.length - 1);
      const g = graphs[newIndex];
      return {
        graphs,
        activeGraphIndex: newIndex,
        nodes: g.nodes,
        edges: g.edges,
        scriptName: g.name,
        compiledCode: null,
      };
    });
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

  saveGraphJson: async (projectPath) => {
    const { graphs } = get();
    const json = JSON.stringify(
      graphs.map((g) => ({
        name: g.name,
        nodes: g.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        })),
        edges: g.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
        })),
      })),
      null,
      2,
    );
    await projectCommands.writeFile(projectPath, "visual-scripts.json", json);
  },

  loadGraphJson: async (projectPath) => {
    try {
      // Read the file via the project state (simplified — in real app would use a read command)
      // For now, this is a placeholder that initializes from saved state
    } catch {
      // No saved graphs — keep defaults
    }
  },

  clearGraph: () => {
    set((state) => {
      const graphs = [...state.graphs];
      graphs[state.activeGraphIndex] = {
        ...graphs[state.activeGraphIndex],
        nodes: [],
        edges: [],
      };
      return { graphs, nodes: [], edges: [], compiledCode: null };
    });
    nodeCounter = 0;
  },
}));
