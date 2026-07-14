import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublishPage } from "./PublishPage";
import {
  publishCommands,
  validationCommands,
} from "../../services/tauriCommands";
import { useAuthStore } from "../../stores/authStore";
import { useProjectStore } from "../../stores/projectStore";
import type { AuthState } from "../../types/roblox";
import type { ProjectInfo } from "../../types/project";

const originalAuthStoreState = useAuthStore.getState();
const originalProjectStoreState = useProjectStore.getState();

const auth: AuthState = {
  accessToken: "test-access-token",
  refreshToken: "test-refresh-token",
  expiresAt: Date.now() + 60_000,
  userId: "42",
  username: "validation-tester",
  displayName: "Validation Tester",
};

const project: ProjectInfo = {
  name: "Publish Gate Contract",
  path: "D:/RobloxForge/PublishGateContract",
  template: "obby",
  createdAt: "2000-06-01T00:00:00.000Z",
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
  useAuthStore.setState(originalAuthStoreState, true);
  useProjectStore.setState(originalProjectStoreState, true);
  useAuthStore.setState({
    auth,
    isConnecting: false,
    error: null,
    checkAuth: vi.fn().mockResolvedValue(undefined),
  });
  useProjectStore.setState({
    project,
    validationIssues: [],
    validationState: "not_run",
    validationError: null,
  });
});

afterEach(() => {
  useAuthStore.setState(originalAuthStoreState, true);
  useProjectStore.setState(originalProjectStoreState, true);
  vi.restoreAllMocks();
});

async function enterPublishIds(): Promise<void> {
  const user = userEvent.setup();
  await screen.findByRole("heading", { name: "Game Details" });
  await user.type(
    screen.getByPlaceholderText("e.g. 1234567890"),
    "1234567890",
  );
  await user.type(
    screen.getByPlaceholderText("e.g. 9876543210"),
    "9876543210",
  );
}

describe("PublishPage validation gate", () => {
  it.each([
    [
      "validation is running",
      { validationState: "running" as const, fixingIssueId: null },
    ],
    [
      "an auto-fix is running",
      {
        validationState: "not_run" as const,
        fixingIssueId: "stale-warning-proof",
      },
    ],
  ])("disables Check My Game while %s", async (_label, gateState) => {
    useProjectStore.setState(gateState);
    render(<PublishPage />);
    await enterPublishIds();

    expect(
      screen.getByRole("button", { name: "Check My Game" }),
    ).toBeDisabled();
  });

  it("stays on settings and exposes an alert when validation fails", async () => {
    const validateProject = vi.fn().mockImplementation(async () => {
      useProjectStore.setState({
        validationIssues: [],
        validationState: "failed",
        validationError: "Desktop validation is unavailable.",
      });
      return false;
    });
    useProjectStore.setState({ validateProject });
    const publishGame = vi.spyOn(publishCommands, "publishGame");
    render(<PublishPage />);
    await enterPublishIds();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Check My Game" }));

    await waitFor(() => expect(validateProject).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("heading", { name: "Game Details" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Desktop validation is unavailable.",
    );
    expect(screen.queryByText("Validation Passed")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publish to Roblox!" }),
    ).not.toBeInTheDocument();
    expect(publishGame).not.toHaveBeenCalled();
  });

  it("advances after a completed passed run and enables publish", async () => {
    const validateProject = vi.fn().mockImplementation(async () => {
      useProjectStore.setState({
        validationIssues: [],
        validationState: "passed",
        validationError: null,
      });
      return true;
    });
    useProjectStore.setState({ validateProject });
    render(<PublishPage />);
    await enterPublishIds();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Check My Game" }));

    expect(await screen.findByText("Validation Passed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publish to Roblox!" }),
    ).toBeEnabled();
  });

  it("keeps publish disabled unless the recorded state is passed", async () => {
    const validateProject = vi.fn().mockResolvedValue(true);
    useProjectStore.setState({ validateProject });
    render(<PublishPage />);
    await enterPublishIds();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Check My Game" }));

    expect(
      await screen.findByRole("button", { name: "Publish to Roblox!" }),
    ).toBeDisabled();
  });

  it("disables publish while an auto-fix mutation is active", async () => {
    const validateProject = vi.fn().mockImplementation(async () => {
      useProjectStore.setState({
        validationIssues: [],
        validationState: "passed",
        validationError: null,
      });
      return true;
    });
    useProjectStore.setState({ validateProject });
    const publishGame = vi.spyOn(publishCommands, "publishGame");
    render(<PublishPage />);
    await enterPublishIds();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Check My Game" }));
    expect(await screen.findByText("Validation Passed")).toBeInTheDocument();

    act(() => {
      useProjectStore.setState({ fixingIssueId: "stale-warning-proof" });
    });

    expect(
      screen.getByRole("button", { name: "Publish to Roblox!" }),
    ).toBeDisabled();
    expect(publishGame).not.toHaveBeenCalled();
  });

  it("keeps a replacement project's fix gate owned until its operation settles", async () => {
    const olderFix = deferred<string>();
    const replacementFix = deferred<string>();
    vi.spyOn(validationCommands, "autoFixIssue")
      .mockReturnValueOnce(olderFix.promise)
      .mockReturnValueOnce(replacementFix.promise);
    render(<PublishPage />);
    await enterPublishIds();

    let olderFixPromise!: Promise<void>;
    act(() => {
      olderFixPromise = useProjectStore.getState().autoFixIssue("project-a-fix");
    });

    await act(async () => {
      useProjectStore.getState().clearProject();
      await useProjectStore
        .getState()
        .createProject("obby", "Replacement Fix Owner");
    });

    let replacementFixPromise!: Promise<void>;
    act(() => {
      replacementFixPromise = useProjectStore
        .getState()
        .autoFixIssue("project-b-fix");
    });
    expect(useProjectStore.getState().fixingIssueId).toBe("project-b-fix");
    expect(
      screen.getByRole("button", { name: "Check My Game" }),
    ).toBeDisabled();

    await act(async () => {
      olderFix.reject(new Error("Stale project A fix failed."));
      await olderFixPromise;
    });

    expect(useProjectStore.getState().fixingIssueId).toBe("project-b-fix");
    expect(
      screen.getByRole("button", { name: "Check My Game" }),
    ).toBeDisabled();

    await act(async () => {
      replacementFix.reject(new Error("Replacement fix failed."));
      await replacementFixPromise;
    });

    expect(useProjectStore.getState().fixingIssueId).toBeNull();
    expect(
      screen.getByRole("button", { name: "Check My Game" }),
    ).toBeEnabled();
  });
});
