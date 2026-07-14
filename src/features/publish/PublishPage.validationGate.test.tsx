import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { robloxAuthorityCommands } from "../../services/tauriCommands";
import { useProjectStore } from "../../stores/projectStore";
import type { ProjectInfo } from "../../types/project";
import type { RobloxAuthorityState } from "../../types/robloxAuthority";
import { PublishPage } from "./PublishPage";

const originalProjectStore = useProjectStore.getState();
const project: ProjectInfo = {
  name: "Publish Gate Contract",
  path: "D:/RobloxForge/PublishGateContract",
  template: "obby",
  createdAt: "2026-07-15T00:00:00.000Z",
};

const readyCapability = {
  state: "ready" as const,
  ready: true,
  requiredScopes: [] as string[],
  reason: "Ready.",
};

const authority: RobloxAuthorityState = {
  publishCredential: {
    purpose: "publish",
    configured: true,
    alias: "publish-default",
    verifiedAt: "2026-07-15T00:00:00.000Z",
  },
  analyticsCredential: {
    purpose: "analytics",
    configured: false,
    alias: "analytics-default",
  },
  targets: [
    {
      id: "f28530a4-143d-4ab8-88d4-209ef7d0d19d",
      label: "Validation Target",
      universeId: "123",
      rootPlaceId: "456",
      publishCredentialAlias: "publish-default",
      verifiedAt: "2026-07-15T00:00:00.000Z",
      gameUrl: "https://www.roblox.com/games/456",
    },
  ],
  capabilities: {
    authMode: "api_key",
    createUniverse: {
      state: "unsupported",
      ready: false,
      requiredScopes: [],
      reason: "Open Cloud cannot create a universe.",
    },
    publishExistingPlace: readyCapability,
    updatePlaceMetadata: readyCapability,
    ownedAnalytics: {
      state: "setup_required",
      ready: false,
      requiredScopes: [],
      reason: "Analytics key required.",
    },
  },
  createUniverseSupported: false,
};

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
  enableTauriRuntime();
  useProjectStore.setState(originalProjectStore, true);
  useProjectStore.setState({
    project,
    validationIssues: [],
    validationState: "not_run",
    validationError: null,
    fixingIssueId: null,
  });
  vi.spyOn(robloxAuthorityCommands, "getState").mockResolvedValue(authority);
  vi.spyOn(robloxAuthorityCommands, "publishProject");
});

afterEach(() => {
  clearTauriRuntime();
  useProjectStore.setState(originalProjectStore, true);
  vi.restoreAllMocks();
});

async function renderReady(): Promise<void> {
  render(<PublishPage />);
  await screen.findByRole("combobox", { name: "Verified Roblox target" });
}

describe("PublishPage exact-project validation gate", () => {
  it.each([
    ["validation is running", { validationState: "running" as const, fixingIssueId: null }],
    ["an auto-fix is running", { validationState: "not_run" as const, fixingIssueId: "fix-1" }],
  ])("disables the exact-project check while %s", async (_label, gate) => {
    useProjectStore.setState(gate);
    await renderReady();

    expect(screen.getByRole("button", { name: "Check this exact project" }))
      .toBeDisabled();
  });

  it("keeps publish disabled and exposes validation failure", async () => {
    const validateProject = vi.fn().mockImplementation(async () => {
      useProjectStore.setState({
        validationState: "failed",
        validationError: "Desktop validation did not pass.",
      });
      return false;
    });
    useProjectStore.setState({ validateProject });
    await renderReady();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Check this exact project" }));

    expect(await screen.findByText("Desktop validation did not pass."))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish verified target" }))
      .toBeDisabled();
    expect(robloxAuthorityCommands.publishProject).not.toHaveBeenCalled();
  });

  it("enables publish only after the recorded store state passes for this exact path", async () => {
    const validateProject = vi.fn().mockImplementation(async () => {
      useProjectStore.setState({
        validationState: "passed",
        validationError: null,
      });
      return true;
    });
    useProjectStore.setState({ validateProject });
    await renderReady();
    expect(screen.getByRole("button", { name: "Publish verified target" }))
      .toBeDisabled();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Check this exact project" }));

    expect(await screen.findByText("Validation Passed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish verified target" }))
      .toBeEnabled();
  });

  it("does not trust a true return value when the authoritative validation state is not passed", async () => {
    useProjectStore.setState({
      validateProject: vi.fn().mockResolvedValue(true),
    });
    await renderReady();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Check this exact project" }));

    expect(screen.getByRole("button", { name: "Publish verified target" }))
      .toBeDisabled();
    expect(robloxAuthorityCommands.publishProject).not.toHaveBeenCalled();
  });
});
