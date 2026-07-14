import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BuildPage, isBuildAttemptCurrent } from "./BuildPage";
import {
  OperationUnavailableError,
  buildCommands,
} from "../../services/tauriCommands";
import { useCanvasStore } from "../../stores/canvasStore";
import { useProjectStore } from "../../stores/projectStore";
import { createBrowserReceipt } from "../../types/receipts";
import type { ProjectInfo } from "../../types/project";

type BuildResult = Awaited<ReturnType<typeof buildCommands.buildProject>>;

const { isTauriRuntimeMock, openPathMock } = vi.hoisted(() => ({
  isTauriRuntimeMock: vi.fn<() => boolean>(),
  openPathMock: vi.fn<(path: string) => Promise<void>>(),
}));

vi.mock("../../lib/isTauriRuntime", () => ({
  isTauriRuntime: isTauriRuntimeMock,
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: openPathMock,
}));

vi.mock("../builder/GameCanvas3D", () => ({
  GameCanvas3D: () => <div data-testid="game-canvas" />,
}));

vi.mock("../builder/AiSceneChat", () => ({
  AiSceneChat: () => <div data-testid="ai-scene-chat" />,
}));

vi.mock("../builder/VisualScriptEditor", () => ({
  VisualScriptEditor: () => <div data-testid="visual-script-editor" />,
}));

vi.mock("./MonetizationPanel", () => ({
  MonetizationPanel: () => <div data-testid="monetization-panel" />,
}));

vi.mock("./InstanceExplorer", () => ({
  InstanceExplorer: () => <div data-testid="instance-explorer" />,
}));

vi.mock("./PropertyInspector", () => ({
  PropertyInspector: () => <div data-testid="property-inspector" />,
}));

const originalProjectStoreState = useProjectStore.getState();
const originalCanvasStoreState = useCanvasStore.getState();

const project: ProjectInfo = {
  name: "Build Attempt Contract",
  path: "D:/RobloxForge/BuildAttemptContract-A",
  template: "obby",
  createdAt: "2000-07-01T00:00:00.000Z",
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

function renderBuildPage() {
  return render(
    <MemoryRouter>
      <BuildPage />
    </MemoryRouter>,
  );
}

async function clickExport(name: RegExp = /Export to Roblox|Exported!/) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function clickTestInStudio(name: RegExp = /Test in Studio/) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  useProjectStore.setState(originalProjectStoreState, true);
  useCanvasStore.setState(originalCanvasStoreState, true);
  useProjectStore.setState({
    project,
    projectState: null,
  });
  useCanvasStore.setState({
    elements: [
      { id: "export-contract-part" } as (typeof originalCanvasStoreState.elements)[number],
    ],
    isSaving: false,
    lastSavedAt: null,
    loadFromProject: vi.fn(),
    saveToProject: vi.fn().mockResolvedValue(undefined),
    setTemplate: vi.fn(),
  });
  isTauriRuntimeMock.mockReturnValue(false);
  openPathMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  useProjectStore.setState(originalProjectStoreState, true);
  useCanvasStore.setState(originalCanvasStoreState, true);
  vi.restoreAllMocks();
});

describe("isBuildAttemptCurrent", () => {
  const matchingAttempt = {
    mounted: true,
    attemptId: 7,
    currentAttemptId: 7,
    projectPath: "D:/RobloxForge/BuildAttemptContract-A",
    currentProjectPath: "D:/RobloxForge/BuildAttemptContract-A",
  };

  it("accepts a mounted attempt when the ID and project path match", () => {
    expect(isBuildAttemptCurrent(matchingAttempt)).toBe(true);
  });

  it("rejects an unmounted attempt even when the ID and project path match", () => {
    expect(
      isBuildAttemptCurrent({
        ...matchingAttempt,
        mounted: false,
      }),
    ).toBe(false);
  });

  it("rejects attempts with a mismatched ID or project path", () => {
    expect(
      isBuildAttemptCurrent({
        ...matchingAttempt,
        currentAttemptId: matchingAttempt.currentAttemptId + 1,
      }),
    ).toBe(false);
    expect(
      isBuildAttemptCurrent({
        ...matchingAttempt,
        currentProjectPath: "D:/RobloxForge/BuildAttemptContract-B",
      }),
    ).toBe(false);
  });
});

