import { create } from "zustand";
import type { ProjectInfo, ProjectState } from "../types/project";
import type { ValidationIssue } from "../types/validation";
import { projectCommands, validationCommands } from "../services/tauriCommands";
import { useToastStore } from "./toastStore";
import { getTemplatePreset } from "../lib/templatePresets";
import { useCanvasStore } from "./canvasStore";
import { useInstanceStore } from "./instanceStore";

interface ProjectStore {
  project: ProjectInfo | null;
  projectState: ProjectState | null;
  validationIssues: ValidationIssue[];
  isLoading: boolean;
  error: string | null;
  fixingIssueId: string | null;

  createProject: (template: string, name: string) => Promise<void>;
  refreshProjectState: () => Promise<void>;
  validateProject: () => Promise<void>;
  autoFixIssue: (issueId: string) => Promise<void>;
  clearProject: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  projectState: null,
  validationIssues: [],
  isLoading: false,
  error: null,
  fixingIssueId: null,

  createProject: async (template, name) => {
    set({ isLoading: true, error: null });
    try {
      const project = await projectCommands.createProject(template, name);
      set({ project });
      await get().refreshProjectState();

      // Load template preset into canvas and instance stores
      const preset = getTemplatePreset(template);
      if (preset) {
        const canvasStore = useCanvasStore.getState();
        canvasStore.loadPreset(preset.canvasElements);
        canvasStore.setTemplate(template);
        useInstanceStore.getState().loadFromHierarchy(preset.hierarchy);
      }

      useToastStore.getState().addToast("success", `Project "${name}" created!`);
    } catch (e) {
      set({ error: String(e) });
      useToastStore.getState().addToast("error", `Failed to create project: ${e}`);
    } finally {
      set({ isLoading: false });
    }
  },

  refreshProjectState: async () => {
    const { project } = get();
    if (!project) return;
    try {
      const projectState = await projectCommands.getProjectState(project.path);
      set({ projectState });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  validateProject: async () => {
    const { project } = get();
    if (!project) return;
    try {
      const issues = await validationCommands.validateProject(project.path);
      set({ validationIssues: issues });
      const errors = issues.filter((i) => i.severity === "error").length;
      if (errors === 0) {
        useToastStore.getState().addToast("success", "Validation passed! Ready to publish.");
      } else {
        useToastStore.getState().addToast("warning", `Validation found ${errors} issue${errors > 1 ? "s" : ""}.`);
      }
    } catch (e) {
      set({ error: String(e) });
      useToastStore.getState().addToast("error", `Validation failed: ${e}`);
    }
  },

  autoFixIssue: async (issueId: string) => {
    const { project } = get();
    if (!project) return;
    set({ fixingIssueId: issueId });
    try {
      const message = await validationCommands.autoFixIssue(project.path, issueId);
      useToastStore.getState().addToast("success", message);
      // Re-validate after fix
      await get().validateProject();
      await get().refreshProjectState();
    } catch (e) {
      useToastStore.getState().addToast("error", `Auto-fix failed: ${e}`);
    } finally {
      set({ fixingIssueId: null });
    }
  },

  clearProject: () => {
    set({
      project: null,
      projectState: null,
      validationIssues: [],
      error: null,
      fixingIssueId: null,
    });
  },
}));
