import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateSelector } from "./TemplateSelector";
import {
  aiCommands,
  OperationUnavailableError,
  rojoCommands,
} from "../../services/tauriCommands";
import { useProjectStore } from "../../stores/projectStore";
import { useUserStore } from "../../stores/userStore";
import type { OperationReceipt } from "../../types/receipts";
import type { RojoStatus } from "../../services/tauriCommands";

const originalUserStoreState = useUserStore.getState();
const originalProjectStoreState = useProjectStore.getState();

const installedRojo: RojoStatus = {
  installed: true,
  version: "7.5.1",
  serving: false,
  serve_port: null,
  install_instructions: null,
};

const missingRojo: RojoStatus = {
  installed: false,
  version: null,
  serving: false,
  serve_port: null,
  install_instructions: "Install Rojo to sync with Studio.",
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
  useUserStore.setState(originalUserStoreState, true);
  useProjectStore.setState(originalProjectStoreState, true);
  seedProfile(false);
  vi.spyOn(aiCommands, "checkApiKey").mockResolvedValue(null);
  vi.spyOn(rojoCommands, "checkStatus").mockResolvedValue(missingRojo);
});

afterEach(() => {
  clearTauriRuntime();
  localStorage.clear();
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
    vi.mocked(rojoCommands.checkStatus).mockResolvedValueOnce(installedRojo);

    renderSelector();

    expect(await screen.findByText("2/3")).toBeInTheDocument();
    expect(screen.getByText("Set up your AI key")).not.toHaveClass("line-through");
    expect(screen.getByText(/Checking AI key/i)).toBeInTheDocument();

    await act(async () => {
      keyCheck.resolve(null);
      await keyCheck.promise;
    });

    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.getByText(/No AI key is configured/i)).toBeInTheDocument();
  });

  it("hides only after provider, installed Rojo, and a project are all authoritatively ready", async () => {
    enableTauriRuntime();
    seedRecentProject();
    vi.mocked(aiCommands.checkApiKey).mockResolvedValueOnce("openrouter");
    vi.mocked(rojoCommands.checkStatus).mockResolvedValueOnce(installedRojo);

    renderSelector();

    await waitFor(() =>
      expect(screen.queryByText("Getting Started")).not.toBeInTheDocument(),
    );
    expect(useUserStore.getState().profile.hasSetApiKey).toBe(true);
  });

  it("starts unavailable in browser, ignores a persisted flag, and calls no desktop checks", () => {
    seedProfile(true);
    seedRecentProject();

    renderSelector();

    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getAllByText(/Desktop app required/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/Checking/i)).not.toBeInTheDocument();
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
    const receipt = {
      operationId: "rojo-unavailable-id",
      correlationId: "rojo-unavailable-correlation",
      operation: "check_rojo_status",
      state: "unavailable",
      authoritative: false,
      startedAt: "2000-01-01T00:00:00.000Z",
      finishedAt: "2000-01-01T00:00:00.000Z",
      message: "Rojo authority is unavailable.",
      diagnostics: ["raw receipt detail must stay hidden"],
      retrySafety: "not_retryable",
      recoveryAction: "Restart RobloxForge Desktop.",
    } satisfies OperationReceipt;
    vi.mocked(rojoCommands.checkStatus).mockRejectedValueOnce(
      new OperationUnavailableError(receipt),
    );

    renderSelector();

    expect(await screen.findByText(/Desktop key probe failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Rojo authority is unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Restart RobloxForge Desktop/i)).toBeInTheDocument();
    expect(screen.queryByText(/raw receipt detail/i)).not.toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
  });

  it("keeps deferred successful checks incomplete when the desktop runtime disappears", async () => {
    enableTauriRuntime();
    seedRecentProject();
    const keyCheck = deferred<string | null>();
    const rojoCheck = deferred<RojoStatus>();
    const updateProfile = vi.fn();
    useUserStore.setState({ updateProfile });
    vi.mocked(aiCommands.checkApiKey).mockReturnValueOnce(keyCheck.promise);
    vi.mocked(rojoCommands.checkStatus).mockReturnValueOnce(rojoCheck.promise);
    renderSelector();

    clearTauriRuntime();
    await act(async () => {
      keyCheck.resolve("openrouter");
      rojoCheck.resolve(installedRojo);
      await Promise.all([keyCheck.promise, rojoCheck.promise]);
    });

    expect(updateProfile).not.toHaveBeenCalled();
    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getAllByText(/Desktop app required/i)).toHaveLength(2);
    expect(screen.queryByText(/OpenRouter/i)).not.toBeInTheDocument();
    expect(screen.queryByText(installedRojo.version!)).not.toBeInTheDocument();
  });

  it("uses Desktop-required hints for deferred failures after runtime disappears", async () => {
    enableTauriRuntime();
    seedRecentProject();
    const keyCheck = deferred<string | null>();
    const rojoCheck = deferred<RojoStatus>();
    vi.mocked(aiCommands.checkApiKey).mockReturnValueOnce(keyCheck.promise);
    vi.mocked(rojoCommands.checkStatus).mockReturnValueOnce(rojoCheck.promise);
    renderSelector();

    clearTauriRuntime();
    await act(async () => {
      keyCheck.reject(new Error("late key failure"));
      rojoCheck.reject(new Error("late Rojo failure"));
      await Promise.allSettled([keyCheck.promise, rojoCheck.promise]);
    });

    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(screen.getAllByText(/Desktop app required/i)).toHaveLength(2);
    expect(screen.queryByText(/late key failure/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/late Rojo failure/i)).not.toBeInTheDocument();
  });

  it("does not update state or profile when deferred checks resolve after unmount", async () => {
    enableTauriRuntime();
    const keyCheck = deferred<string | null>();
    const rojoCheck = deferred<RojoStatus>();
    const updateProfile = vi.fn();
    useUserStore.setState({ updateProfile });
    vi.mocked(aiCommands.checkApiKey).mockReturnValueOnce(keyCheck.promise);
    vi.mocked(rojoCommands.checkStatus).mockReturnValueOnce(rojoCheck.promise);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = renderSelector();

    view.unmount();
    await act(async () => {
      keyCheck.resolve("openrouter");
      rojoCheck.resolve(installedRojo);
      await Promise.all([keyCheck.promise, rojoCheck.promise]);
    });

    expect(updateProfile).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
