import { create } from "zustand";
import type { InstanceNode } from "../types/project";

// Type definition for GameInstance — a superset of InstanceNode with UI-only fields (id, isExpanded)
export type GameInstance = {
    id: string;
    className: string;
    name: string;
    children: GameInstance[];
    isExpanded: boolean;
    properties: Record<string, unknown>;
    tags?: string[];
    scriptSource?: string;
};

interface InstanceStore {
    instances: GameInstance[];
    selectedId: string | null;

    addInstance: (instance: GameInstance, parentId?: string) => void;
    removeInstance: (id: string) => void;
    updateInstance: (id: string, updates: Partial<GameInstance>) => void;
    selectInstance: (id: string | null) => void;
    expandNode: (id: string) => void;
    collapseNode: (id: string) => void;
    toggleNode: (id: string) => void;
    duplicateInstance: (id: string) => void;
    countInstances: () => number;
    loadFromHierarchy: (instances: GameInstance[]) => void;
    toInstanceNode: () => InstanceNode;
    loadFromProjectState: (hierarchy: InstanceNode) => void;
}

function removeRecursively(instances: GameInstance[], id: string): GameInstance[] {
    return instances
        .filter((inst) => inst.id !== id)
        .map((inst) => ({ ...inst, children: removeRecursively(inst.children, id) }));
}

function updateRecursively(instances: GameInstance[], id: string, updates: Partial<GameInstance>): GameInstance[] {
    return instances.map((inst) => {
        if (inst.id === id) return { ...inst, ...updates };
        if (inst.children.length > 0) return { ...inst, children: updateRecursively(inst.children, id, updates) };
        return inst;
    });
}

function findInstance(instances: GameInstance[], id: string): GameInstance | null {
    for (const inst of instances) {
        if (inst.id === id) return inst;
        const found = findInstance(inst.children, id);
        if (found) return found;
    }
    return null;
}

function countAll(instances: GameInstance[]): number {
    return instances.reduce((acc, inst) => acc + 1 + countAll(inst.children), 0);
}

function insertSibling(instances: GameInstance[], id: string, sibling: GameInstance): GameInstance[] | null {
    const idx = instances.findIndex((inst) => inst.id === id);
    if (idx !== -1) {
        const result = [...instances];
        result.splice(idx + 1, 0, sibling);
        return result;
    }
    for (let i = 0; i < instances.length; i++) {
        const updated = insertSibling(instances[i].children, id, sibling);
        if (updated !== null) {
            const result = [...instances];
            result[i] = { ...instances[i], children: updated };
            return result;
        }
    }
    return null;
}

let idCounter = 0;
function nextId() {
    return `inst_${++idCounter}_${Date.now()}`;
}

export const useInstanceStore = create<InstanceStore>((set, get) => ({
    instances: [],
    selectedId: null,

    addInstance: (instance, parentId) => set((state) => {
        if (parentId) {
            const addToParent = (instances: GameInstance[]): GameInstance[] =>
                instances.map((inst) => {
                    if (inst.id === parentId) return { ...inst, children: [...inst.children, instance] };
                    if (inst.children.length > 0) return { ...inst, children: addToParent(inst.children) };
                    return inst;
                });
            return { instances: addToParent(state.instances) };
        }
        return { instances: [...state.instances, instance] };
    }),

    removeInstance: (id) => set((state) => ({
        instances: removeRecursively(state.instances, id),
        selectedId: state.selectedId === id ? null : state.selectedId,
    })),

    updateInstance: (id, updates) => set((state) => ({
        instances: updateRecursively(state.instances, id, updates),
    })),

    selectInstance: (id) => set({ selectedId: id }),

    expandNode: (id) => set((state) => ({
        instances: updateRecursively(state.instances, id, { isExpanded: true }),
    })),

    collapseNode: (id) => set((state) => ({
        instances: updateRecursively(state.instances, id, { isExpanded: false }),
    })),

    toggleNode: (id) => {
        const inst = findInstance(get().instances, id);
        if (!inst) return;
        set((state) => ({
            instances: updateRecursively(state.instances, id, { isExpanded: !inst.isExpanded }),
        }));
    },

    duplicateInstance: (id) => {
        const original = findInstance(get().instances, id);
        if (!original) return;
        const cloneDeep = (inst: GameInstance, suffix: string): GameInstance => ({
            ...inst,
            id: nextId(),
            name: `${inst.name}${suffix}`,
            children: inst.children.map((c) => cloneDeep(c, suffix)),
        });
        const duplicate = cloneDeep(original, " Copy");
        set((state) => {
            const updated = insertSibling(state.instances, id, duplicate);
            return { instances: updated ?? [...state.instances, duplicate] };
        });
    },

    countInstances: () => countAll(get().instances),

    loadFromHierarchy: (instances) => set({ instances, selectedId: null }),

    toInstanceNode: () => {
        const convert = (inst: GameInstance): InstanceNode => ({
            className: inst.className,
            name: inst.name,
            properties: inst.properties,
            children: inst.children.map(convert),
            tags: inst.tags,
            scriptSource: inst.scriptSource,
        });
        const root = get().instances[0];
        return root
            ? convert(root)
            : { className: "DataModel", name: "Game", properties: {}, children: [] };
    },

    loadFromProjectState: (hierarchy) => {
        let counter = 0;
        const convert = (node: InstanceNode): GameInstance => ({
            id: `proj_${++counter}`,
            className: node.className,
            name: node.name,
            isExpanded: node.className === "DataModel" || node.className === "Workspace",
            properties: node.properties,
            children: node.children.map(convert),
            tags: node.tags,
            scriptSource: node.scriptSource,
        });
        set({ instances: [convert(hierarchy)], selectedId: null });
    },
}));
