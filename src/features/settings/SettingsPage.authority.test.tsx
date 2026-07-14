import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";
import {
  aiCommands,
  OperationUnavailableError,
  robloxAuthorityCommands,
  rojoCommands,
} from "../../services/tauriCommands";
import { useUserStore } from "../../stores/userStore";
import type { OperationReceipt } from "../../types/receipts";
import type { RojoStatus } from "../../services/tauriCommands";
import type { RobloxAuthorityState } from "../../types/robloxAuthority";

const originalUserStoreState = useUserStore.getState();

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
  install_instructions: "Install Rojo from rojo.space.",
};

const emptyRobloxAuthority: RobloxAuthorityState = {
  publishCredential: {
    purpose: "publish",
    configured: false,
    alias: "publish-default",
  },
  analyticsCredential: {
    purpose: "analytics",
    configured: false,
    alias: "analytics-default",
  },
  targets: [],
  capabilities: {
    authMode: "api_key",
    createUniverse: {
      state: "unsupported",
      ready: false,
      requiredScopes: [],
      reason: "Open Cloud cannot create a universe.",
    },
    publishExistingPlace: {
      state: "setup_required",
      ready: false,
      requiredScopes: [],
      reason: "Configure a publish key.",
    },
    updatePlaceMetadata: {
      state: "setup_required",
      ready: false,
      requiredScopes: [],
      reason: "Configure a publish key.",
    },
    ownedAnalytics: {
      state: "setup_required",
      ready: false,
      requiredScopes: [],
      reason: "Configure an analytics key.",
    },
  },
  createUniverseSupported: false,
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

function expandStudioSync() {
  const region = screen.getByRole("region", { name: "Advanced Studio Sync" });
  fireEvent.click(
    within(region).getByRole("button", { name: "Show Advanced Studio Sync" }),
  );
  return region;
}

function setPersistedApiKey(value: boolean): void {
  useUserStore.setState({
    profile: {
      ...originalUserStoreState.profile,
      hasSetApiKey: value,
    },
  });
}

beforeEach(() => {
  clearTauriRuntime();
  localStorage.clear();
  useUserStore.setState(originalUserStoreState, true);
  setPersistedApiKey(false);

  vi.spyOn(aiCommands, "checkApiKey").mockResolvedValue(null);
  vi.spyOn(aiCommands, "setApiKey").mockResolvedValue(undefined);
  vi.spyOn(rojoCommands, "checkStatus").mockResolvedValue(missingRojo);
  vi.spyOn(rojoCommands, "startServe").mockResolvedValue(34872);
  vi.spyOn(rojoCommands, "stopServe").mockResolvedValue(undefined);
  vi.spyOn(robloxAuthorityCommands, "getState").mockResolvedValue(
    emptyRobloxAuthority,
  );
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  clearTauriRuntime();
  localStorage.clear();
  useUserStore.setState(originalUserStoreState, true);
  vi.restoreAllMocks();
});

describe("SettingsPage desktop authority", () => {
  it("keeps optional Studio Sync collapsed in browser without calls", () => {
    setPersistedApiKey(true);

    render(<SettingsPage />);

    const region = screen.getByRole("region", { name: "Advanced Studio Sync" });
    expect(within(region).getByText("Optional")).toBeInTheDocument();
    expect(
      within(region).getByText(
        /Not needed to create, preview, publish, or monitor your game/,
      ),
    ).toBeInTheDocument();
    expect(
      within(region).getByRole("button", { name: "Show Advanced Studio Sync" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByText(
        /AI key management requires the RobloxForge Desktop app/i,
      ),
    ).toBeInTheDocument();
    expect(
      within(region).queryByText(
        /Rojo status requires|Rojo Installed|Checking Rojo/i,
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("AI API key")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(aiCommands.checkApiKey).not.toHaveBeenCalled();
    expect(aiCommands.setApiKey).not.toHaveBeenCalled();
    expect(rojoCommands.checkStatus).not.toHaveBeenCalled();
    expect(rojoCommands.startServe).not.toHaveBeenCalled();
    expect(rojoCommands.stopServe).not.toHaveBeenCalled();
  });

  it("shows neutral browser guidance only when Studio Sync expands", () => {
    render(<SettingsPage />);
    const region = expandStudioSync();
    expect(within(region).getByRole("status")).toHaveTextContent(
      "Advanced Studio Sync can only be managed in RobloxForge Desktop.",
    );
    expect(within(region).queryByRole("alert")).not.toBeInTheDocument();
    expect(rojoCommands.checkStatus).not.toHaveBeenCalled();
  });

  it("checks Rojo exactly once on first Desktop expansion", async () => {
    enableTauriRuntime();
    render(<SettingsPage />);
    expect(rojoCommands.checkStatus).not.toHaveBeenCalled();
    const region = expandStudioSync();
    await within(region).findByRole("status");
    expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(1);
  });

  it("shows missing Rojo as neutral guidance", async () => {
    enableTauriRuntime();
    render(<SettingsPage />);
    const region = expandStudioSync();
    expect(
      await within(region).findByText(
        "Rojo is not installed. That is fine unless you choose live Studio sync.",
      ),
    ).toBeInTheDocument();
    expect(within(region).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("defensively skips save, refresh, and Rojo actions if the desktop runtime disappears", async () => {
    enableTauriRuntime();
    vi.mocked(rojoCommands.checkStatus).mockResolvedValueOnce(installedRojo);
    render(<SettingsPage />);
    expandStudioSync();
    await screen.findByRole("button", { name: "Start Sync to Studio" });
    await screen.findByText(/No AI key is configured/i);
    expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("AI API key"), {
      target: { value: "sk-or-private-value" },
    });
    clearTauriRuntime();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Refresh Rojo status/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Start Sync to Studio" }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(aiCommands.setApiKey).not.toHaveBeenCalled();
    expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(1);
    expect(rojoCommands.startServe).not.toHaveBeenCalled();
  });

  it("does not promote a deferred save after the desktop runtime disappears", async () => {
    enableTauriRuntime();
    const save = deferred<void>();
    vi.mocked(aiCommands.setApiKey).mockReturnValueOnce(save.promise);
    render(<SettingsPage />);
    await screen.findByText(/No AI key is configured/i);
    fireEvent.change(screen.getByLabelText("AI API key"), {
      target: { value: "my-private-value" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();

    clearTauriRuntime();
    await act(async () => {
      save.resolve();
      await save.promise;
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      /AI key management requires the RobloxForge Desktop app/i,
    );
    expect(screen.queryByText("Saved!")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/AI key configured in RobloxForge Desktop/i),
    ).not.toBeInTheDocument();
    expect(useUserStore.getState().profile.hasSetApiKey).toBe(false);
    expect(screen.getByLabelText("AI API key")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Show AI API key" }),
    ).toBeDisabled();
  });

  it("does not run a follow-up Rojo check when runtime disappears during start", async () => {
    enableTauriRuntime();
    const start = deferred<number>();
    vi.mocked(rojoCommands.checkStatus).mockResolvedValueOnce(installedRojo);
    vi.mocked(rojoCommands.startServe).mockReturnValueOnce(start.promise);
    render(<SettingsPage />);
    expandStudioSync();
    await screen.findByRole("button", { name: "Start Sync to Studio" });
    expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Start Sync to Studio" }),
    );

    clearTauriRuntime();
    await act(async () => {
      start.resolve(34872);
      await start.promise;
    });

    expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(1);
    const region = screen.getByRole("region", { name: "Advanced Studio Sync" });
    expect(within(region).getByRole("status")).toHaveTextContent(
      "Advanced Studio Sync can only be managed in RobloxForge Desktop.",
    );
    expect(
      within(region).queryByText("Rojo Installed"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Refresh Rojo status/i }),
    ).toBeDisabled();
  });

  it("does not promote a deferred follow-up Rojo check after runtime disappears", async () => {
    enableTauriRuntime();
    const refreshedStatus = deferred<RojoStatus>();
    vi.mocked(rojoCommands.checkStatus)
      .mockResolvedValueOnce(installedRojo)
      .mockReturnValueOnce(refreshedStatus.promise);
    render(<SettingsPage />);
    expandStudioSync();
    await screen.findByRole("button", { name: "Start Sync to Studio" });
    fireEvent.click(
      screen.getByRole("button", { name: "Start Sync to Studio" }),
    );
    await waitFor(() =>
      expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(2),
    );

    clearTauriRuntime();
    await act(async () => {
      refreshedStatus.resolve({
        ...installedRojo,
        serving: true,
        serve_port: 34872,
      });
      await refreshedStatus.promise;
    });

    const region = screen.getByRole("region", { name: "Advanced Studio Sync" });
    expect(within(region).getByRole("status")).toHaveTextContent(
      "Advanced Studio Sync can only be managed in RobloxForge Desktop.",
    );
    expect(
      within(region).queryByText("Rojo Installed"),
    ).not.toBeInTheDocument();
  });

  it("does not promote deferred initial authority checks after runtime disappears", async () => {
    enableTauriRuntime();
    const keyCheck = deferred<string | null>();
    vi.mocked(aiCommands.checkApiKey).mockReturnValueOnce(keyCheck.promise);
    render(<SettingsPage />);

    clearTauriRuntime();
    await act(async () => {
      keyCheck.resolve("openrouter");
      await keyCheck.promise;
    });

    expect(useUserStore.getState().profile.hasSetApiKey).toBe(false);
    expect(
      screen.getByText(
        /AI key management requires the RobloxForge Desktop app/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/AI key configured in RobloxForge Desktop/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Rojo Installed")).not.toBeInTheDocument();
    expect(rojoCommands.checkStatus).not.toHaveBeenCalled();
  });
  it("treats a desktop null check as missing even when the persisted profile says configured", async () => {
    enableTauriRuntime();
    setPersistedApiKey(true);

    render(<SettingsPage />);

    expect(
      await screen.findByText(
        /No AI key is configured in RobloxForge Desktop/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/AI key configured/i)).not.toBeInTheDocument();
  });

  it("keeps a rejected desktop key check visible without claiming success or changing the profile", async () => {
    enableTauriRuntime();
    vi.mocked(aiCommands.checkApiKey).mockRejectedValueOnce(
      new Error("AI key check failed at the desktop boundary."),
    );

    render(<SettingsPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "AI key check failed at the desktop boundary.",
    );
    expect(screen.queryByText("Saved!")).not.toBeInTheDocument();
    expect(useUserStore.getState().profile.hasSetApiKey).toBe(false);
  });

  it("renders only the safe typed-unavailable message and recovery action", async () => {
    enableTauriRuntime();
    const receipt = {
      operationId: "do-not-render-operation-id",
      correlationId: "do-not-render-correlation-id",
      operation: "check_api_key",
      state: "unavailable",
      authoritative: false,
      startedAt: "2000-01-01T00:00:00.000Z",
      finishedAt: "2000-01-01T00:00:00.000Z",
      message: "AI key authority is temporarily unavailable.",
      diagnostics: ["sk-or-do-not-render"],
      retrySafety: "not_retryable",
      recoveryAction: "Restart RobloxForge Desktop and try again.",
      value: { apiKey: "sk-or-do-not-render" },
    } satisfies OperationReceipt<{ apiKey: string }>;
    vi.mocked(aiCommands.checkApiKey).mockRejectedValueOnce(
      new OperationUnavailableError(receipt),
    );

    render(<SettingsPage />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(receipt.message);
    expect(alert).toHaveTextContent(receipt.recoveryAction);
    expect(alert).not.toHaveTextContent(receipt.correlationId);
    expect(alert).not.toHaveTextContent("sk-or-do-not-render");
  });

  it("guards a rejected save immediately and never reports Saved or updates the profile", async () => {
    enableTauriRuntime();
    vi.mocked(aiCommands.setApiKey).mockRejectedValueOnce(
      new Error("Desktop refused to save the AI key."),
    );
    render(<SettingsPage />);
    await screen.findByText(/No AI key is configured/i);
    fireEvent.change(screen.getByLabelText("AI API key"), {
      target: { value: "sk-or-private-value" },
    });
    const saveButton = screen.getByRole("button", { name: "Save" });

    await act(async () => {
      fireEvent.click(saveButton);
      fireEvent.click(saveButton);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(aiCommands.setApiKey).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Desktop refused to save the AI key.",
    );
    expect(screen.queryByText("Saved!")).not.toBeInTheDocument();
    expect(useUserStore.getState().profile.hasSetApiKey).toBe(false);
  });

  it("never renders an arbitrary submitted key echoed by a generic save failure", async () => {
    enableTauriRuntime();
    const submittedKey = "my-private-value";
    vi.mocked(aiCommands.setApiKey).mockRejectedValueOnce(
      new Error(`Save failed for ${submittedKey}`),
    );
    render(<SettingsPage />);
    await screen.findByText(/No AI key is configured/i);
    fireEvent.change(screen.getByLabelText("AI API key"), {
      target: { value: submittedKey },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "RobloxForge Desktop could not save the AI key.",
    );
    expect(document.body).not.toHaveTextContent(submittedKey);
    expect(screen.queryByDisplayValue(submittedKey)).not.toBeInTheDocument();
    expect(screen.queryByText("Saved!")).not.toBeInTheDocument();
    expect(useUserStore.getState().profile.hasSetApiKey).toBe(false);
  });

  it("redacts an arbitrary submitted key echoed by typed unavailable fields", async () => {
    enableTauriRuntime();
    const submittedKey = "my-private-value";
    const receipt = {
      operationId: "save-unavailable-operation",
      correlationId: "save-unavailable-correlation",
      operation: "set_api_key",
      state: "unavailable",
      authoritative: false,
      startedAt: "2000-01-01T00:00:00.000Z",
      finishedAt: "2000-01-01T00:00:00.000Z",
      message: `Save authority rejected ${submittedKey}.`,
      diagnostics: [],
      retrySafety: "not_retryable",
      recoveryAction: `Remove ${submittedKey} and restart Desktop.`,
    } satisfies OperationReceipt;
    vi.mocked(aiCommands.setApiKey).mockRejectedValueOnce(
      new OperationUnavailableError(receipt),
    );
    render(<SettingsPage />);
    await screen.findByText(/No AI key is configured/i);
    fireEvent.change(screen.getByLabelText("AI API key"), {
      target: { value: submittedKey },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "RobloxForge Desktop could not save the AI key.",
    );
    expect(alert).toHaveTextContent(
      "Follow the recovery steps shown in RobloxForge Desktop.",
    );
    expect(document.body).not.toHaveTextContent(submittedKey);
    expect(screen.queryByDisplayValue(submittedKey)).not.toBeInTheDocument();
    expect(screen.queryByText("Saved!")).not.toBeInTheDocument();
    expect(useUserStore.getState().profile.hasSetApiKey).toBe(false);
  });

  it("shows Saving until a deferred save resolves, then records Saved and clears its timer on unmount", async () => {
    vi.useFakeTimers();
    enableTauriRuntime();
    const save = deferred<void>();
    vi.mocked(aiCommands.setApiKey).mockReturnValueOnce(save.promise);
    const view = render(<SettingsPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    fireEvent.change(screen.getByLabelText("AI API key"), {
      target: { value: "sk-or-private-value" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.queryByText("Saved!")).not.toBeInTheDocument();
    expect(useUserStore.getState().profile.hasSetApiKey).toBe(false);
    const timerCountBeforeSuccess = vi.getTimerCount();

    await act(async () => {
      save.resolve();
      await save.promise;
    });

    expect(screen.getByText("Saved!")).toBeInTheDocument();
    expect(useUserStore.getState().profile.hasSetApiKey).toBe(true);
    const timerCountWithSuccess = vi.getTimerCount();
    expect(timerCountWithSuccess).toBeGreaterThan(timerCountBeforeSuccess);
    view.unmount();
    expect(vi.getTimerCount()).toBeLessThan(timerCountWithSuccess);
  });

  it("does not let a delayed initial key check overwrite a newer successful save", async () => {
    enableTauriRuntime();
    const initialCheck = deferred<string | null>();
    vi.mocked(aiCommands.checkApiKey).mockReturnValueOnce(initialCheck.promise);
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("AI API key"), {
      target: { value: "sk-or-private-value" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText("Saved!")).toBeInTheDocument();

    await act(async () => {
      initialCheck.resolve(null);
      await initialCheck.promise;
    });

    expect(screen.getByText("Saved!")).toBeInTheDocument();
    expect(
      screen.getByText(/AI key configured in RobloxForge Desktop/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No AI key is configured/i),
    ).not.toBeInTheDocument();
  });

  it("shows a later Rojo action rejection ahead of stale status and clears it after a successful refresh", async () => {
    enableTauriRuntime();
    vi.mocked(rojoCommands.checkStatus)
      .mockResolvedValueOnce(installedRojo)
      .mockResolvedValueOnce({
        ...installedRojo,
        serving: true,
        serve_port: 34872,
      });
    vi.mocked(rojoCommands.startServe).mockRejectedValueOnce(
      new Error("Rojo could not start for this project."),
    );
    render(<SettingsPage />);
    expandStudioSync();
    expect(
      await screen.findByRole("button", { name: "Start Sync to Studio" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Start Sync to Studio" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Rojo could not start for this project.",
    );
    expect(screen.queryByText("Rojo Installed")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Refresh Rojo status/i }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Serving")).toBeInTheDocument();
  });

  it("shows a stop rejection ahead of the previously serving Rojo status", async () => {
    enableTauriRuntime();
    vi.mocked(rojoCommands.checkStatus).mockResolvedValueOnce({
      ...installedRojo,
      serving: true,
      serve_port: 34872,
    });
    vi.mocked(rojoCommands.stopServe).mockRejectedValueOnce(
      new Error("Rojo could not stop the current server."),
    );
    render(<SettingsPage />);
    expandStudioSync();
    expect(
      await screen.findByRole("button", { name: "Stop" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Rojo could not stop the current server.",
    );
    expect(screen.queryByText("Rojo Installed")).not.toBeInTheDocument();
    expect(rojoCommands.stopServe).toHaveBeenCalledTimes(1);
  });

  it("shows a refresh rejection ahead of the previously checked Rojo status", async () => {
    enableTauriRuntime();
    vi.mocked(rojoCommands.checkStatus)
      .mockResolvedValueOnce(installedRojo)
      .mockRejectedValueOnce(new Error("Rojo refresh failed."));
    render(<SettingsPage />);
    expandStudioSync();
    await screen.findByRole("button", { name: "Start Sync to Studio" });

    fireEvent.click(
      screen.getByRole("button", { name: /Refresh Rojo status/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Rojo refresh failed.",
    );
    expect(screen.queryByText("Rojo Installed")).not.toBeInTheDocument();
    expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(2);
  });

  it("reconciles after a stale status settles across collapse and reopen", async () => {
    enableTauriRuntime();
    const oldStatus = deferred<RojoStatus>();
    vi.mocked(rojoCommands.checkStatus)
      .mockReturnValueOnce(oldStatus.promise)
      .mockResolvedValueOnce(missingRojo);
    render(<SettingsPage />);
    expandStudioSync();
    await waitFor(() =>
      expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(1),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Hide Advanced Studio Sync" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Show Advanced Studio Sync" }),
    );
    expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(1);
    await act(async () => {
      oldStatus.resolve(installedRojo);
      await oldStatus.promise;
    });
    await waitFor(() =>
      expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(2),
    );
    expect(
      await screen.findByText(/Rojo is not installed/),
    ).toBeInTheDocument();
  });

  it("keeps Start locked across collapse and reopen and reconciles once", async () => {
    enableTauriRuntime();
    vi.mocked(rojoCommands.checkStatus)
      .mockResolvedValueOnce(installedRojo)
      .mockResolvedValueOnce({
        ...installedRojo,
        serving: true,
        serve_port: 34872,
      });
    const start = deferred<number>();
    vi.mocked(rojoCommands.startServe).mockReturnValueOnce(start.promise);
    render(<SettingsPage />);
    expandStudioSync();
    await screen.findByRole("button", { name: "Start Sync to Studio" });
    fireEvent.click(
      screen.getByRole("button", { name: "Start Sync to Studio" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Hide Advanced Studio Sync" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Show Advanced Studio Sync" }),
    );
    await act(async () => {
      start.resolve(34872);
      await start.promise;
    });
    await waitFor(() =>
      expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(2),
    );
    expect(rojoCommands.startServe).toHaveBeenCalledTimes(1);
  });

  it("handles same-tick Stop clicks exactly once", async () => {
    enableTauriRuntime();
    vi.mocked(rojoCommands.checkStatus).mockResolvedValueOnce({
      ...installedRojo,
      serving: true,
      serve_port: 34872,
    });
    render(<SettingsPage />);
    expandStudioSync();
    await screen.findByRole("button", { name: "Stop" });
    await act(async () => {
      screen.getByRole("button", { name: "Stop" }).click();
      screen.getByRole("button", { name: "Stop" }).click();
      await Promise.resolve();
    });
    expect(rojoCommands.stopServe).toHaveBeenCalledTimes(1);
  });

  it("handles same-tick Start clicks exactly once", async () => {
    enableTauriRuntime();
    vi.mocked(rojoCommands.checkStatus).mockResolvedValueOnce(installedRojo);
    const start = deferred<number>();
    vi.mocked(rojoCommands.startServe).mockReturnValueOnce(start.promise);
    render(<SettingsPage />);
    expandStudioSync();
    await screen.findByRole("button", { name: "Start Sync to Studio" });
    await act(async () => {
      screen.getByRole("button", { name: "Start Sync to Studio" }).click();
      screen.getByRole("button", { name: "Start Sync to Studio" }).click();
    });
    expect(rojoCommands.startServe).toHaveBeenCalledTimes(1);
    await act(async () => {
      start.resolve(34872);
      await start.promise;
    });
  });

  it("does not reconcile after unmount during a probe", async () => {
    enableTauriRuntime();
    const probe = deferred<RojoStatus>();
    vi.mocked(rojoCommands.checkStatus).mockReturnValueOnce(probe.promise);
    const view = render(<SettingsPage />);
    expandStudioSync();
    await waitFor(() =>
      expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(1),
    );
    view.unmount();
    await act(async () => {
      probe.resolve(installedRojo);
      await probe.promise;
    });
    expect(rojoCommands.checkStatus).toHaveBeenCalledTimes(1);
  });
});