describe("BuildPage export and Studio attempt authority", () => {
  it("shows a typed export-unavailable message and recovery without false success", async () => {
    const unavailable = new OperationUnavailableError(
      createBrowserReceipt({
        state: "unavailable",
        operation: "build_project",
        correlationId: "test:build:unavailable",
        message: "Building is unavailable in browser preview.",
        recoveryAction: "Open RobloxForge Desktop to export this game.",
      }),
    );
    vi.spyOn(buildCommands, "buildProject").mockRejectedValueOnce(unavailable);
    renderBuildPage();

    await clickExport();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(unavailable.message);
    expect(alert).toHaveTextContent(unavailable.receipt.recoveryAction!);
    expect(alert).not.toHaveTextContent("OperationUnavailableError");
    expect(screen.queryByText("Exported!")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Test in Studio/ }),
    ).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent(unavailable.message);
  });

  it("keeps a generic export rejection visible without false success", async () => {
    vi.spyOn(buildCommands, "buildProject").mockRejectedValueOnce(
      new Error("Roblox build service timed out."),
    );
    renderBuildPage();

    await clickExport();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Roblox build service timed out.",
    );
    expect(screen.queryByText("Exported!")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Test in Studio/ }),
    ).not.toBeInTheDocument();
  });

  it("shows export success and enables Studio only after a genuine resolution", async () => {
    vi.spyOn(buildCommands, "buildProject").mockResolvedValueOnce({
      rbxlPath: "D:/RobloxForge/BuildAttemptContract-A/game.rbxl",
      warnings: [],
    });
    renderBuildPage();

    await clickExport();

    expect(screen.getByRole("button", { name: "Exported!" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: /Test in Studio/ }),
    ).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("does not call the opener or claim Studio opened in browser preview", async () => {
    vi.spyOn(buildCommands, "buildProject").mockResolvedValueOnce({
      rbxlPath: "D:/RobloxForge/BuildAttemptContract-A/game.rbxl",
      warnings: [],
    });
    renderBuildPage();
    await clickExport();

    await clickTestInStudio();

    expect(openPathMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Testing in Roblox Studio is unavailable in browser preview.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Open RobloxForge Desktop to test this game.",
    );
    expect(screen.queryByText("Opened in Studio")).not.toBeInTheDocument();
  });

  it("returns Studio to idle and shows a safe alert when the opener rejects", async () => {
    isTauriRuntimeMock.mockReturnValue(true);
    vi.spyOn(buildCommands, "buildProject").mockResolvedValueOnce({
      rbxlPath: "D:/RobloxForge/BuildAttemptContract-A/game.rbxl",
      warnings: [],
    });
    openPathMock.mockRejectedValueOnce(new Error("Studio executable missing."));
    renderBuildPage();
    await clickExport();

    await clickTestInStudio();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Studio executable missing.",
    );
    expect(
      screen.getByRole("button", { name: /Test in Studio/ }),
    ).toBeEnabled();
    expect(screen.queryByText("Opened in Studio")).not.toBeInTheDocument();
  });

  it("disables Studio while opening and marks only the current resolution opened", async () => {
    isTauriRuntimeMock.mockReturnValue(true);
    vi.spyOn(buildCommands, "buildProject").mockResolvedValueOnce({
      rbxlPath: "D:/RobloxForge/BuildAttemptContract-A/game.rbxl",
      warnings: [],
    });
    const opening = deferred<void>();
    openPathMock.mockReturnValueOnce(opening.promise);
    renderBuildPage();
    await clickExport();

    fireEvent.click(screen.getByRole("button", { name: /Test in Studio/ }));

    expect(screen.getByRole("button", { name: "Opening..." })).toBeDisabled();
    await act(async () => {
      opening.resolve();
      await opening.promise;
    });
    expect(
      screen.getByRole("button", { name: "Opened in Studio" }),
    ).toBeEnabled();
  });

  it("ignores an old export after the project path changes and a newer export wins", async () => {
    isTauriRuntimeMock.mockReturnValue(true);
    const firstBuild = deferred<BuildResult>();
    const secondBuild = deferred<BuildResult>();
    vi.spyOn(buildCommands, "buildProject")
      .mockReturnValueOnce(firstBuild.promise)
      .mockReturnValueOnce(secondBuild.promise);
    renderBuildPage();

    fireEvent.click(screen.getByRole("button", { name: "Export to Roblox" }));
    const replacementProject = {
      ...project,
      path: "D:/RobloxForge/BuildAttemptContract-B",
    };
    await act(async () => {
      useProjectStore.setState({ project: replacementProject });
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "Export to Roblox" }));

    await act(async () => {
      secondBuild.resolve({
        rbxlPath: "D:/RobloxForge/BuildAttemptContract-B/game.rbxl",
        warnings: [],
      });
      await secondBuild.promise;
    });
    await act(async () => {
      firstBuild.resolve({
        rbxlPath: "D:/RobloxForge/BuildAttemptContract-A/stale.rbxl",
        warnings: [],
      });
      await firstBuild.promise;
    });

    await clickTestInStudio();
    expect(openPathMock).toHaveBeenCalledTimes(1);
    expect(openPathMock).toHaveBeenCalledWith(
      "D:/RobloxForge/BuildAttemptContract-B/game.rbxl",
    );
  });

  it("ignores a stale Studio completion after a newer export starts", async () => {
    isTauriRuntimeMock.mockReturnValue(true);
    vi.spyOn(buildCommands, "buildProject")
      .mockResolvedValueOnce({
        rbxlPath: "D:/RobloxForge/BuildAttemptContract-A/first.rbxl",
        warnings: [],
      })
      .mockResolvedValueOnce({
        rbxlPath: "D:/RobloxForge/BuildAttemptContract-A/second.rbxl",
        warnings: [],
      });
    const firstOpening = deferred<void>();
    openPathMock
      .mockReturnValueOnce(firstOpening.promise)
      .mockResolvedValueOnce(undefined);
    renderBuildPage();
    await clickExport();

    fireEvent.click(screen.getByRole("button", { name: /Test in Studio/ }));
    expect(screen.getByRole("button", { name: "Opening..." })).toBeDisabled();
    await clickExport(/Exported!/);
    expect(
      screen.getByRole("button", { name: /Test in Studio/ }),
    ).toBeEnabled();

    await act(async () => {
      firstOpening.resolve();
      await firstOpening.promise;
    });
    expect(screen.queryByText("Opened in Studio")).not.toBeInTheDocument();

    await clickTestInStudio();
    expect(openPathMock).toHaveBeenLastCalledWith(
      "D:/RobloxForge/BuildAttemptContract-A/second.rbxl",
    );
    expect(
      screen.getByRole("button", { name: "Opened in Studio" }),
    ).toBeEnabled();
  });

  it("invalidates a pending Studio open when the project path changes", async () => {
    isTauriRuntimeMock.mockReturnValue(true);
    vi.spyOn(buildCommands, "buildProject").mockResolvedValueOnce({
      rbxlPath: "D:/RobloxForge/BuildAttemptContract-A/game.rbxl",
      warnings: [],
    });
    const opening = deferred<void>();
    openPathMock.mockReturnValueOnce(opening.promise);
    renderBuildPage();
    await clickExport();
    fireEvent.click(screen.getByRole("button", { name: /Test in Studio/ }));

    await act(async () => {
      useProjectStore.setState({
        project: {
          ...project,
          path: "D:/RobloxForge/BuildAttemptContract-B",
        },
      });
      await Promise.resolve();
    });
    await act(async () => {
      opening.resolve();
      await opening.promise;
    });

    expect(screen.queryByText("Opened in Studio")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Test in Studio/ }),
    ).not.toBeInTheDocument();
  });

  it("rejects a retained Studio action as soon as project ownership changes", async () => {
    isTauriRuntimeMock.mockReturnValue(true);
    vi.spyOn(buildCommands, "buildProject").mockResolvedValueOnce({
      rbxlPath: "D:/RobloxForge/BuildAttemptContract-A/game.rbxl",
      warnings: [],
    });
    const earlyOpening = deferred<void>();
    openPathMock.mockReturnValueOnce(earlyOpening.promise);
    renderBuildPage();
    await clickExport();
    const retainedStudioButton = screen.getByRole("button", {
      name: /Test in Studio/,
    });

    act(() => {
      useProjectStore.setState({
        project: {
          ...project,
          path: "D:/RobloxForge/BuildAttemptContract-B",
        },
      });
      retainedStudioButton.click();
    });

    expect(openPathMock).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /Test in Studio/ }),
    ).not.toBeInTheDocument();
  });

  it("blocks a retained Studio action when a newer export starts in the same tick", async () => {
    isTauriRuntimeMock.mockReturnValue(true);
    const replacementBuild = deferred<BuildResult>();
    const buildProject = vi
      .spyOn(buildCommands, "buildProject")
      .mockResolvedValueOnce({
        rbxlPath: "D:/RobloxForge/BuildAttemptContract-A/first.rbxl",
        warnings: [],
      })
      .mockReturnValueOnce(replacementBuild.promise);
    const staleOpening = deferred<void>();
    openPathMock.mockReturnValueOnce(staleOpening.promise);
    renderBuildPage();
    await clickExport();
    const retainedExportButton = screen.getByRole("button", {
      name: "Exported!",
    });
    const retainedStudioButton = screen.getByRole("button", {
      name: /Test in Studio/,
    });

    act(() => {
      retainedExportButton.click();
      retainedStudioButton.click();
    });

    expect(buildProject).toHaveBeenCalledTimes(2);
    expect(openPathMock).not.toHaveBeenCalled();

    await act(async () => {
      replacementBuild.resolve({
        rbxlPath: "D:/RobloxForge/BuildAttemptContract-A/second.rbxl",
        warnings: [],
      });
      await replacementBuild.promise;
    });
    expect(
      screen.getByRole("button", { name: /Test in Studio/ }),
    ).toBeEnabled();
    expect(screen.queryByText("Opened in Studio")).not.toBeInTheDocument();

    await act(async () => {
      staleOpening.resolve();
      await staleOpening.promise;
    });
    expect(screen.queryByText("Opened in Studio")).not.toBeInTheDocument();
  });

  it("ignores a pending export settlement after unmount without leaking state", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const pendingBuild = deferred<BuildResult>();
    const buildProject = vi
      .spyOn(buildCommands, "buildProject")
      .mockReturnValueOnce(pendingBuild.promise);
    const view = renderBuildPage();

    act(() => {
      screen.getByRole("button", { name: "Export to Roblox" }).click();
    });
    expect(buildProject).toHaveBeenCalledTimes(1);
    view.unmount();

    await act(async () => {
      pendingBuild.resolve({
        rbxlPath: "D:/RobloxForge/BuildAttemptContract-A/unmounted.rbxl",
        warnings: [],
      });
      await pendingBuild.promise;
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalled();

    // React isolates component instances, so a clean remount is the observable
    // proof that the settled attempt did not leak through shared stores or UI.
    renderBuildPage();
    expect(
      screen.getByRole("button", { name: "Export to Roblox" }),
    ).toBeEnabled();
    expect(screen.queryByText("Exported!")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Test in Studio/ }),
    ).not.toBeInTheDocument();
  });

  it("ignores a pending Studio rejection after unmount without stale error work", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    isTauriRuntimeMock.mockReturnValue(true);
    vi.spyOn(buildCommands, "buildProject").mockResolvedValueOnce({
      rbxlPath: "D:/RobloxForge/BuildAttemptContract-A/game.rbxl",
      warnings: [],
    });
    const opening = deferred<void>();
    openPathMock.mockReturnValueOnce(opening.promise);
    const view = renderBuildPage();
    await clickExport();

    act(() => {
      screen.getByRole("button", { name: /Test in Studio/ }).click();
    });
    expect(openPathMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Opening..." })).toBeDisabled();
    view.unmount();

    await act(async () => {
      opening.reject(new Error("Late Studio rejection after unmount."));
      await opening.promise.catch(() => undefined);
      await Promise.resolve();
    });

    expect(consoleError).not.toHaveBeenCalled();

    renderBuildPage();
    expect(
      screen.getByRole("button", { name: "Export to Roblox" }),
    ).toBeEnabled();
    expect(screen.queryByText("Opened in Studio")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("uses an immediate Studio in-flight guard for a same-tick double click", async () => {
    isTauriRuntimeMock.mockReturnValue(true);
    vi.spyOn(buildCommands, "buildProject").mockResolvedValueOnce({
      rbxlPath: "D:/RobloxForge/BuildAttemptContract-A/game.rbxl",
      warnings: [],
    });
    const opening = deferred<void>();
    openPathMock.mockReturnValue(opening.promise);
    renderBuildPage();
    await clickExport();
    const studioButton = screen.getByRole("button", {
      name: /Test in Studio/,
    });

    act(() => {
      studioButton.click();
      studioButton.click();
    });

    expect(openPathMock).toHaveBeenCalledTimes(1);
    expect(openPathMock).toHaveBeenCalledWith(
      "D:/RobloxForge/BuildAttemptContract-A/game.rbxl",
    );
    expect(screen.getByRole("button", { name: "Opening..." })).toBeDisabled();

    await act(async () => {
      opening.resolve();
      await opening.promise;
    });
  });

  it("uses an immediate in-flight guard for a same-tick double click", () => {
    const pendingBuild = deferred<BuildResult>();
    const buildProject = vi
      .spyOn(buildCommands, "buildProject")
      .mockReturnValue(pendingBuild.promise);
    renderBuildPage();
    const exportButton = screen.getByRole("button", {
      name: "Export to Roblox",
    });

    act(() => {
      exportButton.click();
      exportButton.click();
    });

    expect(buildProject).toHaveBeenCalledTimes(1);
    expect(buildProject).toHaveBeenCalledWith(project.path);
  });
});
