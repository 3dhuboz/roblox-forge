import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateSelector } from "./TemplateSelector";
import {
  aiCommands,
  OperationUnavailableError,
  rojoCommands,
} from "../../services/tauriCommands";
import type { OperationReceipt } from "../../types/receipts";
import { useProjectStore } from "../../stores/projectStore";
import { useUserStore } from "../../stores/userStore";
import * as browserAi from "../../services/browserPreviewAi";

const originalUserStoreState = useUserStore.getState();
const originalProjectStoreState = useProjectStore.getState();

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function enableTauriRuntime(): void {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
}

function clearTauriRuntime(): void {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
}

function seedProfile(hasSetApiKey: boolean): void {
  useUserStore.setState({
    profile: {
      ...originalUserStoreState.profile,
      hasSetApiKey,
    },
  });
}

function seedRecentProject(): void {
  localStorage.setItem(
    "roblox-forge-recent",
    JSON.stringify([
      {
        name: "Authority Test Project",
        template: "obby",
        path: "D:/RobloxForge/AuthorityTestProject",
        createdAt: "2000-01-01T00:00:00.000Z",
      },
    ]),
  );
}

function renderSelector() {
  return render(
    <MemoryRouter>
      <TemplateSelector />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  clearTauriRuntime();
  localStorage.clear();
  sessionStorage.clear();
  useUserStore.setState(originalUserStoreState, true);
  useProjectStore.setState(originalProjectStoreState, true);
  seedProfile(false);
  vi.spyOn(aiCommands, "checkApiKey").mockResolvedValue(null);
  vi.spyOn(browserAi, "checkBrowserAiKey").mockResolvedValue(null);
  vi.spyOn(rojoCommands, "checkStatus").mockResolvedValue({
    installed: false,
    version: null,
    serving: false,
    serve_port: null,
    install_instructions: "Install Rojo to sync with Studio.",
  });
});

afterEach(() => {
  clearTauriRuntime();
  localStorage.clear();
  sessionStorage.clear();
  useUserStore.setState(originalUserStoreState, true);
  useProjectStore.setState(originalProjectStoreState, true);
  vi.restoreAllMocks();
});

