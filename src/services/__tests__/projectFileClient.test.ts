import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isBrowserPreviewProjectPath,
  readFile,
  writeFile,
} from "../projectFileClient";
import {
  browserPreviewService,
  isOperationUnavailableError,
  projectCommands,
} from "../tauriCommands";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

function clearTauriRuntime(): void {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
}

function enableTauriRuntime(): void {
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    configurable: true,
    value: {},
  });
}

beforeEach(() => {
  clearTauriRuntime();
  invokeMock.mockReset();
});

afterEach(() => {
  clearTauriRuntime();
  vi.restoreAllMocks();
});

describe("projectFileClient path authority", () => {
  it("recognizes only explicit browser preview project paths", () => {
    expect(isBrowserPreviewProjectPath("browser-preview://My_Game")).toBe(true);
    expect(isBrowserPreviewProjectPath("browser-dev://My_Game")).toBe(false);
    expect(isBrowserPreviewProjectPath("C:/RobloxForge/My_Game")).toBe(false);
    expect(isBrowserPreviewProjectPath("")).toBe(false);
  });

  it("roundtrips preview files through the preview service in a browser", async () => {
    const created = await browserPreviewService.createProject(
      "obby",
      "File Client Browser",
    );
    const previewWrite = vi.spyOn(browserPreviewService, "writeFile");
    const previewRead = vi.spyOn(browserPreviewService, "readFile");
    const desktopWrite = vi.spyOn(projectCommands, "writeFile");
    const desktopRead = vi.spyOn(projectCommands, "readFile");
    const content = "print('browser preview roundtrip')";

    await writeFile(
      created.data.path,
      "src/server/Roundtrip.server.luau",
      content,
    );
    await expect(
      readFile(created.data.path, "src/server/Roundtrip.server.luau"),
    ).resolves.toBe(content);

    expect(previewWrite).toHaveBeenCalledWith(
      created.data.path,
      "src/server/Roundtrip.server.luau",
      content,
    );
    expect(previewRead).toHaveBeenCalledWith(
      created.data.path,
      "src/server/Roundtrip.server.luau",
    );
    expect(desktopWrite).not.toHaveBeenCalled();
    expect(desktopRead).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("keeps preview paths in memory even when Tauri globals exist", async () => {
    const created = await browserPreviewService.createProject(
      "obby",
      "File Client Tauri Guard",
    );
    enableTauriRuntime();
    const previewWrite = vi.spyOn(browserPreviewService, "writeFile");
    const previewRead = vi.spyOn(browserPreviewService, "readFile");
    const content = "return 'still preview'";

    await writeFile(created.data.path, "src/shared/Guard.luau", content);
    await expect(
      readFile(created.data.path, "src/shared/Guard.luau"),
    ).resolves.toBe(content);

    expect(previewWrite).toHaveBeenCalledTimes(1);
    expect(previewRead).toHaveBeenCalledTimes(1);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("does not reinterpret legacy or host browser paths as previews", async () => {
    const legacyError = await writeFile(
      "browser-dev://Legacy_Project",
      "src/server/Legacy.server.luau",
      "return true",
    ).catch((error: unknown) => error);
    const hostError = await readFile(
      "C:/RobloxForge/Host_Project",
      "src/server/Host.server.luau",
    ).catch((error: unknown) => error);

    expect(isOperationUnavailableError(legacyError)).toBe(true);
    expect(isOperationUnavailableError(hostError)).toBe(true);
    if (isOperationUnavailableError(legacyError)) {
      expect(legacyError.receipt.operation).toBe("write_file");
    }
    if (isOperationUnavailableError(hostError)) {
      expect(hostError.receipt.operation).toBe("read_file");
    }
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("passes non-preview paths straight through to Tauri commands", async () => {
    enableTauriRuntime();
    invokeMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce("desktop content");

    await writeFile(
      "D:/RobloxForge/Desktop_Project",
      "src/server/Desktop.server.luau",
      "print('desktop')",
    );
    await expect(
      readFile(
        "D:/RobloxForge/Desktop_Project",
        "src/server/Desktop.server.luau",
      ),
    ).resolves.toBe("desktop content");

    expect(invokeMock).toHaveBeenNthCalledWith(1, "write_file", {
      projectPath: "D:/RobloxForge/Desktop_Project",
      relativePath: "src/server/Desktop.server.luau",
      content: "print('desktop')",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "read_file", {
      projectPath: "D:/RobloxForge/Desktop_Project",
      relativePath: "src/server/Desktop.server.luau",
    });
  });
});
