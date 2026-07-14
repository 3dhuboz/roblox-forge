import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validationCommands } from "../services/tauriCommands";
import { useProjectStore } from "./projectStore";
import { useToastStore } from "./toastStore";
import type { ProjectInfo } from "../types/project";
import type { ValidationIssue } from "../types/validation";

const originalProjectStoreState = useProjectStore.getState();

const project: ProjectInfo = {
  name: "Validation Contract",
  path: "D:/RobloxForge/ValidationContract",
  template: "obby",
  createdAt: "2000-05-01T00:00:00.000Z",
};

const staleIssue: ValidationIssue = {
  id: "stale-proof",
  severity: "warning",
  message: "This issue belongs to a previous validation run.",
  autoFixable: false,
};

beforeEach(() => {
  useProjectStore.setState(originalProjectStoreState, true);
  useToastStore.setState({ toasts: [] });
});

afterEach(() => {
  useProjectStore.setState(originalProjectStoreState, true);
  useToastStore.setState({ toasts: [] });
  vi.restoreAllMocks();
});

describe("project validation state", () => {
  it("clears stale proof and fails closed when validation is unavailable", async () => {
    useProjectStore.setState({
      project,
      validationIssues: [staleIssue],
      validationState: "passed",
      validationError: null,
    });
    vi.spyOn(validationCommands, "validateProject").mockRejectedValueOnce(
      new Error("This authority operation is unavailable in browser preview."),
    );

    const passed = await useProjectStore.getState().validateProject();

    expect(passed).toBe(false);
    expect(useProjectStore.getState()).toEqual(
      expect.objectContaining({
        validationIssues: [],
        validationState: "failed",
        validationError:
          "This authority operation is unavailable in browser preview.",
      }),
    );
    expect(
      useToastStore.getState().toasts.some((toast) => toast.type === "success"),
    ).toBe(false);
  });

  it("fails closed and clears stale proof when no project is open", async () => {
    useProjectStore.setState({
      project: null,
      validationIssues: [staleIssue],
      validationState: "passed",
      validationError: null,
    });

    const passed = await useProjectStore.getState().validateProject();

    expect(passed).toBe(false);
    expect(useProjectStore.getState()).toEqual(
      expect.objectContaining({
        validationIssues: [],
        validationState: "failed",
        validationError: expect.stringMatching(/no project/i),
      }),
    );
  });

  it("returns true and records passed only after a completed clean run", async () => {
    useProjectStore.setState({
      project,
      validationIssues: [staleIssue],
      validationState: "not_run",
      validationError: null,
    });
    vi.spyOn(validationCommands, "validateProject").mockResolvedValueOnce([]);

    const passed = await useProjectStore.getState().validateProject();

    expect(passed).toBe(true);
    expect(useProjectStore.getState()).toEqual(
      expect.objectContaining({
        validationIssues: [],
        validationState: "passed",
        validationError: null,
      }),
    );
  });

  it("returns false and records failed when completed checks contain errors", async () => {
    const issue: ValidationIssue = {
      id: "missing-spawn",
      severity: "error",
      message: "A spawn location is required.",
      autoFixable: false,
    };
    useProjectStore.setState({
      project,
      validationIssues: [],
      validationState: "not_run",
      validationError: null,
    });
    vi.spyOn(validationCommands, "validateProject").mockResolvedValueOnce([
      issue,
    ]);

    const passed = await useProjectStore.getState().validateProject();

    expect(passed).toBe(false);
    expect(useProjectStore.getState()).toEqual(
      expect.objectContaining({
        validationIssues: [issue],
        validationState: "failed",
        validationError: expect.stringMatching(/1 issue/i),
      }),
    );
  });
});
