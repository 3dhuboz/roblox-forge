import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublishPage } from "./PublishPage";
import {
  OperationUnavailableError,
  publishCommands,
} from "../../services/tauriCommands";
import { useAuthStore } from "../../stores/authStore";
import { useProjectStore } from "../../stores/projectStore";
import { createBrowserReceipt } from "../../types/receipts";
import type { ProjectInfo } from "../../types/project";
import type { AuthState, PublishResult } from "../../types/roblox";

const originalAuthStoreState = useAuthStore.getState();
const originalProjectStoreState = useProjectStore.getState();

const auth: AuthState = {
  accessToken: "test-access-token",
  refreshToken: "test-refresh-token",
  expiresAt: Date.now() + 60_000,
  userId: "84",
  username: "publish-attempt-tester",
  displayName: "Publish Attempt Tester",
};

const project: ProjectInfo = {
  name: "Publish Attempt Contract",
  path: "D:/RobloxForge/PublishAttemptContract",
  template: "obby",
  createdAt: "2000-07-01T00:00:00.000Z",
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
  vi.useFakeTimers();
  useAuthStore.setState(originalAuthStoreState, true);
  useProjectStore.setState(originalProjectStoreState, true);
  useAuthStore.setState({
    auth,
    status: "signed_in",
    isConnecting: false,
    error: null,
    checkAuth: vi.fn().mockResolvedValue(undefined),
  });
  useProjectStore.setState({
    project,
    validationIssues: [],
    validationState: "passed",
    validationError: null,
    fixingIssueId: null,
    validateProject: vi.fn().mockResolvedValue(true),
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  useAuthStore.setState(originalAuthStoreState, true);
  useProjectStore.setState(originalProjectStoreState, true);
  vi.restoreAllMocks();
});

async function renderReadyToPublish() {
  const view = render(<PublishPage />);
  await act(async () => {
    await Promise.resolve();
  });

  fireEvent.change(screen.getByPlaceholderText("e.g. 1234567890"), {
    target: { value: "1234567890" },
  });
  fireEvent.change(screen.getByPlaceholderText("e.g. 9876543210"), {
    target: { value: "9876543210" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Check My Game" }));
    await Promise.resolve();
  });

  expect(screen.getByText("Validation Passed")).toBeInTheDocument();
  return view;
}

async function clickPublish(): Promise<void> {
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Publish to Roblox!" }),
    );
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("PublishPage attempt cleanup", () => {
  it("shows an unavailable receipt without retry or leaked phase timers", async () => {
    const unavailable = new OperationUnavailableError(
      createBrowserReceipt({
        state: "unavailable",
        operation: "publish_game",
        correlationId: "test:publish:unavailable",
        message: "Publishing is unavailable in browser preview.",
        recoveryAction: "Open RobloxForge Desktop to publish this game.",
      }),
    );
    vi.spyOn(publishCommands, "publishGame").mockRejectedValueOnce(unavailable);
    await renderReadyToPublish();

    await clickPublish();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(unavailable.message);
    expect(alert).not.toHaveTextContent("OperationUnavailableError");
    expect(
      screen.queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Your Game is Live!")).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.getByRole("alert")).toHaveTextContent(unavailable.message);
    expect(screen.queryByText("Your Game is Live!")).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears every phase timer when unmounted during a pending publish", async () => {
    const pendingPublish = deferred<PublishResult>();
    vi.spyOn(publishCommands, "publishGame").mockReturnValueOnce(
      pendingPublish.promise,
    );
    const view = await renderReadyToPublish();

    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Publish to Roblox!" }),
      );
    });

    expect(vi.getTimerCount()).toBe(2);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);

    await act(async () => {
      pendingPublish.resolve({ success: true });
      await pendingPublish.promise;
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps a normal rejection visible after phase time advances", async () => {
    vi.spyOn(publishCommands, "publishGame").mockRejectedValueOnce(
      new Error("Roblox gateway timed out."),
    );
    await renderReadyToPublish();

    await clickPublish();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Roblox gateway timed out.",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Roblox gateway timed out.",
    );
    expect(screen.queryByText("Your Game is Live!")).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not publish when auth is invalidated at action time", async () => {
    const publishGame = vi
      .spyOn(publishCommands, "publishGame")
      .mockResolvedValueOnce({ success: true });
    await renderReadyToPublish();
    const publishButton = screen.getByRole("button", {
      name: "Publish to Roblox!",
    });

    await act(async () => {
      useAuthStore.setState({
        auth: null,
        status: "unavailable",
        isConnecting: false,
        error:
          "Roblox authentication requires the RobloxForge Desktop app. Open the Desktop app to continue.",
      });
      fireEvent.click(publishButton);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(publishGame).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/Desktop app/i);
    expect(vi.getTimerCount()).toBe(0);
  });
});
