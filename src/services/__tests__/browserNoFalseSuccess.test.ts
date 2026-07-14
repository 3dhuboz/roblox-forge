import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiResponse } from "../../types/ai";
import type { ProjectInfo, ProjectState } from "../../types/project";
import type { OperationReceipt } from "../../types/receipts";
import * as previewExports from "../browserDevMocks";
import {
  aiCommands,
  authCommands,
  buildCommands,
  dashboardCommands,
  projectCommands,
  publishCommands,
  rojoCommands,
  validationCommands,
  type GameStats,
} from "../tauriCommands";
import * as commandExports from "../tauriCommands";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

const ARGUMENT_SENTINEL = "RF_ARGUMENT_SENTINEL_7A9C";
const PREVIEW_CREATED_AT = "2000-01-01T00:00:00.000Z";
const PREVIEW_STATS_UPDATED_AT = "2000-01-02T00:00:00.000Z";

interface OperationUnavailableErrorLike extends Error {
  readonly receipt: OperationReceipt;
}

interface PreviewResult<T> {
  readonly receipt: OperationReceipt;
  readonly data: T;
}

interface BrowserPreviewService {
  createProject(
    templateName: string,
    projectName: string,
  ): Promise<PreviewResult<ProjectInfo>>;
  getProjectState(projectPath: string): Promise<PreviewResult<ProjectState>>;
  writeFile(
    projectPath: string,
    relativePath: string,
    content: string,
  ): Promise<PreviewResult<void>>;
  readFile(
    projectPath: string,
    relativePath: string,
  ): Promise<PreviewResult<string>>;
  getSampleDirectorResponse(): Promise<PreviewResult<AiResponse>>;
  getSampleGameStats(): Promise<PreviewResult<GameStats[]>>;
}

const authorityCases: ReadonlyArray<{
  readonly operation: string;
  readonly call: () => Promise<unknown>;
}> = [
  {
    operation: "create_project",
    call: () => projectCommands.createProject(ARGUMENT_SENTINEL, ARGUMENT_SENTINEL),
  },
  {
    operation: "get_project_state",
    call: () => projectCommands.getProjectState(ARGUMENT_SENTINEL),
  },
  {
    operation: "write_file",
    call: () =>
      projectCommands.writeFile(
        ARGUMENT_SENTINEL,
        ARGUMENT_SENTINEL,
        ARGUMENT_SENTINEL,
      ),
  },
  {
    operation: "read_file",
    call: () => projectCommands.readFile(ARGUMENT_SENTINEL, ARGUMENT_SENTINEL),
  },
  {
    operation: "send_chat_message",
    call: () =>
      aiCommands.sendChatMessage(
        ARGUMENT_SENTINEL,
        ARGUMENT_SENTINEL,
        [
          {
            id: ARGUMENT_SENTINEL,
            role: "user",
            content: ARGUMENT_SENTINEL,
            timestamp: 0,
          },
        ],
        ARGUMENT_SENTINEL,
        ARGUMENT_SENTINEL,
      ),
  },
  {
    operation: "set_api_key",
    call: () => aiCommands.setApiKey(`sk-or-${ARGUMENT_SENTINEL}`),
  },
  {
    operation: "build_project",
    call: () => buildCommands.buildProject(ARGUMENT_SENTINEL),
  },
  {
    operation: "start_oauth_flow",
    call: () => authCommands.startOauthFlow(),
  },
  {
    operation: "handle_oauth_callback",
    call: () =>
      authCommands.handleOauthCallback(ARGUMENT_SENTINEL, ARGUMENT_SENTINEL),
  },
  {
    operation: "refresh_auth_token",
    call: () => authCommands.refreshAuthToken(),
  },
  {
    operation: "logout",
    call: () => authCommands.logout(),
  },
  {
    operation: "publish_game",
    call: () =>
      publishCommands.publishGame(
        ARGUMENT_SENTINEL,
        ARGUMENT_SENTINEL,
        ARGUMENT_SENTINEL,
        ARGUMENT_SENTINEL,
        ARGUMENT_SENTINEL,
      ),
  },
  {
    operation: "fetch_game_stats",
    call: () => dashboardCommands.fetchGameStats(),
  },
  {
    operation: "start_rojo_serve",
    call: () => rojoCommands.startServe(ARGUMENT_SENTINEL),
  },
  {
    operation: "stop_rojo_serve",
    call: () => rojoCommands.stopServe(),
  },
  {
    operation: "validate_project",
    call: () => validationCommands.validateProject(ARGUMENT_SENTINEL),
  },
  {
    operation: "auto_fix_issue",
    call: () =>
      validationCommands.autoFixIssue(ARGUMENT_SENTINEL, ARGUMENT_SENTINEL),
  },
];

function clearTauriRuntime(): void {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
}

function operationUnavailableGuard(): (
  error: unknown,
) => error is OperationUnavailableErrorLike {
  const guard = (commandExports as unknown as Record<string, unknown>)[
    "isOperationUnavailableError"
  ];
  expect(guard, "tauriCommands must export isOperationUnavailableError").toBeTypeOf(
    "function",
  );
  return guard as (error: unknown) => error is OperationUnavailableErrorLike;
}

function browserPreviewService(): BrowserPreviewService | undefined {
  const service = (previewExports as unknown as Record<string, unknown>)[
    "browserPreviewService"
  ];
  expect(
    service,
    "browserDevMocks must export the explicitly simulated browserPreviewService",
  ).toBeDefined();
  return service as BrowserPreviewService | undefined;
}

function expectReceiptHasNoEvidenceOrValue(receipt: OperationReceipt): void {
  expect(receipt.diagnostics).toEqual([]);
  for (const key of [
    "inputHash",
    "artifactHash",
    "externalResourceId",
    "value",
  ] as const) {
    expect(receipt).not.toHaveProperty(key);
  }
}

