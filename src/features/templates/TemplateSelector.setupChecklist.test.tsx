import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateSelector } from "./TemplateSelector";
import {
  aiCommands,
} from "../../services/tauriCommands";
import { useProjectStore } from "../../stores/projectStore";
import { useUserStore } from "../../stores/userStore";

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
  useUserStore.setState(originalUserStoreState, true);
  useProjectStore.setState(originalProjectStoreState, true);
  seedProfile(false);
  vi.spyOn(aiCommands, "checkApiKey").mockResolvedValue(null);
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

    renderSelector();

    expect(await screen.findByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("Set up your AI key")).not.toHaveClass("line-through");
    expect(screen.getByText(/Checking AI key/i)).toBeInTheDocument();

    await act(async () => {
      keyCheck.resolve(null);
      await keyCheck.promise;
    });

    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText(/No AI key is configured/i)).toBeInTheDocument();
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
  });

  it("starts unavailable in browser, ignores a persisted flag, and calls no desktop checks", () => {
    seedProfile(true);
    seedRecentProject();

    renderSelector();

    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getAllByText(/Desktop app required/i)).toHaveLength(1);
    expect(screen.queryByText(/Checking/i)).not.toBeInTheDocument();
    expect(aiCommands.checkApiKey).not.toHaveBeenCalled();
  });

  it("keeps generic and typed desktop failures distinct and incomplete", async () => {
    enableTauriRuntime();
    seedProfile(true);
    seedRecentProject();
    vi.mocked(aiCommands.checkApiKey).mockRejectedValueOnce(
      new Error("Desktop key probe failed."),
    );

    renderSelector();

    expect(await screen.findByText(/Desktop key probe failed/i)).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("keeps deferred successful checks incomplete when the desktop runtime disappears", async () => {
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
    expect(screen.getAllByText(/Desktop app required/i)).toHaveLength(1);
    expect(screen.queryByText(/OpenRouter/i)).not.toBeInTheDocument();
    expect(screen.queryByText(installedRojo.version!)).not.toBeInTheDocument();
  });

  it("uses Desktop-required hints for deferred failures after runtime disappears", async () => {
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
    expect(screen.getAllByText(/Desktop app required/i)).toHaveLength(1);
    expect(screen.queryByText(/late key failure/i)).not.toBeInTheDocument();
  });

  it("does not update state or profile when deferred checks resolve after unmount", async () => {
    enableTauriRuntime();
    const keyCheck = deferred<string | null>();
    const updateProfile = vi.fn();
    useUserStore.setState({ updateProfile });
    vi.mocked(aiCommands.checkApiKey).mockReturnValueOnce(keyCheck.promise);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = renderSelector();

    view.unmount();
    await act(async () => {
      keyCheck.resolve("openrouter");
      await keyCheck.promise;
    });

    expect(updateProfile).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
