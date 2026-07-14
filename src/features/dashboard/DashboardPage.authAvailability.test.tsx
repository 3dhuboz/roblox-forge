import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dashboardCommands,
  type GameStats,
} from "../../services/tauriCommands";
import {
  useAuthStore,
  type AuthStatus,
} from "../../stores/authStore";
import type { AuthState } from "../../types/roblox";
import { DashboardPage } from "./DashboardPage";

const originalAuthStoreState = useAuthStore.getState();

const validAuth: AuthState = {
  accessToken: "test-access-token",
  refreshToken: "test-refresh-token",
  expiresAt: Date.now() + 60_000,
  userId: "84",
  username: "dashboard-tester",
  displayName: "Dashboard Tester",
};

const replacementAuth: AuthState = {
  ...validAuth,
  expiresAt: validAuth.expiresAt + 1,
  userId: "85",
  username: "replacement-dashboard-tester",
  displayName: "Replacement Dashboard Tester",
};

const accountAGame: GameStats = {
  universe_id: "account-a-game",
  name: "Account A Game",
  playing: 1,
  visits: 10,
  favorites: 2,
  updated: "2026-07-15T00:00:00.000Z",
};

const accountBGame: GameStats = {
  universe_id: "account-b-game",
  name: "Account B Game",
  playing: 3,
  visits: 30,
  favorites: 6,
  updated: "2026-07-15T00:01:00.000Z",
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
});

afterEach(() => {
  useAuthStore.setState(originalAuthStoreState, true);
  vi.restoreAllMocks();
});

describe("DashboardPage auth availability", () => {
  it("checks direct-route auth, explains desktop availability, and does not fetch stats", async () => {
    const checkAuth = vi.fn().mockResolvedValue(undefined);
    const fetchGameStats = vi.spyOn(dashboardCommands, "fetchGameStats");
    useAuthStore.setState({
      auth: null,
      status: "unavailable",
      isConnecting: false,
      error:
        "Roblox authentication requires the RobloxForge Desktop app. Open the Desktop app to continue.",
      checkAuth,
    });

    render(<DashboardPage />);

    await waitFor(() => expect(checkAuth).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alert")).toHaveTextContent(/Desktop app/i);
    expect(fetchGameStats).not.toHaveBeenCalled();
  });

  it.each<AuthStatus>([
    "unknown",
    "checking",
    "signed_out",
    "unavailable",
    "error",
  ])(
    "does not fetch stats while auth is %s",
    async (status) => {
      const checkAuth = vi.fn().mockResolvedValue(undefined);
      const fetchGameStats = vi.spyOn(dashboardCommands, "fetchGameStats");
      useAuthStore.setState({
        auth: status === "checking" ? validAuth : null,
        status,
        error: status === "error" ? "Auth check failed." : null,
        checkAuth,
      });

      render(<DashboardPage />);
      await waitFor(() => expect(checkAuth).toHaveBeenCalledTimes(1));

      expect(fetchGameStats).not.toHaveBeenCalled();
    },
  );

  it("fetches stats only for a signed-in, unexpired session", async () => {
    const checkAuth = vi.fn().mockResolvedValue(undefined);
    const fetchGameStats = vi
      .spyOn(dashboardCommands, "fetchGameStats")
      .mockResolvedValueOnce([]);
    useAuthStore.setState({
      auth: validAuth,
      status: "signed_in",
      error: null,
      checkAuth,
    });

    render(<DashboardPage />);

    await waitFor(() => expect(fetchGameStats).toHaveBeenCalledTimes(1));
    expect(checkAuth).toHaveBeenCalledTimes(1);
  });

  it("lets only the latest signed-in session own stats and loading state", async () => {
    const accountARequest = deferred<GameStats[]>();
    const accountBRequest = deferred<GameStats[]>();
    const checkAuth = vi.fn().mockResolvedValue(undefined);
    const fetchGameStats = vi
      .spyOn(dashboardCommands, "fetchGameStats")
      .mockReturnValueOnce(accountARequest.promise)
      .mockReturnValueOnce(accountBRequest.promise);
    useAuthStore.setState({
      auth: validAuth,
      status: "signed_in",
      error: null,
      checkAuth,
    });
    render(<DashboardPage />);
    await waitFor(() => expect(fetchGameStats).toHaveBeenCalledTimes(1));

    act(() => {
      useAuthStore.setState({
        auth: null,
        status: "signed_out",
        isConnecting: false,
        error: null,
      });
    });
    act(() => {
      useAuthStore.setState({
        auth: replacementAuth,
        status: "signed_in",
        isConnecting: false,
        error: null,
      });
    });
    await waitFor(() => expect(fetchGameStats).toHaveBeenCalledTimes(2));

    await act(async () => {
      accountARequest.resolve([accountAGame]);
      await accountARequest.promise;
    });

    expect(screen.queryByText(accountAGame.name)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Updating..." }),
    ).toBeDisabled();

    await act(async () => {
      accountBRequest.resolve([accountBGame]);
      await accountBRequest.promise;
    });

    expect(await screen.findByText(accountBGame.name)).toBeInTheDocument();
    expect(screen.queryByText(accountAGame.name)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled();
  });
});