describe("TemplateSelector setup checklist authority", () => {
  it("keeps a persisted API flag incomplete while a deferred authoritative key check is pending", async () => {
    enableTauriRuntime();
    seedProfile(true);
    seedRecentProject();
    const keyCheck = deferred<string | null>();
    vi.mocked(aiCommands.checkApiKey).mockReturnValueOnce(keyCheck.promise);

    renderSelector();

    expect(await screen.findByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("Set up your AI key")).not.toHaveClass(
      "line-through",
    );
    expect(screen.getByText(/Checking AI key/i)).toBeInTheDocument();

    await act(async () => {
      keyCheck.resolve(null);
      await keyCheck.promise;
    });

    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText(/No AI key is configured/i)).toBeInTheDocument();
    expect(rojoCommands.checkStatus).not.toHaveBeenCalled();
  });

  it("hides only after provider and a project are authoritatively ready", async () => {
    enableTauriRuntime();
    seedRecentProject();
    vi.mocked(aiCommands.checkApiKey).mockResolvedValueOnce("openrouter");

    renderSelector();

    await waitFor(() =>
      expect(screen.queryByText("Getting Started")).not.toBeInTheDocument(),
    );
    expect(useUserStore.getState().profile.hasSetApiKey).toBe(true);
    expect(rojoCommands.checkStatus).not.toHaveBeenCalled();
  });

  it("uses the validated browser-session key and calls no desktop checks", async () => {
    seedProfile(true);
    seedRecentProject();
    vi.mocked(browserAi.checkBrowserAiKey).mockResolvedValueOnce("openrouter");

    renderSelector();

    await waitFor(() =>
      expect(screen.queryByText("Getting Started")).not.toBeInTheDocument(),
    );
    expect(browserAi.checkBrowserAiKey).toHaveBeenCalledTimes(1);
    expect(aiCommands.checkApiKey).not.toHaveBeenCalled();
    expect(rojoCommands.checkStatus).not.toHaveBeenCalled();
  });

  it("keeps generic and typed desktop failures distinct and incomplete", async () => {
    enableTauriRuntime();
    seedProfile(true);
    seedRecentProject();
    vi.mocked(aiCommands.checkApiKey).mockRejectedValueOnce(
      new Error("Desktop key probe failed."),
    );

    const genericView = renderSelector();

    expect(
      await screen.findByText(/Desktop key probe failed/i),
    ).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    genericView.unmount();

    const receipt = {
      operationId: "key-unavailable-id",
      correlationId: "key-unavailable-correlation",
      operation: "check_api_key",
      state: "unavailable",
      authoritative: false,
      startedAt: "2000-01-01T00:00:00.000Z",
      finishedAt: "2000-01-01T00:00:00.000Z",
      message: "AI key authority is unavailable.",
      diagnostics: ["raw receipt detail must stay hidden"],
      retrySafety: "not_retryable",
      recoveryAction: "Restart RobloxForge Desktop.",
    } satisfies OperationReceipt;
    vi.mocked(aiCommands.checkApiKey).mockRejectedValueOnce(
      new OperationUnavailableError(receipt),
    );
    const view = renderSelector();
    expect(
      await screen.findByText(/AI key authority is unavailable/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Restart RobloxForge Desktop/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/raw receipt detail/i)).not.toBeInTheDocument();
    view.unmount();
    expect(rojoCommands.checkStatus).not.toHaveBeenCalled();
  });

  it("falls back to the browser-session check when Desktop disappears", async () => {
    enableTauriRuntime();
    seedRecentProject();
    const keyCheck = deferred<string | null>();
    const updateProfile = vi.fn();
    useUserStore.setState({ updateProfile });
    vi.mocked(aiCommands.checkApiKey).mockReturnValueOnce(keyCheck.promise);
    renderSelector();

    clearTauriRuntime();
    await act(async () => {
      keyCheck.resolve("openrouter");
      await keyCheck.promise;
    });

    expect(updateProfile).not.toHaveBeenCalled();
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(
      screen.getByText(/Connect an OpenRouter key in Settings/i),
    ).toBeInTheDocument();
    expect(browserAi.checkBrowserAiKey).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Install Rojo")).not.toBeInTheDocument();
    expect(rojoCommands.checkStatus).not.toHaveBeenCalled();
  });

  it("uses browser-session guidance for deferred failures after Desktop disappears", async () => {
    enableTauriRuntime();
    seedRecentProject();
    const keyCheck = deferred<string | null>();
    vi.mocked(aiCommands.checkApiKey).mockReturnValueOnce(keyCheck.promise);
    renderSelector();

    clearTauriRuntime();
    await act(async () => {
      keyCheck.reject(new Error("late key failure"));
      await Promise.allSettled([keyCheck.promise]);
    });

    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(
      screen.getByText(/Connect an OpenRouter key in Settings/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/late key failure/i)).not.toBeInTheDocument();
    expect(browserAi.checkBrowserAiKey).toHaveBeenCalledTimes(1);
    expect(rojoCommands.checkStatus).not.toHaveBeenCalled();
  });

  it("does not update state or profile when deferred checks resolve after unmount", async () => {
    enableTauriRuntime();
    const keyCheck = deferred<string | null>();
    const updateProfile = vi.fn();
    useUserStore.setState({ updateProfile });
    vi.mocked(aiCommands.checkApiKey).mockReturnValueOnce(keyCheck.promise);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const view = renderSelector();

    view.unmount();
    await act(async () => {
      keyCheck.resolve("openrouter");
      await keyCheck.promise;
    });

    expect(updateProfile).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    expect(rojoCommands.checkStatus).not.toHaveBeenCalled();
  });
});
