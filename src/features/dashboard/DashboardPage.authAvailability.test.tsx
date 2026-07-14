import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { robloxAuthorityCommands } from "../../services/tauriCommands";
import type {
  CapabilityDetail,
  RobloxAuthorityState,
} from "../../types/robloxAuthority";
import { DashboardPage } from "./DashboardPage";

const target = {
  id: "0f65be3e-3771-4a3f-98be-e5af7cfcf8b6",
  label: "Obby Alpha",
  universeId: "94712001",
  rootPlaceId: "947120011",
  publishCredentialAlias: "roblox-publish",
  analyticsCredentialAlias: "roblox-analytics",
  verifiedAt: "2026-07-15T00:00:00.000Z",
  gameUrl: "https://www.roblox.com/games/947120011",
} as const;

function capability(state: CapabilityDetail["state"]): CapabilityDetail {
  return {
    state,
    ready: state === "ready",
    requiredScopes: [],
    reason: state === "ready" ? "Ready." : "Setup is required.",
  };
}

function authority(
  overrides: Partial<RobloxAuthorityState> = {},
): RobloxAuthorityState {
  return {
    publishCredential: {
      purpose: "publish",
      configured: true,
      alias: "roblox-publish",
      verifiedAt: "2026-07-15T00:00:00.000Z",
    },
    analyticsCredential: {
      purpose: "analytics",
      configured: true,
      alias: "roblox-analytics",
      verifiedAt: "2026-07-15T00:00:00.000Z",
    },
    targets: [target],
    capabilities: {
      authMode: "api_key",
      createUniverse: capability("unsupported"),
      publishExistingPlace: capability("ready"),
      updatePlaceMetadata: capability("ready"),
      ownedAnalytics: capability("ready"),
    },
    createUniverseSupported: false,
    ...overrides,
  };
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

function enableTauriRuntime(): void {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
}

function clearTauriRuntime(): void {
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
}

beforeEach(() => {
  clearTauriRuntime();
});

afterEach(() => {
  clearTauriRuntime();
  vi.restoreAllMocks();
});

describe("DashboardPage Desktop analytics authority", () => {
  it("makes zero authority calls in browser preview", () => {
    const getState = vi.spyOn(robloxAuthorityCommands, "getState");

    render(<DashboardPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /Owned analytics requires RobloxForge Desktop/i,
    );
    expect(getState).not.toHaveBeenCalled();
  });

  it("loads verified targets directly from Desktop without OAuth", async () => {
    enableTauriRuntime();
    const getState = vi
      .spyOn(robloxAuthorityCommands, "getState")
      .mockResolvedValue(authority());

    render(<DashboardPage />);

    expect(await screen.findByLabelText("Verified owned target")).toHaveValue(target.id);
    expect(getState).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Load owned analytics" })).toBeEnabled();
  });

  it("keeps queries closed when the analytics key or capability is not ready", async () => {
    enableTauriRuntime();
    vi.spyOn(robloxAuthorityCommands, "getState").mockResolvedValue(
      authority({
        analyticsCredential: {
          purpose: "analytics",
          configured: false,
          alias: "roblox-analytics",
        },
        capabilities: {
          ...authority().capabilities,
          ownedAnalytics: capability("setup_required"),
        },
      }),
    );

    render(<DashboardPage />);

    expect(await screen.findByText("Verify an analytics key first")).toBeVisible();
    expect(screen.queryByLabelText("Verified owned target")).not.toBeInTheDocument();
  });

  it("redacts authority failures and recovers on an explicit retry", async () => {
    enableTauriRuntime();
    const getState = vi
      .spyOn(robloxAuthorityCommands, "getState")
      .mockRejectedValueOnce(new Error("secret x-api-key leaked"))
      .mockResolvedValueOnce(authority());
    render(<DashboardPage />);

    expect(await screen.findByText(/could not read the verified analytics setup/i)).toBeVisible();
    expect(document.body).not.toHaveTextContent(/x-api-key|secret/i);
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));

    expect(await screen.findByLabelText("Verified owned target")).toBeVisible();
    expect(getState).toHaveBeenCalledTimes(2);
  });

  it("does not promote a Desktop response after the runtime disappears", async () => {
    enableTauriRuntime();
    const request = deferred<RobloxAuthorityState>();
    vi.spyOn(robloxAuthorityCommands, "getState").mockReturnValue(request.promise);
    render(<DashboardPage />);
    expect(screen.getByRole("status")).toHaveTextContent(/Reading verified analytics setup/i);

    clearTauriRuntime();
    await act(async () => {
      request.resolve(authority());
      await request.promise;
    });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /Owned analytics requires RobloxForge Desktop/i,
      ),
    );
    expect(screen.queryByLabelText("Verified owned target")).not.toBeInTheDocument();
  });
});
