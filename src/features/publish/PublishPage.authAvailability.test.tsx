import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useAuthStore,
  type AuthStatus,
} from "../../stores/authStore";
import { useProjectStore } from "../../stores/projectStore";
import type { ProjectInfo } from "../../types/project";
import type { AuthState } from "../../types/roblox";
import { PublishPage } from "./PublishPage";

const originalAuthStoreState = useAuthStore.getState();
const originalProjectStoreState = useProjectStore.getState();

const project: ProjectInfo = {
  name: "Auth Availability Contract",
  path: "D:/RobloxForge/AuthAvailabilityContract",
  template: "obby",
  createdAt: "2000-08-01T00:00:00.000Z",
};

const validAuth: AuthState = {
  accessToken: "test-access-token",
  refreshToken: "test-refresh-token",
  expiresAt: Date.now() + 60_000,
  userId: "126",
  username: "auth-race-tester",
  displayName: "Auth Race Tester",
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
  useProjectStore.setState({ project });
});

afterEach(() => {
  useAuthStore.setState(originalAuthStoreState, true);
  useProjectStore.setState(originalProjectStoreState, true);
  vi.restoreAllMocks();
});

describe("PublishPage auth availability", () => {
  it("checks direct-route auth and offers no Roblox login action when desktop auth is unavailable", async () => {
    const checkAuth = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      auth: null,
      status: "unavailable",
      isConnecting: false,
      error:
        "Roblox authentication requires the RobloxForge Desktop app. Open the Desktop app to continue.",
      checkAuth,
    });

    render(<PublishPage />);

    await waitFor(() => expect(checkAuth).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alert")).toHaveTextContent(/Desktop app/i);
    expect(
      screen.queryByRole("button", { name: /Log In with Roblox/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Game Details" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the desktop-required alert visible on a direct route with no project", async () => {
    const checkAuth = vi.fn().mockResolvedValue(undefined);
    useProjectStore.setState({ project: null });
    useAuthStore.setState({
      auth: null,
      status: "unavailable",
      isConnecting: false,
      error:
        "Roblox authentication requires the RobloxForge Desktop app. Open the Desktop app to continue.",
      checkAuth,
    });

    render(<PublishPage />);

    await waitFor(() => expect(checkAuth).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alert")).toHaveTextContent(/Desktop app/i);
    expect(
      screen.queryByRole("button", { name: /Log In with Roblox/i }),
    ).not.toBeInTheDocument();
  });

  it.each<{
    status: Exclude<AuthStatus, "unknown" | "checking" | "signed_in">;
    error: string | null;
  }>([
    {
      status: "unavailable",
      error:
        "Roblox authentication requires the RobloxForge Desktop app. Open the Desktop app to continue.",
    },
    { status: "signed_out", error: null },
    { status: "error", error: "Roblox authentication failed." },
  ])(
    "does not retain the publish workflow when fresh auth resolves $status",
    async ({ status, error }) => {
      const freshCheck = deferred<void>();
      const checkAuth = vi.fn().mockImplementation(async () => {
        useAuthStore.setState({
          auth: null,
          status: "checking",
          isConnecting: false,
          error: null,
        });
        await freshCheck.promise;
        useAuthStore.setState({
          auth: null,
          status,
          isConnecting: false,
          error,
        });
      });
      useAuthStore.setState({
        auth: validAuth,
        status: "signed_in",
        isConnecting: false,
        error: null,
        checkAuth,
      });

      render(<PublishPage />);
      await waitFor(() => expect(checkAuth).toHaveBeenCalledTimes(1));

      await act(async () => {
        freshCheck.resolve();
        await freshCheck.promise;
      });
      await waitFor(() => expect(useAuthStore.getState().status).toBe(status));

      expect(
        screen.queryByRole("heading", { name: "Game Details" }),
      ).not.toBeInTheDocument();
      if (status === "signed_out") {
        expect(
          screen.getByRole("button", { name: "Log In with Roblox" }),
        ).toBeInTheDocument();
      } else {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      }
    },
  );

  it("announces a failed logout while the valid session remains signed in", async () => {
    const checkAuth = vi.fn().mockResolvedValue(undefined);
    useAuthStore.setState({
      auth: validAuth,
      status: "signed_in",
      isConnecting: false,
      error: "Desktop logout failed. You are still signed in.",
      checkAuth,
    });

    render(<PublishPage />);

    await waitFor(() => expect(checkAuth).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Auth Race Tester")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Desktop logout failed. You are still signed in.",
    );
  });
});
