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

const autoFixableWarning: ValidationIssue = {
  id: "stale-warning-proof",
  severity: "warning",
  message: "This warning was accepted by the last completed validation.",
  autoFixable: true,
  fixDescription: "Apply the recommended setting",
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

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

  it("ignores an older clean result after a newer validation fails", async () => {
    const olderRun = deferred<ValidationIssue[]>();
    vi.spyOn(validationCommands, "validateProject")
      .mockReturnValueOnce(olderRun.promise)
      .mockRejectedValueOnce(new Error("Newer validation is unavailable."));
    useProjectStore.setState({
      project,
      validationIssues: [],
      validationState: "not_run",
      validationError: null,
    });

    const olderResultPromise = useProjectStore.getState().validateProject();
    const newerResult = await useProjectStore.getState().validateProject();
    olderRun.resolve([]);
    const olderResult = await olderResultPromise;

    expect(newerResult).toBe(false);
    expect(olderResult).toBe(false);
    expect(useProjectStore.getState()).toEqual(
      expect.objectContaining({
        validationIssues: [],
        validationState: "failed",
        validationError: "Newer validation is unavailable.",
      }),
    );
    expect(
      useToastStore.getState().toasts.some((toast) => toast.type === "success"),
    ).toBe(false);
  });

  it("ignores an in-flight result after the project is cleared", async () => {
    const inFlightRun = deferred<ValidationIssue[]>();
    vi.spyOn(validationCommands, "validateProject").mockReturnValueOnce(
      inFlightRun.promise,
    );
    useProjectStore.setState({
      project,
      validationIssues: [],
      validationState: "not_run",
      validationError: null,
    });

    const resultPromise = useProjectStore.getState().validateProject();
    useProjectStore.getState().clearProject();
    inFlightRun.resolve([]);

    expect(await resultPromise).toBe(false);
    expect(useProjectStore.getState()).toEqual(
      expect.objectContaining({
        project: null,
        validationIssues: [],
        validationState: "not_run",
        validationError: null,
      }),
    );
  });

  it("ignores an in-flight result after creating a replacement project", async () => {
    const inFlightRun = deferred<ValidationIssue[]>();
    vi.spyOn(validationCommands, "validateProject").mockReturnValueOnce(
      inFlightRun.promise,
    );
    useProjectStore.setState({
      project,
      validationIssues: [],
      validationState: "not_run",
      validationError: null,
    });

    const resultPromise = useProjectStore.getState().validateProject();
    const created = await useProjectStore
      .getState()
      .createProject("obby", "Replacement Validation Contract");
    const replacementPath = useProjectStore.getState().project?.path;
    inFlightRun.resolve([]);

    expect(created).toBe(true);
    expect(replacementPath).toBe(
      "browser-preview://Replacement_Validation_Contract",
    );
    expect(await resultPromise).toBe(false);
    expect(useProjectStore.getState()).toEqual(
      expect.objectContaining({
        validationIssues: [],
        validationState: "not_run",
        validationError: null,
      }),
    );
  });

  it("invalidates passed proof before an auto-fix and only repasses after fresh validation", async () => {
    const freshRun = deferred<ValidationIssue[]>();
    vi.spyOn(validationCommands, "autoFixIssue").mockResolvedValueOnce(
      "Recommended setting applied.",
    );
    const validateProject = vi
      .spyOn(validationCommands, "validateProject")
      .mockReturnValueOnce(freshRun.promise);
    useProjectStore.setState({
      project,
      validationIssues: [autoFixableWarning],
      validationState: "passed",
      validationError: null,
    });

    const fixPromise = useProjectStore
      .getState()
      .autoFixIssue(autoFixableWarning.id);

    expect(useProjectStore.getState()).toEqual(
      expect.objectContaining({
        fixingIssueId: autoFixableWarning.id,
        validationIssues: [],
        validationState: "failed",
        validationError: expect.stringMatching(/validate again/i),
      }),
    );
    await vi.waitFor(() => expect(validateProject).toHaveBeenCalledTimes(1));
    expect(useProjectStore.getState().validationState).toBe("running");

    freshRun.resolve([]);
    await fixPromise;

    expect(useProjectStore.getState()).toEqual(
      expect.objectContaining({
        fixingIssueId: null,
        validationIssues: [],
        validationState: "passed",
        validationError: null,
      }),
    );
  });

  it("leaves validation failed with no stale issues when auto-fix fails", async () => {
    vi.spyOn(validationCommands, "autoFixIssue").mockRejectedValueOnce(
      new Error("Fix service unavailable."),
    );
    const validateProject = vi.spyOn(validationCommands, "validateProject");
    useProjectStore.setState({
      project,
      validationIssues: [autoFixableWarning],
      validationState: "passed",
      validationError: null,
    });

    await useProjectStore.getState().autoFixIssue(autoFixableWarning.id);

    expect(validateProject).not.toHaveBeenCalled();
    expect(useProjectStore.getState()).toEqual(
      expect.objectContaining({
        fixingIssueId: null,
        validationIssues: [],
        validationState: "failed",
        validationError: expect.stringMatching(/fix service unavailable/i),
      }),
    );
  });
});
