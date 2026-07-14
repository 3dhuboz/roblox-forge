import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OperationReceipt } from "../types/receipts";
import * as commandExports from "./tauriCommands";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

type CredentialPurpose = "publish" | "analytics";

interface RobloxAuthorityCommandsContract {
  getState(): Promise<unknown>;
  setApiKey(
    purpose: CredentialPurpose,
    apiKey: string,
  ): Promise<OperationReceipt<unknown>>;
  registerTarget(input: {
    label: string;
    universeId: string;
    rootPlaceId: string;
    publishCredentialAlias: string;
    analyticsCredentialAlias?: string;
  }): Promise<OperationReceipt<unknown>>;
  publishProject(input: {
    projectPath: string;
    targetId: string;
    name: string;
    description: string;
  }): Promise<OperationReceipt<unknown>>;
}

function commands(): RobloxAuthorityCommandsContract {
  const value = (commandExports as unknown as Record<string, unknown>)[
    "robloxAuthorityCommands"
  ];
  expect(value).toBeDefined();
  return value as RobloxAuthorityCommandsContract;
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
  invokeMock.mockReset();
});

afterEach(() => {
  clearTauriRuntime();
});

describe("Roblox Desktop authority commands", () => {
  it("makes every Roblox setup and publish operation unavailable without invoking Tauri in browser", async () => {
    const key = "roblox-private-key-value";
    const calls = [
      () => commands().getState(),
      () => commands().setApiKey("publish", key),
      () =>
        commands().registerTarget({
          label: "Verified obby",
          universeId: "123",
          rootPlaceId: "456",
          publishCredentialAlias: "publish-primary",
        }),
      () =>
        commands().publishProject({
          projectPath: "D:/RobloxForge/ExactProject",
          targetId: "target-verified-1",
          name: "Verified obby",
          description: "A private alpha build",
        }),
    ];

    for (const call of calls) {
      await expect(call()).rejects.toMatchObject({
        name: "OperationUnavailableError",
        receipt: {
          state: "unavailable",
          authoritative: false,
          retrySafety: "not_retryable",
        },
      });
    }

    expect(invokeMock).not.toHaveBeenCalled();
    expect(JSON.stringify(invokeMock.mock.calls)).not.toContain(key);
  });

  it("passes transient keys and registered target IDs only to the exact Desktop commands", async () => {
    enableTauriRuntime();
    invokeMock
      .mockResolvedValueOnce({
        publishCredential: {
          purpose: "publish",
          configured: false,
        },
        analyticsCredential: {
          purpose: "analytics",
          configured: false,
        },
        targets: [],
      })
      .mockResolvedValueOnce({ state: "succeeded", authoritative: true })
      .mockResolvedValueOnce({ state: "succeeded", authoritative: true })
      .mockResolvedValueOnce({ state: "succeeded", authoritative: true });

    await commands().getState();
    await commands().setApiKey("analytics", "transient-key");
    await commands().registerTarget({
      label: "Verified obby",
      universeId: "123",
      rootPlaceId: "456",
      publishCredentialAlias: "publish-primary",
      analyticsCredentialAlias: "analytics-primary",
    });
    await commands().publishProject({
      projectPath: "D:/RobloxForge/ExactProject",
      targetId: "target-verified-1",
      name: "Verified obby",
      description: "A private alpha build",
    });

    expect(invokeMock.mock.calls).toEqual([
      ["get_roblox_authority_state"],
      [
        "set_roblox_api_key",
        { purpose: "analytics", apiKey: "transient-key" },
      ],
      [
        "register_roblox_target",
        {
          label: "Verified obby",
          universeId: "123",
          rootPlaceId: "456",
          publishCredentialAlias: "publish-primary",
          analyticsCredentialAlias: "analytics-primary",
        },
      ],
      [
        "publish_roblox_project",
        {
          projectPath: "D:/RobloxForge/ExactProject",
          targetId: "target-verified-1",
          name: "Verified obby",
          description: "A private alpha build",
        },
      ],
    ]);
  });
});
