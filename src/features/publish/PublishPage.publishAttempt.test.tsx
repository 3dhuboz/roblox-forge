import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { robloxAuthorityCommands } from "../../services/tauriCommands";
import { useProjectStore } from "../../stores/projectStore";
import type { ProjectInfo } from "../../types/project";
import type {
  RobloxAuthorityState,
  RobloxPublishReceipt,
} from "../../types/robloxAuthority";
import { PublishPage } from "./PublishPage";

const originalProjectStore = useProjectStore.getState();
const project: ProjectInfo = {
  name: "Publish Attempt Contract",
  path: "D:/RobloxForge/PublishAttemptContract",
  template: "obby",
  createdAt: "2026-07-15T00:00:00.000Z",
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
      id: "3e3e4347-d9e2-4356-ae2f-197815900605",
      label: "Owned Publish Target",
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
    publishExistingPlace: {
      state: "ready",
      ready: true,
      requiredScopes: [],
      reason: "Ready.",
    },
    updatePlaceMetadata: {
      state: "ready",
      ready: true,
      requiredScopes: [],
      reason: "Ready.",
    },
    ownedAnalytics: {
      state: "setup_required",
      ready: false,
      requiredScopes: [],
      reason: "Analytics key required.",
    },
  },
  createUniverseSupported: false,
};

function successfulReceipt(): RobloxPublishReceipt {
  return {
    operationId: "publish-operation",
    correlationId: "publish-correlation",
    operation: "publish_roblox_project",
    state: "succeeded",
    authoritative: true,
    startedAt: "2026-07-15T00:00:00.000Z",
    finishedAt: "2026-07-15T00:00:01.000Z",
    message: "Published.",
    diagnostics: [],
    retrySafety: "not_retryable",
    value: {
      targetId: authority.targets[0].id,
      universeId: authority.targets[0].universeId,
      rootPlaceId: authority.targets[0].rootPlaceId,
      gameUrl: authority.targets[0].gameUrl,
      uploadCompleted: true,
      metadataCompleted: true,
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
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
  enableTauriRuntime();
  useProjectStore.setState(originalProjectStore, true);
  useProjectStore.setState({
    project,
    validationIssues: [],
    validationState: "not_run",
    validationError: null,
    fixingIssueId: null,
    validateProject: vi.fn().mockImplementation(async () => {
      useProjectStore.setState({ validationState: "passed" });
      return true;
    }),
  });
  vi.spyOn(robloxAuthorityCommands, "getState").mockResolvedValue(authority);
  vi.spyOn(robloxAuthorityCommands, "publishProject");
});

afterEach(() => {
  clearTauriRuntime();
  useProjectStore.setState(originalProjectStore, true);
  vi.restoreAllMocks();
});

async function renderReadyToPublish() {
  const view = render(<PublishPage />);
  await screen.findByRole("combobox", { name: "Verified Roblox target" });
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Check this exact project" }),
    );
    await Promise.resolve();
  });
  expect(await screen.findByText("Validation Passed")).toBeInTheDocument();
  return view;
}

describe("PublishPage attempt cleanup", () => {
  it("treats an unexpected transport rejection as outcome unknown without retry", async () => {
    vi.mocked(robloxAuthorityCommands.publishProject).mockRejectedValueOnce(
      new Error("Roblox gateway timed out."),
    );
    await renderReadyToPublish();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Publish verified target" }),
      );
      await Promise.resolve();
    });

    expect(await screen.findByText("Publish outcome is unknown")).toBeInTheDocument();
    expect(screen.getByText(/Do not publish again yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconciliation required" }))
      .toBeDisabled();
    expect(robloxAuthorityCommands.publishProject).toHaveBeenCalledTimes(1);
  });

  it("does not promote a pending receipt after unmount", async () => {
    const pending = deferred<RobloxPublishReceipt>();
    vi.mocked(robloxAuthorityCommands.publishProject).mockReturnValueOnce(
      pending.promise,
    );
    const view = await renderReadyToPublish();
    fireEvent.click(
      screen.getByRole("button", { name: "Publish verified target" }),
    );
    view.unmount();

    await act(async () => {
      pending.resolve(successfulReceipt());
      await pending.promise;
    });
    expect(document.body).not.toHaveTextContent("Published with Desktop authority");
  });

  it("does not promote a receipt if Desktop authority disappears mid-attempt", async () => {
    const pending = deferred<RobloxPublishReceipt>();
    vi.mocked(robloxAuthorityCommands.publishProject).mockReturnValueOnce(
      pending.promise,
    );
    await renderReadyToPublish();
    fireEvent.click(
      screen.getByRole("button", { name: "Publish verified target" }),
    );
    clearTauriRuntime();

    await act(async () => {
      pending.resolve(successfulReceipt());
      await pending.promise;
    });
    expect(screen.queryByText("Published with Desktop authority"))
      .not.toBeInTheDocument();
  });
});
