import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { robloxAuthorityCommands } from "../../services/tauriCommands";
import { useProjectStore } from "../../stores/projectStore";
import type { ProjectInfo } from "../../types/project";
import type { OperationReceipt } from "../../types/receipts";
import type {
  PublishReceiptValue,
  RobloxAuthorityState,
  RobloxPublishReceipt,
  VerifiedRobloxTarget,
} from "../../types/robloxAuthority";
import { PublishPage } from "./PublishPage";

const originalProjectStore = useProjectStore.getState();

const project: ProjectInfo = {
  name: "Progressive Monster Obby",
  path: "D:/RobloxForge/ProgressiveMonsterObby",
  template: "obby",
  createdAt: "2026-07-15T00:00:00.000Z",
};

const replacementProject: ProjectInfo = {
  name: "Replacement Tycoon",
  path: "D:/RobloxForge/ReplacementTycoon",
  template: "tycoon",
  createdAt: "2026-07-15T00:05:00.000Z",
};

const target: VerifiedRobloxTarget = {
  id: "7c82456f-fb84-4b24-8b6e-5cc18270861f",
  label: "Owned Obby Production",
  universeId: "1234567890",
  rootPlaceId: "9876543210",
  publishCredentialAlias: "publish-default",
  analyticsCredentialAlias: "analytics-default",
  verifiedAt: "2026-07-15T00:00:00.000Z",
  gameUrl: "https://www.roblox.com/games/9876543210",
};

const capabilityReady = {
  state: "ready" as const,
  ready: true,
  requiredScopes: [] as string[],
  reason: "Ready.",
};

function authorityState(
  overrides: Partial<RobloxAuthorityState> = {},
): RobloxAuthorityState {
  return {
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
    targets: [target],
    capabilities: {
      authMode: "api_key",
      createUniverse: {
        state: "unsupported",
        ready: false,
        requiredScopes: [],
        reason: "Open Cloud cannot create a universe.",
      },
      publishExistingPlace: capabilityReady,
      updatePlaceMetadata: capabilityReady,
      ownedAnalytics: capabilityReady,
    },
    createUniverseSupported: false,
    ...overrides,
  };
}

