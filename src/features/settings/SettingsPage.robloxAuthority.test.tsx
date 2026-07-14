import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  aiCommands,
  robloxAuthorityCommands,
  rojoCommands,
} from "../../services/tauriCommands";
import type { OperationReceipt } from "../../types/receipts";
import type {
  CredentialSlotStatus,
  RobloxAuthorityState,
  VerifiedRobloxTarget,
} from "../../types/robloxAuthority";
import { SettingsPage } from "./SettingsPage";

const capability = {
  state: "setup_required" as const,
  ready: false,
  requiredScopes: [] as string[],
  reason: "Configure RobloxForge Desktop.",
};

function authorityState(
  overrides: Partial<RobloxAuthorityState> = {},
): RobloxAuthorityState {
  return {
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
      publishExistingPlace: capability,
      updatePlaceMetadata: capability,
      ownedAnalytics: capability,
    },
    createUniverseSupported: false,
    ...overrides,
  };
}

function receipt<T>(
  operation: string,
  value: T,
): OperationReceipt<T> {
  return {
    operationId: `${operation}-operation`,
    correlationId: `${operation}-correlation`,
    operation,
    state: "succeeded",
    authoritative: true,
    startedAt: "2026-07-15T00:00:00.000Z",
    finishedAt: "2026-07-15T00:00:01.000Z",
    message: "Desktop authority completed the operation.",
    diagnostics: [],
    retrySafety: "not_retryable",
    value,
  };
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

beforeEach(() => {
  clearTauriRuntime();
  localStorage.clear();
  vi.spyOn(aiCommands, "checkApiKey").mockResolvedValue(null);
  vi.spyOn(rojoCommands, "checkStatus").mockResolvedValue({
    installed: false,
    version: null,
    serving: false,
    serve_port: null,
    install_instructions: "Install Rojo from rojo.space.",
  });
  vi.spyOn(robloxAuthorityCommands, "getState").mockResolvedValue(
    authorityState(),
  );
  vi.spyOn(robloxAuthorityCommands, "setApiKey");
  vi.spyOn(robloxAuthorityCommands, "registerTarget");
});

afterEach(() => {
  clearTauriRuntime();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("SettingsPage Roblox private-alpha authority", () => {
  it("keeps setup visibly Desktop-required in browser and makes zero Roblox authority calls", () => {
    render(<SettingsPage />);

    expect(
      screen.getByText(/Roblox publishing setup requires RobloxForge Desktop/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Roblox publish API key")).toBeDisabled();
    expect(screen.getByLabelText("Roblox analytics API key")).toBeDisabled();
    expect(robloxAuthorityCommands.getState).not.toHaveBeenCalled();
    expect(robloxAuthorityCommands.setApiKey).not.toHaveBeenCalled();
    expect(robloxAuthorityCommands.registerTarget).not.toHaveBeenCalled();
  });

  it("clears a transient publish key before awaiting Desktop and never persists or echoes it", async () => {
    enableTauriRuntime();
    const privateKey = "roblox-key-private-never-render";
    vi.mocked(robloxAuthorityCommands.setApiKey).mockRejectedValueOnce(
      new Error(`Desktop rejected ${privateKey}`),
    );
    render(<SettingsPage />);
    await screen.findByText(/No verified Roblox publish key/i);

    const input = screen.getByLabelText("Roblox publish API key");
    fireEvent.change(input, { target: { value: privateKey } });
    fireEvent.click(
      screen.getByRole("button", { name: "Save Roblox publish key" }),
    );

    expect(input).toHaveValue("");
    expect(await screen.findByRole("alert", { name: "Roblox setup error" }))
      .toHaveTextContent(/Desktop could not save the Roblox publish key/i);
    expect(document.body).not.toHaveTextContent(privateKey);
    expect(JSON.stringify({ ...localStorage })).not.toContain(privateKey);
    expect(robloxAuthorityCommands.setApiKey).toHaveBeenCalledWith(
      "publish",
      privateKey,
    );
  });

  it("accepts only the authoritative credential alias and never reloads the submitted key", async () => {
    enableTauriRuntime();
    const privateKey = "roblox-key-one-shot";
    const status: CredentialSlotStatus = {
      purpose: "publish",
      configured: true,
      alias: "publish-default",
      verifiedAt: "2026-07-15T00:00:00.000Z",
    };
    vi.mocked(robloxAuthorityCommands.setApiKey).mockResolvedValueOnce(
      receipt("set_roblox_api_key", status),
    );
    render(<SettingsPage />);
    await screen.findByText(/No verified Roblox publish key/i);

    const input = screen.getByLabelText("Roblox publish API key");
    await userEvent.setup().type(input, privateKey);
    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: "Save Roblox publish key" }),
      );

    expect(await screen.findByText(/publish-default is verified/i)).toBeInTheDocument();
    expect(input).toHaveValue("");
    expect(screen.queryByDisplayValue(privateKey)).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(privateKey);
    expect(JSON.stringify({ ...localStorage })).not.toContain(privateKey);
  });

  it("registers IDs as one immutable verified target without any free-form target-ID field", async () => {
    enableTauriRuntime();
    const target: VerifiedRobloxTarget = {
      id: "7c82456f-fb84-4b24-8b6e-5cc18270861f",
      label: "Progressive Monster Obby",
      universeId: "1234567890",
      rootPlaceId: "9876543210",
      publishCredentialAlias: "publish-default",
      analyticsCredentialAlias: "analytics-default",
      verifiedAt: "2026-07-15T00:00:00.000Z",
      gameUrl: "https://www.roblox.com/games/9876543210",
    };
    vi.mocked(robloxAuthorityCommands.getState).mockResolvedValueOnce(
      authorityState({
        publishCredential: {
          purpose: "publish",
          configured: true,
          alias: "publish-default",
          verifiedAt: "2026-07-15T00:00:00.000Z",
        },
        analyticsCredential: {
          purpose: "analytics",
          configured: true,
          alias: "analytics-default",
          verifiedAt: "2026-07-15T00:00:00.000Z",
        },
      }),
    );
    vi.mocked(robloxAuthorityCommands.registerTarget).mockResolvedValueOnce(
      receipt("register_roblox_target", target),
    );
    render(<SettingsPage />);
    await screen.findByText(/publish-default is verified/i);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Roblox target label"), target.label);
    await user.type(screen.getByLabelText("Roblox universe ID"), target.universeId);
    await user.type(
      screen.getByLabelText("Roblox root place ID"),
      target.rootPlaceId,
    );
    await user.click(screen.getByRole("button", { name: "Verify target" }));

    await waitFor(() =>
      expect(robloxAuthorityCommands.registerTarget).toHaveBeenCalledWith({
        label: target.label,
        universeId: target.universeId,
        rootPlaceId: target.rootPlaceId,
        publishCredentialAlias: "publish-default",
        analyticsCredentialAlias: "analytics-default",
      }),
    );
    expect(await screen.findByText(target.label)).toBeInTheDocument();
    expect(screen.getByText(`Universe ${target.universeId}`)).toBeInTheDocument();
    expect(screen.getByText(`Root place ${target.rootPlaceId}`)).toBeInTheDocument();
    expect(screen.queryByLabelText(/target id/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit target/i })).not.toBeInTheDocument();
  });
});