function expectSimulatedPreviewReceipt(receipt: OperationReceipt): void {
  expect(receipt.state).toBe("simulated");
  expect(receipt.authoritative).toBe(false);
  expect(receipt.retrySafety).toBe("not_retryable");
  expect(receipt.message).toContain("[Browser preview]");
  expectReceiptHasNoEvidenceOrValue(receipt);
}

describe("browser command truth boundary", () => {
  beforeEach(() => {
    clearTauriRuntime();
    invokeMock.mockReset();
  });

  afterEach(() => {
    clearTauriRuntime();
  });

  it("exports the typed unavailable error and guard", () => {
    const exports = commandExports as unknown as Record<string, unknown>;
    expect(exports.OperationUnavailableError).toBeTypeOf("function");
    expect(exports.isOperationUnavailableError).toBeTypeOf("function");
  });

  it("rejects all seventeen authority operations with isolated unavailable receipts", async () => {
    const guard = operationUnavailableGuard();
    const caught = await Promise.all(
      authorityCases.map(async ({ call }) => {
        try {
          await call();
          return undefined;
        } catch (error) {
          return error;
        }
      }),
    );

    expect(caught).toHaveLength(17);
    expect(
      caught
        .map((error, index) =>
          guard(error)
            ? null
            : {
                operation: authorityCases[index].operation,
                error: error instanceof Error ? error.message : String(error),
              },
        )
        .filter((error) => error !== null),
    ).toEqual([]);

    const correlationIds = new Set<string>();
    caught.forEach((error, index) => {
      expect(guard(error)).toBe(true);
      if (!guard(error)) return;

      const receipt = error.receipt;
      expect(error.name).toBe("OperationUnavailableError");
      expect(receipt.operation).toBe(authorityCases[index].operation);
      expect(receipt.state).toBe("unavailable");
      expect(receipt.authoritative).toBe(false);
      expect(receipt.retrySafety).toBe("not_retryable");
      expect(receipt.recoveryAction).toContain("RobloxForge Desktop");
      expectReceiptHasNoEvidenceOrValue(receipt);
      expect(JSON.stringify(error)).not.toContain(ARGUMENT_SENTINEL);
      correlationIds.add(receipt.correlationId);
    });

    expect(correlationIds.size).toBe(17);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("returns inert values for passive browser queries without invoking Tauri", async () => {
    await expect(aiCommands.checkApiKey()).resolves.toBeNull();
    await expect(authCommands.getAuthState()).resolves.toBeNull();
    await expect(rojoCommands.checkStatus()).resolves.toEqual({
      installed: false,
      version: null,
      serving: false,
      serve_port: null,
      install_instructions:
        "Open RobloxForge Desktop to check Rojo installation and status.",
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("keeps preview CRUD data intact and outside simulated receipts", async () => {
    const preview = browserPreviewService();
    if (!preview) return;

    const created = await preview.createProject("obby", "Truthful Preview");
    expect(created.data).toEqual(
      expect.objectContaining({
        name: "Truthful Preview",
        path: "browser-preview://Truthful_Preview",
        template: "obby",
        createdAt: PREVIEW_CREATED_AT,
      }),
    );
    expectSimulatedPreviewReceipt(created.receipt);

    const state = await preview.getProjectState(created.data.path);
    expect(state.data.path).toBe(created.data.path);
    expect(state.data.name).toBe("Truthful Preview");
    expectSimulatedPreviewReceipt(state.receipt);

    const longScript = `-- ${ARGUMENT_SENTINEL}\n${"print('intact preview data')\n".repeat(80)}`;
    const written = await preview.writeFile(
      created.data.path,
      "src/server/Long.server.luau",
      longScript,
    );
    expect(written).toHaveProperty("data", undefined);
    expectSimulatedPreviewReceipt(written.receipt);

    const read = await preview.readFile(
      created.data.path,
      "src/server/Long.server.luau",
    );
    expect(read.data).toBe(longScript);
    expect(read.data.length).toBeGreaterThan(256);
    expectSimulatedPreviewReceipt(read.receipt);
    expect(JSON.stringify(read.receipt)).not.toContain(ARGUMENT_SENTINEL);
  });

  it("labels fixed Director and analytics fixtures as sample-only", async () => {
    const preview = browserPreviewService();
    if (!preview) return;

    const director = await preview.getSampleDirectorResponse();
    expect(director.data.message).toMatch(/^\[Sample Director\]/);
    expect(director.data.changes).toEqual([]);
    expectSimulatedPreviewReceipt(director.receipt);

    const stats = await preview.getSampleGameStats();
    expect(stats.data.length).toBeGreaterThan(0);
    for (const game of stats.data) {
      expect(game.universe_id).toMatch(/^sample-only-/);
      expect(game.name).toMatch(/^\[Sample only\]/);
      expect(game.updated).toBe(PREVIEW_STATS_UPDATED_AT);
    }
    expectSimulatedPreviewReceipt(stats.receipt);
  });

  it("preserves invoke pass-through inside the Tauri runtime", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
    const desktopResult = {
      success: true,
      versionNumber: 42,
      gameUrl: "https://www.roblox.com/games/42",
    };
    invokeMock.mockResolvedValueOnce(desktopResult);

    await expect(
      publishCommands.publishGame("project", "name", "description", "12", "34"),
    ).resolves.toBe(desktopResult);
    expect(invokeMock).toHaveBeenCalledWith("publish_game", {
      projectPath: "project",
      gameName: "name",
      gameDescription: "description",
      universeId: "12",
      placeId: "34",
    });
  });
});
