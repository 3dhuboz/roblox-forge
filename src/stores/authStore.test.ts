import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OperationUnavailableError,
  authCommands,
} from "../services/tauriCommands";
import { createBrowserReceipt } from "../types/receipts";
import type { AuthState } from "../types/roblox";
import { useAuthStore } from "./authStore";

const originalAuthStoreState = useAuthStore.getState();

const validAuth: AuthState = {
  accessToken: "test-access-token",
  refreshToken: "test-refresh-token",
  expiresAt: Date.now() + 60_000,
  userId: "42",
  username: "auth-tester",
  displayName: "Auth Tester",
};

function setTauriRuntime(enabled: boolean): void {
  if (enabled) {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    return;
  }

  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
}

function unavailableError(operation: string): OperationUnavailableError {
  return new OperationUnavailableError(
    createBrowserReceipt({
      state: "unavailable",
      operation,
      correlationId: `test:auth:${operation}`,
      message: "Roblox authentication is unavailable.",
      recoveryAction: "Open RobloxForge Desktop to continue.",
    }),
  );
}

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
  setTauriRuntime(false);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  setTauriRuntime(false);
  useAuthStore.setState(originalAuthStoreState, true);
  vi.restoreAllMocks();
});

describe("auth availability lifecycle", () => {
  it("classifies browser auth checks as unavailable without consulting desktop authority", async () => {
    const getAuthState = vi.spyOn(authCommands, "getAuthState");

    await useAuthStore.getState().checkAuth();

    expect(getAuthState).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toEqual(
      expect.objectContaining({
        auth: null,
        status: "unavailable",
        isConnecting: false,
        error: expect.stringMatching(/Desktop app/i),
      }),
    );
  });

  it("classifies an authoritative null desktop session as signed out", async () => {
    setTauriRuntime(true);
    vi.spyOn(authCommands, "getAuthState").mockResolvedValueOnce(null);

    await useAuthStore.getState().checkAuth();

    expect(useAuthStore.getState()).toEqual(
      expect.objectContaining({
        auth: null,
        status: "signed_out",
        isConnecting: false,
        error: null,
      }),
    );
  });

  it("preserves typed authority-unavailable failures as unavailable", async () => {
    setTauriRuntime(true);
    const unavailable = unavailableError("get_auth_state");
    vi.spyOn(authCommands, "getAuthState").mockRejectedValueOnce(unavailable);

    await useAuthStore.getState().checkAuth();

    expect(useAuthStore.getState()).toEqual(
      expect.objectContaining({
        auth: null,
        status: "unavailable",
        isConnecting: false,
        error: expect.stringContaining(unavailable.message),
      }),
    );
  });

  it("does not start desktop login or polling in browser preview", async () => {
    const startOauthFlow = vi.spyOn(authCommands, "startOauthFlow");
    const getAuthState = vi.spyOn(authCommands, "getAuthState");

    await useAuthStore.getState().startLogin();

    expect(startOauthFlow).not.toHaveBeenCalled();
    expect(getAuthState).not.toHaveBeenCalled();
    expect(useAuthStore.getState().status).toBe("unavailable");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops login polling and clears every timer on typed unavailability", async () => {
    setTauriRuntime(true);
    const unavailable = unavailableError("get_auth_state");
    vi.spyOn(authCommands, "startOauthFlow").mockResolvedValueOnce(
      "https://example.test/oauth",
    );
    const getAuthState = vi
      .spyOn(authCommands, "getAuthState")
      .mockRejectedValueOnce(unavailable);

    await useAuthStore.getState().startLogin();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(getAuthState).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toEqual(
      expect.objectContaining({
        auth: null,
        status: "unavailable",
        isConnecting: false,
      }),
    );
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(getAuthState).toHaveBeenCalledTimes(1);
  });

  it("prevents an older login poll from racing a newer auth check", async () => {
    setTauriRuntime(true);
    const olderPoll = deferred<AuthState | null>();
    vi.spyOn(authCommands, "startOauthFlow").mockResolvedValueOnce(
      "https://example.test/oauth",
    );
    vi.spyOn(authCommands, "getAuthState")
      .mockReturnValueOnce(olderPoll.promise)
      .mockResolvedValueOnce(null);

    await useAuthStore.getState().startLogin();
    vi.advanceTimersByTime(1_000);
    await Promise.resolve();

    await useAuthStore.getState().checkAuth();
    olderPoll.resolve(validAuth);
    await Promise.resolve();
    await Promise.resolve();

    expect(useAuthStore.getState()).toEqual(
      expect.objectContaining({
        auth: null,
        status: "signed_out",
        isConnecting: false,
      }),
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps browser logout unavailable without invoking desktop authority", async () => {
    await useAuthStore.getState().checkAuth();
    const logout = vi.spyOn(authCommands, "logout");

    await useAuthStore.getState().logout();

    expect(logout).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toEqual(
      expect.objectContaining({
        auth: null,
        status: "unavailable",
        isConnecting: false,
        error:
          "Roblox authentication requires the RobloxForge Desktop app. Open the Desktop app to continue.",
      }),
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("sets signed out only after desktop logout succeeds", async () => {
    setTauriRuntime(true);
    const desktopLogout = deferred<void>();
    vi.spyOn(authCommands, "logout").mockReturnValueOnce(desktopLogout.promise);
    useAuthStore.setState({
      auth: validAuth,
      status: "signed_in",
      isConnecting: false,
      error: null,
    });

    const logoutPromise = useAuthStore.getState().logout();

    expect(useAuthStore.getState()).toEqual(
      expect.objectContaining({ auth: validAuth, status: "checking" }),
    );

    desktopLogout.resolve();
    await logoutPromise;

    expect(useAuthStore.getState()).toEqual(
      expect.objectContaining({
        auth: null,
        status: "signed_out",
        isConnecting: false,
        error: null,
      }),
    );
  });

  it("preserves a valid signed-in session when desktop logout fails", async () => {
    setTauriRuntime(true);
    vi.spyOn(authCommands, "logout").mockRejectedValueOnce(
      new Error("Desktop logout failed."),
    );
    useAuthStore.setState({
      auth: validAuth,
      status: "signed_in",
      isConnecting: false,
      error: null,
    });

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState()).toEqual(
      expect.objectContaining({
        auth: validAuth,
        status: "signed_in",
        isConnecting: false,
        error: "Desktop logout failed.",
      }),
    );
  });
});