function publishReceipt(
  state: RobloxPublishReceipt["state"],
  overrides: Partial<RobloxPublishReceipt> = {},
): RobloxPublishReceipt {
  const value: PublishReceiptValue = {
    targetId: target.id,
    universeId: target.universeId,
    rootPlaceId: target.rootPlaceId,
    gameUrl: target.gameUrl,
    uploadCompleted: state === "succeeded" || state === "partial_success",
    metadataCompleted: state === "succeeded",
    versionNumber: 42,
  };
  return {
    operationId: `publish-${state}`,
    correlationId: `publish-${state}-correlation`,
    operation: "publish_roblox_project",
    state,
    authoritative: true,
    startedAt: "2026-07-15T00:00:00.000Z",
    finishedAt: "2026-07-15T00:00:01.000Z",
    message: "Desktop completed the publish attempt.",
    diagnostics: [],
    retrySafety:
      state === "outcome_unknown" || state === "partial_success"
        ? "unsafe_without_reconciliation"
        : "not_retryable",
    recoveryAction:
      state === "outcome_unknown" || state === "partial_success"
        ? "Reconcile the target in Creator Dashboard before another publish."
        : undefined,
    value,
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
  delete (window as Window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
}

beforeEach(() => {
  clearTauriRuntime();
  useProjectStore.setState(originalProjectStore, true);
  useProjectStore.setState({
    project,
    validationIssues: [],
    validationState: "not_run",
    validationError: null,
    fixingIssueId: null,
  });
  vi.spyOn(robloxAuthorityCommands, "getState").mockResolvedValue(
    authorityState(),
  );
  vi.spyOn(robloxAuthorityCommands, "publishProject");
});

afterEach(() => {
  clearTauriRuntime();
  useProjectStore.setState(originalProjectStore, true);
  vi.restoreAllMocks();
});

async function validateReadyProject(): Promise<void> {
  const validateProject = vi.fn().mockImplementation(async () => {
    useProjectStore.setState({
      validationIssues: [],
      validationState: "passed",
      validationError: null,
    });
    return true;
  });
  useProjectStore.setState({ validateProject });
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Check this exact project" }));
  expect(await screen.findByText("Validation Passed")).toBeInTheDocument();
}

describe("PublishPage verified Roblox authority", () => {
  it("stays visibly Desktop-required in browser and makes zero authority calls", () => {
    render(<PublishPage />);

    expect(
      screen.getByText(/Publishing requires RobloxForge Desktop/i),
    ).toBeInTheDocument();
    expect(robloxAuthorityCommands.getState).not.toHaveBeenCalled();
    expect(robloxAuthorityCommands.publishProject).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /publish verified target/i }))
      .not.toBeInTheDocument();
  });

  it("offers no free-form IDs and cannot publish without a verified key and target", async () => {
    enableTauriRuntime();
    vi.mocked(robloxAuthorityCommands.getState).mockResolvedValueOnce(
      authorityState({
        publishCredential: {
          purpose: "publish",
          configured: false,
          alias: "publish-default",
        },
        targets: [],
      }),
    );
    render(<PublishPage />);

    expect(await screen.findByText(/verified publish key and target are required/i))
      .toBeInTheDocument();
    expect(screen.queryByLabelText(/universe id/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/place id/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/target id/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publish verified target/i }))
      .not.toBeInTheDocument();
  });

  it("publishes the exact project path to the selected registered target and trusts only an authoritative receipt", async () => {
    enableTauriRuntime();
    vi.mocked(robloxAuthorityCommands.publishProject).mockResolvedValueOnce(
      publishReceipt("succeeded"),
    );
    render(<PublishPage />);
    await screen.findByRole("combobox", { name: "Verified Roblox target" });

    expect(screen.getByText(project.path)).toBeInTheDocument();
    expect(screen.queryByLabelText(/universe id/i)).not.toBeInTheDocument();
    await validateReadyProject();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Publish verified target" }));

    await waitFor(() =>
      expect(robloxAuthorityCommands.publishProject).toHaveBeenCalledWith({
        projectPath: project.path,
        targetId: target.id,
        name: project.name,
        description: "",
      }),
    );
    expect(await screen.findByText(/Published with Desktop authority/i))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open on Roblox/i }))
      .toHaveAttribute("href", `https://www.roblox.com/games/${target.rootPlaceId}`);
  });

  it("never promotes a non-authoritative succeeded receipt", async () => {
    enableTauriRuntime();
    vi.mocked(robloxAuthorityCommands.publishProject).mockResolvedValueOnce(
      publishReceipt("succeeded", { authoritative: false }),
    );
    render(<PublishPage />);
    await screen.findByRole("combobox", { name: "Verified Roblox target" });
    await validateReadyProject();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Publish verified target" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /did not return an authoritative publish receipt/i,
    );
    expect(screen.queryByText(/Published with Desktop authority/i))
      .not.toBeInTheDocument();
  });

  it("shows upload success plus metadata failure as partial success with reconciliation and no retry", async () => {
    enableTauriRuntime();
    vi.mocked(robloxAuthorityCommands.publishProject).mockResolvedValueOnce(
      publishReceipt("partial_success"),
    );
    render(<PublishPage />);
    await screen.findByRole("combobox", { name: "Verified Roblox target" });
    await validateReadyProject();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Publish verified target" }));

    expect(await screen.findByText(/Upload complete — metadata needs attention/i))
      .toBeInTheDocument();
    expect(screen.getByText(/Reconcile the target in Creator Dashboard/i))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconciliation required" }))
      .toBeDisabled();
    expect(screen.getByRole("button", { name: "Check this exact project" }))
      .toBeDisabled();
    expect(robloxAuthorityCommands.publishProject).toHaveBeenCalledTimes(1);
  });

  it("shows transport ambiguity as outcome unknown and explicitly forbids automatic retry", async () => {
    enableTauriRuntime();
    vi.mocked(robloxAuthorityCommands.publishProject).mockResolvedValueOnce(
      publishReceipt("outcome_unknown", { value: undefined }),
    );
    render(<PublishPage />);
    await screen.findByRole("combobox", { name: "Verified Roblox target" });
    await validateReadyProject();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Publish verified target" }));

    expect(await screen.findByText(/Publish outcome is unknown/i)).toBeInTheDocument();
    expect(screen.getByText(/Do not publish again yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Reconcile the target in Creator Dashboard/i))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconciliation required" }))
      .toBeDisabled();
    expect(screen.getByRole("button", { name: "Check this exact project" }))
      .toBeDisabled();
    expect(robloxAuthorityCommands.publishProject).toHaveBeenCalledTimes(1);
  });

  it("does not let a stale publish attempt promote success after project ownership changes", async () => {
    enableTauriRuntime();
    const pending = deferred<OperationReceipt<PublishReceiptValue>>();
    vi.mocked(robloxAuthorityCommands.publishProject).mockReturnValueOnce(
      pending.promise,
    );
    render(<PublishPage />);
    await screen.findByRole("combobox", { name: "Verified Roblox target" });
    await validateReadyProject();
    fireEvent.click(screen.getByRole("button", { name: "Publish verified target" }));
    await waitFor(() =>
      expect(robloxAuthorityCommands.publishProject).toHaveBeenCalledTimes(1),
    );

    act(() => {
      useProjectStore.setState({
        project: replacementProject,
        validationIssues: [],
        validationState: "not_run",
        validationError: null,
      });
    });
    await act(async () => {
      pending.resolve(publishReceipt("succeeded"));
      await pending.promise;
    });

    expect(screen.getByText(replacementProject.path)).toBeInTheDocument();
    expect(screen.queryByText(/Published with Desktop authority/i))
      .not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check this exact project" }))
      .toBeEnabled();
    expect(robloxAuthorityCommands.publishProject).toHaveBeenCalledTimes(1);
  });
});
