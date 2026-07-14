import { create } from "zustand";
import type { ProjectInfo, ProjectState } from "../types/project";
import type { ValidationIssue } from "../types/validation";
import {
  browserPreviewService,
  projectCommands,
  validationCommands,
} from "../services/tauriCommands";
import { useToastStore } from "./toastStore";
import { getTemplatePreset } from "../lib/templatePresets";
import { useCanvasStore } from "./canvasStore";
import { useInstanceStore } from "./instanceStore";
import { isTauriRuntime } from "../lib/isTauriRuntime";

export type ValidationState = "not_run" | "running" | "failed" | "passed";

interface ProjectStore {
  project: ProjectInfo | null;
  projectState: ProjectState | null;
  validationIssues: ValidationIssue[];
  validationState: ValidationState;
  validationError: string | null;
  isLoading: boolean;
  error: string | null;
  fixingIssueId: string | null;

  createProject: (template: string, name: string) => Promise<boolean>;
  refreshProjectState: () => Promise<void>;
  validateProject: () => Promise<boolean>;
  autoFixIssue: (issueId: string) => Promise<void>;
  clearProject: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  projectState: null,
  validationIssues: [],
  validationState: "not_run",
  validationError: null,
  isLoading: false,
  error: null,
  fixingIssueId: null,

  createProject: async (template, name) => {
    const isDesktop = isTauriRuntime();
    set({
      project: null,
      projectState: null,
      validationIssues: [],
      validationState: "not_run",
      validationError: null,
      isLoading: true,
      error: null,
      fixingIssueId: null,
    });
    try {
      const project = isDesktop
        ? await projectCommands.createProject(template, name)
        : (await browserPreviewService.createProject(template, name)).data;
      const projectState = isDesktop
        ? await projectCommands.getProjectState(project.path)
        : (await browserPreviewService.getProjectState(project.path)).data;

      set({ project, projectState });

      // Load template preset into canvas and instance stores
      const preset = getTemplatePreset(template);
      if (preset) {
        const canvasStore = useCanvasStore.getState();
        canvasStore.loadPreset(preset.canvasElements);
        canvasStore.setTemplate(template);
        useInstanceStore.getState().loadFromHierarchy(preset.hierarchy);
      }

      useToastStore
        .getState()
        .addToast(
          "success",
          isDesktop
            ? `Project "${name}" created!`
            : `Preview project "${name}" created in temporary memory.`,
        );
      return true;
    } catch (e) {
      set({ project: null, projectState: null, error: String(e) });
      useToastStore.getState().addToast("error", `Failed to create project: ${e}`);
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  refreshProjectState: async () => {
    const { project } = get();
    if (!project) return;
    try {
      const projectState = isTauriRuntime()
        ? await projectCommands.getProjectState(project.path)
        : (await browserPreviewService.getProjectState(project.path)).data;
      set({ projectState });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  validateProject: async () => {
    const { project } = get();
    set({
      validationIssues: [],
      validationState: "running",
      validationError: null,
      error: null,
    });

    if (!project) {
      const message = "No project is open to validate.";
      set({
        validationIssues: [],
        validationState: "failed",
        validationError: message,
      });
      return false;
    }

    try {
      const issues = await validationCommands.validateProject(project.path);
      const errors = issues.filter((i) => i.severity === "error").length;
      if (errors === 0) {
        set({
          validationIssues: issues,
          validationState: "passed",
          validationError: null,
        });
        useToastStore.getState().addToast("success", "Validation passed! Ready to publish.");
        return true;
      } else {
        const message = `Validation found ${errors} issue${errors > 1 ? "s" : ""}.`;
        set({
          validationIssues: issues,
          validationState: "failed",
          validationError: message,
        });
        useToastStore.getState().addToast("warning", message);
        return false;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({
        validationIssues: [],
        validationState: "failed",
        validationError: message,
        error: message,
      });
      useToastStore.getState().addToast("error", `Validation failed: ${message}`);
      return false;
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
      validationState: "not_run",
      validationError: null,
      error: null,
      fixingIssueId: null,
    });
  },
}));
