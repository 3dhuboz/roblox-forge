import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MonetizationPanel } from "../../features/build/MonetizationPanel";
import { ScriptEditor } from "../../features/build/ScriptEditor";
import * as projectFileClient from "../../services/projectFileClient";
import {
  browserPreviewService,
  isOperationUnavailableError,
} from "../../services/tauriCommands";
import {
  PALETTE_ITEMS,
  useCanvasStore,
} from "../../stores/canvasStore";
import { useProjectStore } from "../../stores/projectStore";
import { useToastStore } from "../../stores/toastStore";
import { useVisualScriptStore } from "../../stores/visualScriptStore";
import type { ProjectInfo, ProjectState, ScriptFile } from "../../types/project";

const originalProjectStoreState = useProjectStore.getState();
const originalCanvasStoreState = useCanvasStore.getState();
const originalToastStoreState = useToastStore.getState();
const originalVisualScriptStoreState = useVisualScriptStore.getState();

const editorScript: ScriptFile = {
  relativePath: "src/server/Editor.server.luau",
  name: "Editor",
  scriptType: "server",
  content: "print('original')",
};

const previewProject: ProjectInfo = {
  name: "Consumer Preview",
  path: "browser-preview://Consumer_Preview",
  template: "obby",
  createdAt: "2000-05-01T00:00:00.000Z",
};

const previewProjectState: ProjectState = {
  name: previewProject.name,
  path: previewProject.path,
  template: previewProject.template,
  hierarchy: {
    className: "DataModel",
    name: "DataModel",
    properties: {},
    children: [],
  },
  scripts: [editorScript],
  stageCount: 1,
};

function clearTauriRuntime(): void {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
}

beforeEach(() => {
  clearTauriRuntime();
  useProjectStore.setState(originalProjectStoreState, true);
  useCanvasStore.setState(originalCanvasStoreState, true);
  useToastStore.setState(originalToastStoreState, true);
  useVisualScriptStore.setState(originalVisualScriptStoreState, true);
});

afterEach(() => {
  clearTauriRuntime();
  useProjectStore.setState(originalProjectStoreState, true);
  useCanvasStore.setState(originalCanvasStoreState, true);
  useToastStore.setState(originalToastStoreState, true);
  useVisualScriptStore.setState(originalVisualScriptStoreState, true);
  vi.restoreAllMocks();
});

describe("ScriptEditor file failures", () => {
  it("shows an accessible save error and keeps the script dirty", async () => {
    useProjectStore.setState({
      project: previewProject,
      projectState: previewProjectState,
      refreshProjectState: vi.fn().mockResolvedValue(undefined),
    });
    vi.spyOn(projectFileClient, "writeFile").mockRejectedValueOnce(
      new Error("preview write denied"),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<ScriptEditor projectPath={previewProject.path} />);

    const editor = await screen.findByRole("textbox");
    await user.clear(editor);
    await user.type(editor, "print('changed')");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/preview write denied/i);
    expect(editor).toHaveValue("print('changed')");
    expect(screen.getByTitle("Unsaved changes")).toBeInTheDocument();
    expect(screen.getByText("src/server/Editor.server.luau (modified)"))
      .toBeInTheDocument();
  });
});

describe("MonetizationPanel file transactions", () => {
  it("does not report success when the second generated file fails", async () => {
    useProjectStore.setState({ project: previewProject });
    const clientWrite = vi
      .spyOn(projectFileClient, "writeFile")
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("config write failed"));
    render(<MonetizationPanel projectPath={previewProject.path} />);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Generate Script" }));

    await waitFor(() => expect(clientWrite).toHaveBeenCalledTimes(2));
    expect(clientWrite.mock.calls.map((call) => call[1])).toEqual([
      "src/server/MonetizationHandler.server.luau",
      "monetization.json",
    ]);
    expect(
      useToastStore.getState().toasts.some((toast) => toast.type === "success"),
    ).toBe(false);
    expect(
      useToastStore
        .getState()
        .toasts.some((toast) => toast.message.includes("config write failed")),
    ).toBe(true);
    expect(
      screen.queryByRole("button", { name: "Saved!" }),
    ).not.toBeInTheDocument();
  });
});

describe("visual script preview persistence", () => {
  it("roundtrips generated graph and script data through preview files", async () => {
    const created = await browserPreviewService.createProject(
      "obby",
      "Visual Script Consumer Roundtrip",
    );
    const store = useVisualScriptStore.getState();
    store.setScriptName("PreviewRoundtrip");
    store.addNode("on_player_join", 12, 34);
    useVisualScriptStore.getState().compile();
    const compiledCode = useVisualScriptStore.getState().compiledCode;
    expect(compiledCode).toContain("PreviewRoundtrip");

    await useVisualScriptStore.getState().saveToProject(created.data.path);
    await useVisualScriptStore.getState().saveGraphJson(created.data.path);

    await expect(
      projectFileClient.readFile(
        created.data.path,
        "src/server/VisualScripts/PreviewRoundtrip.server.luau",
      ),
    ).resolves.toBe(compiledCode);
    await expect(
      projectFileClient.readFile(created.data.path, "visual-scripts.json"),
    ).resolves.toContain("on_player_join");

    useVisualScriptStore.getState().clearGraph();
    useVisualScriptStore.getState().setScriptName("ChangedAfterSave");
    await useVisualScriptStore.getState().loadGraphJson(created.data.path);

    expect(useVisualScriptStore.getState().scriptName).toBe(
      "PreviewRoundtrip",
    );
    expect(useVisualScriptStore.getState().nodes).toEqual([
      expect.objectContaining({
        position: { x: 12, y: 34 },
        data: expect.objectContaining({ nodeType: "on_player_join" }),
      }),
    ]);
  });

  it("rethrows unavailable authority reads for non-preview paths", async () => {
    const error = await useVisualScriptStore
      .getState()
      .loadGraphJson("C:/RobloxForge/Unavailable_Project")
      .then(
        () => undefined,
        (caught: unknown) => caught,
      );

    expect(isOperationUnavailableError(error)).toBe(true);
    if (isOperationUnavailableError(error)) {
      expect(error.receipt.operation).toBe("read_file");
    }
  });
});

describe("canvas file transaction state", () => {
  it.each([1, 2])(
    "preserves lastSavedAt and clears isSaving when write %s fails",
    async (failedWrite) => {
      const ground = PALETTE_ITEMS.find((item) => item.type === "ground");
      expect(ground).toBeDefined();
      if (!ground) return;

      useCanvasStore.getState().addElement(ground, 100, 100);
      useCanvasStore.setState({ lastSavedAt: 123_456 });
      const clientWrite = vi.spyOn(projectFileClient, "writeFile");
      if (failedWrite === 1) {
        clientWrite.mockRejectedValueOnce(new Error("model write failed"));
      } else {
        clientWrite
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error("terrain write failed"));
      }

      await expect(
        useCanvasStore
          .getState()
          .saveToProject("browser-preview://Canvas_Consumer_Failure"),
      ).rejects.toThrow(/write failed/);

      expect(clientWrite).toHaveBeenCalledTimes(failedWrite);
      expect(useCanvasStore.getState().lastSavedAt).toBe(123_456);
      expect(useCanvasStore.getState().isSaving).toBe(false);
    },
  );
});
