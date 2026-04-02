import { create } from "zustand";
import type { InstanceNode } from "../types/project";

interface InstanceStore {
  hierarchy: InstanceNode | null;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  searchQuery: string;
  clipboard: InstanceNode | null;

  setHierarchy: (h: InstanceNode) => void;
  selectInstance: (path: string | null) => void;
  toggleExpand: (path: string) => void;
  expandPath: (path: string) => void;
  setSearchQuery: (q: string) => void;

  renameInstance: (path: string, newName: string) => void;
  deleteInstance: (path: string) => void;
  duplicateInstance: (path: string) => void;
  addChildInstance: (parentPath: string, className: string, name: string) => void;
  reparentInstance: (sourcePath: string, targetPath: string) => void;
  copyInstance: (path: string) => void;
  pasteInstance: (parentPath: string) => void;

  getInstanceAtPath: (path: string) => InstanceNode | null;
  getParentAndIndex: (path: string) => { parent: InstanceNode; index: number } | null;
}

function findAtPath(root: InstanceNode, path: string): InstanceNode | null {
  const parts = path.split(".");
  let current: InstanceNode = root;
  for (let i = 1; i < parts.length; i++) {
    const child = current.children.find((c) => c.name === parts[i]);
    if (!child) return null;
    current = child;
  }
  return current;
}

function findParentAndIndex(root: InstanceNode, path: string): { parent: InstanceNode; index: number } | null {
  const parts = path.split(".");
  if (parts.length < 2) return null;
  const parentPath = parts.slice(0, -1).join(".");
  const parent = findAtPath(root, parentPath);
  if (!parent) return null;
  const childName = parts[parts.length - 1];
  const index = parent.children.findIndex((c) => c.name === childName);
  if (index === -1) return null;
  return { parent, index };
}

function deepClone(node: InstanceNode): InstanceNode {
  return JSON.parse(JSON.stringify(node));
}

export const useInstanceStore = create<InstanceStore>((set, get) => ({
  hierarchy: null,
  selectedPath: null,
  expandedPaths: new Set(["root"]),
  searchQuery: "",
  clipboard: null,

  setHierarchy: (h) => set({ hierarchy: deepClone(h) }),

  selectInstance: (path) => set({ selectedPath: path }),

  toggleExpand: (path) =>
    set((state) => {
      const next = new Set(state.expandedPaths);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return { expandedPaths: next };
    }),

  expandPath: (path) =>
    set((state) => {
      const next = new Set(state.expandedPaths);
      const parts = path.split(".");
      for (let i = 1; i <= parts.length; i++) {
        next.add(parts.slice(0, i).join("."));
      }
      return { expandedPaths: next };
    }),

  setSearchQuery: (q) => set({ searchQuery: q }),

  renameInstance: (path, newName) =>
    set((state) => {
      if (!state.hierarchy) return {};
      const h = deepClone(state.hierarchy);
      const node = findAtPath(h, path);
      if (node) node.name = newName;
      return { hierarchy: h };
    }),

  deleteInstance: (path) =>
    set((state) => {
      if (!state.hierarchy) return {};
      const h = deepClone(state.hierarchy);
      const result = findParentAndIndex(h, path);
      if (result) {
        result.parent.children.splice(result.index, 1);
      }
      return {
        hierarchy: h,
        selectedPath: state.selectedPath === path ? null : state.selectedPath,
      };
    }),

  duplicateInstance: (path) =>
    set((state) => {
      if (!state.hierarchy) return {};
      const h = deepClone(state.hierarchy);
      const result = findParentAndIndex(h, path);
      if (result) {
        const original = result.parent.children[result.index];
        const clone = deepClone(original);
        clone.name = original.name + "_Copy";
        result.parent.children.splice(result.index + 1, 0, clone);
      }
      return { hierarchy: h };
    }),

  addChildInstance: (parentPath, className, name) =>
    set((state) => {
      if (!state.hierarchy) return {};
      const h = deepClone(state.hierarchy);
      const parent = findAtPath(h, parentPath);
      if (parent) {
        const newNode: InstanceNode = {
          className,
          name,
          properties: {},
          children: [],
        };
        if (className === "SpawnLocation") {
          newNode.properties = {
            Size: { Vector3: [6, 1, 6] },
            Anchored: { Bool: true },
          };
        } else if (className === "Part") {
          newNode.properties = {
            Size: { Vector3: [4, 4, 4] },
            Anchored: { Bool: true },
          };
        }
        parent.children.push(newNode);
        // Auto-expand parent
        const next = new Set(state.expandedPaths);
        next.add(parentPath);
        return { hierarchy: h, expandedPaths: next };
      }
      return {};
    }),

  reparentInstance: (sourcePath, targetPath) =>
    set((state) => {
      if (!state.hierarchy || sourcePath === targetPath) return {};
      // Don't allow reparenting to own descendant
      if (targetPath.startsWith(sourcePath + ".")) return {};
      const h = deepClone(state.hierarchy);
      const sourceResult = findParentAndIndex(h, sourcePath);
      const targetNode = findAtPath(h, targetPath);
      if (sourceResult && targetNode) {
        const [moved] = sourceResult.parent.children.splice(sourceResult.index, 1);
        targetNode.children.push(moved);
        const next = new Set(state.expandedPaths);
        next.add(targetPath);
        return { hierarchy: h, expandedPaths: next };
      }
      return {};
    }),

  copyInstance: (path) => {
    const { hierarchy } = get();
    if (!hierarchy) return;
    const node = findAtPath(hierarchy, path);
    if (node) set({ clipboard: deepClone(node) });
  },

  pasteInstance: (parentPath) =>
    set((state) => {
      if (!state.hierarchy || !state.clipboard) return {};
      const h = deepClone(state.hierarchy);
      const parent = findAtPath(h, parentPath);
      if (parent) {
        const pasted = deepClone(state.clipboard);
        pasted.name = pasted.name + "_Paste";
        parent.children.push(pasted);
        const next = new Set(state.expandedPaths);
        next.add(parentPath);
        return { hierarchy: h, expandedPaths: next };
      }
      return {};
    }),

  getInstanceAtPath: (path) => {
    const { hierarchy } = get();
    if (!hierarchy) return null;
    return findAtPath(hierarchy, path);
  },

  getParentAndIndex: (path) => {
    const { hierarchy } = get();
    if (!hierarchy) return null;
    return findParentAndIndex(hierarchy, path);
  },
}));
