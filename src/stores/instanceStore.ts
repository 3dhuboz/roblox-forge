import { create } from "zustand";

// Type definition for GameInstance
export type GameInstance = {
    id: string;
    name: string;
    children: GameInstance[];
    isExpanded: boolean;
};

interface InstanceState {
    instances: GameInstance[];
    selectedInstance?: GameInstance;
    addInstance: (instance: GameInstance, parentId?: string) => void;
    removeInstance: (id: string) => void;
    updateInstance: (id: string, updates: Partial<GameInstance>) => void;
    selectInstance: (id: string) => void;
    expandNode: (id: string) => void;
    collapseNode: (id: string) => void;
}

const removeRecursively = (instances: GameInstance[], id: string): GameInstance[] =>
    instances
        .filter((inst) => inst.id !== id)
        .map((inst) =>
            inst.children.length > 0
                ? { ...inst, children: removeRecursively(inst.children, id) }
                : inst,
        );

const findRecursively = (instances: GameInstance[], id: string): GameInstance | undefined => {
    for (const inst of instances) {
        if (inst.id === id) return inst;
        if (inst.children.length > 0) {
            const found = findRecursively(inst.children, id);
            if (found) return found;
        }
    }
    return undefined;
};

// Zustand store for managing the game instance hierarchy
const useInstanceStore = create<InstanceState>((set) => ({
    instances: [],

    addInstance: (instance: GameInstance, parentId?: string) => set((state) => {
        if (parentId) {
            const addToParent = (instances: GameInstance[]): GameInstance[] => {
                return instances.map((inst) => {
                    if (inst.id === parentId) {
                        return { ...inst, children: [...inst.children, instance] };
                    }
                    if (inst.children.length > 0) {
                        return { ...inst, children: addToParent(inst.children) };
                    }
                    return inst;
                });
            };
            return { instances: addToParent(state.instances) };
        }
        return { instances: [...state.instances, instance] };
    }),

    removeInstance: (id: string) => set((state) => ({
        instances: removeRecursively(state.instances, id),
    })),

    updateInstance: (id: string, updates: Partial<GameInstance>) => set((state) => {
        const updateRecursively = (instances: GameInstance[]): GameInstance[] => {
            return instances.map((inst) => {
                if (inst.id === id) {
                    return { ...inst, ...updates };
                }
                if (inst.children.length > 0) {
                    return { ...inst, children: updateRecursively(inst.children) };
                }
                return inst;
            });
        };
        return { instances: updateRecursively(state.instances) };
    }),

    selectInstance: (id: string) => set((state) => ({
        selectedInstance: findRecursively(state.instances, id),
    })),

    expandNode: (id: string) => set((state) => {
        const expandRecursively = (instances: GameInstance[]): GameInstance[] => {
            return instances.map((inst) => {
                if (inst.id === id) {
                    return { ...inst, isExpanded: true };
                }
                if (inst.children.length > 0) {
                    return { ...inst, children: expandRecursively(inst.children) };
                }
                return inst;
            });
        };
        return { instances: expandRecursively(state.instances) };
    }),

    collapseNode: (id: string) => set((state) => {
        const collapseRecursively = (instances: GameInstance[]): GameInstance[] => {
            return instances.map((inst) => {
                if (inst.id === id) {
                    return { ...inst, isExpanded: false };
                }
                if (inst.children.length > 0) {
                    return { ...inst, children: collapseRecursively(inst.children) };
                }
                return inst;
            });
        };
        return { instances: collapseRecursively(state.instances) };
    }),
}));

export default useInstanceStore;
