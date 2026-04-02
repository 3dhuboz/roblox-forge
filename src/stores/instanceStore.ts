import { create } from "zustand";

// Type definition for GameInstance
export type GameInstance = {
    id: string;
    name: string;
    children: GameInstance[];
    isExpanded: boolean;
};

interface InstanceStore {
    instances: GameInstance[];
    selectedId: string | null;
    searchQuery: string;
    clipboard: GameInstance | null;

    addInstance: (instance: GameInstance, parentId?: string) => void;
    removeInstance: (id: string) => void;
    updateInstance: (id: string, updates: Partial<GameInstance>) => void;
    selectInstance: (id: string | null) => void;
    expandNode: (id: string) => void;
    collapseNode: (id: string) => void;
    toggleNode: (id: string) => void;
    duplicateInstance: (id: string) => void;
    renameInstance: (id: string, newName: string) => void;
    copyInstance: (id: string) => void;
    pasteInstance: (parentId: string) => void;
    reparentInstance: (sourceId: string, targetId: string) => void;
    countInstances: () => number;
    loadFromHierarchy: (instances: GameInstance[]) => void;
    setSearchQuery: (q: string) => void;
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

function cloneDeep(inst: GameInstance, suffix: string): GameInstance {
    return {
        ...inst,
        id: nextId(),
        name: `${inst.name}${suffix}`,
        children: inst.children.map((c) => cloneDeep(c, suffix)),
    };
}

function addToParent(instances: GameInstance[], parentId: string, child: GameInstance): GameInstance[] {
    return instances.map((inst) => {
        if (inst.id === parentId) return { ...inst, children: [...inst.children, child], isExpanded: true };
        if (inst.children.length > 0) return { ...inst, children: addToParent(inst.children, parentId, child) };
        return inst;
    });
}

function isDescendant(instances: GameInstance[], ancestorId: string, targetId: string): boolean {
    const ancestor = findInstance(instances, ancestorId);
    if (!ancestor) return false;
    return findInstance(ancestor.children, targetId) !== null;
}

let idCounter = 0;
function nextId() {
    return `inst_${++idCounter}_${Date.now()}`;
}

export const useInstanceStore = create<InstanceStore>((set, get) => ({
    instances: [],
    selectedId: null,
    searchQuery: "",
    clipboard: null,

    addInstance: (instance, parentId) => set((state) => {
        if (parentId) {
            return { instances: addToParent(state.instances, parentId, instance) };
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
        const duplicate = cloneDeep(original, " Copy");
        set((state) => {
            const updated = insertSibling(state.instances, id, duplicate);
            return { instances: updated ?? [...state.instances, duplicate] };
        });
    },

    renameInstance: (id, newName) => set((state) => ({
        instances: updateRecursively(state.instances, id, { name: newName }),
    })),

    copyInstance: (id) => {
        const inst = findInstance(get().instances, id);
        if (inst) set({ clipboard: JSON.parse(JSON.stringify(inst)) });
    },

    pasteInstance: (parentId) => set((state) => {
        if (!state.clipboard) return {};
        const pasted = cloneDeep(state.clipboard, " Paste");
        return { instances: addToParent(state.instances, parentId, pasted) };
    }),

    reparentInstance: (sourceId, targetId) => set((state) => {
        if (sourceId === targetId) return {};
        if (isDescendant(state.instances, sourceId, targetId)) return {};
        const source = findInstance(state.instances, sourceId);
        if (!source) return {};
        const without = removeRecursively(state.instances, sourceId);
        const target = findInstance(without, targetId);
        if (!target) return {};
        return { instances: addToParent(without, targetId, source) };
    }),

    countInstances: () => countAll(get().instances),

    loadFromHierarchy: (instances) => set({ instances, selectedId: null }),

    setSearchQuery: (q) => set({ searchQuery: q }),
}));
