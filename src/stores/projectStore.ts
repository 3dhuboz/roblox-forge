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

let validationEpoch = 0;
let fixingOperationGeneration = 0;

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
    validationEpoch += 1;
    fixingOperationGeneration += 1;
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
    const attempt = ++validationEpoch;
    const projectPath = project?.path ?? null;
    const isCurrentAttempt = () =>
      validationEpoch === attempt && get().project?.path === projectPath;
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
      if (!isCurrentAttempt()) return false;

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
      if (!isCurrentAttempt()) return false;

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
    const { project, fixingIssueId } = get();
    if (!project || fixingIssueId !== null) return;
    const projectPath = project.path;
    const mutationEpoch = ++validationEpoch;
    const fixingGeneration = ++fixingOperationGeneration;
    const isCurrentMutation = () =>
      validationEpoch === mutationEpoch && get().project?.path === projectPath;
    const ownsFixingOperation = () =>
      fixingOperationGeneration === fixingGeneration &&
      get().project?.path === projectPath &&
      get().fixingIssueId === issueId;
    set({
      fixingIssueId: issueId,
      validationIssues: [],
      validationState: "failed",
      validationError:
        "Project files are changing. Validate again before publishing.",
      error: null,
    });
    try {
      const message = await validationCommands.autoFixIssue(project.path, issueId);
      if (!isCurrentMutation()) return;

      useToastStore.getState().addToast("success", message);
      // Re-validate after fix
      await get().validateProject();
      if (get().project?.path === projectPath) {
        await get().refreshProjectState();
      }
    } catch (e) {
      if (!isCurrentMutation()) return;

      const message = e instanceof Error ? e.message : String(e);
      set({
        validationIssues: [],
        validationState: "failed",
        validationError: message,
        error: message,
      });
      useToastStore.getState().addToast("error", `Auto-fix failed: ${message}`);
    } finally {
      if (ownsFixingOperation()) {
        set({ fixingIssueId: null });
      }
    }
  },

  clearProject: () => {
    validationEpoch += 1;
    fixingOperationGeneration += 1;
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
