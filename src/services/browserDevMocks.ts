import { getTemplatePreset, hierarchyToInstanceNode } from "../lib/templatePresets";
import type { AiResponse } from "../types/ai";
import type { ProjectInfo, ProjectState, ScriptFile } from "../types/project";
import { createBrowserReceipt, type OperationReceipt } from "../types/receipts";
import type { GameStats } from "./tauriCommands";

const PREVIEW_PREFIX = "browser-preview://";
const PREVIEW_CREATED_AT = "2000-01-01T00:00:00.000Z";
const PREVIEW_STATS_UPDATED_AT = "2000-01-02T00:00:00.000Z";

const previewProjects = new Map<string, ProjectState>();
const previewFiles = new Map<string, string>();
let previewCorrelationSequence = 0;

export interface BrowserPreviewResult<T> {
  readonly receipt: OperationReceipt;
  readonly data: T;
}

function sanitizeName(name: string): string {
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  return sanitized.length > 0 ? sanitized : "Untitled";
}

function simulatedReceipt(operation: string, message: string): OperationReceipt {
  previewCorrelationSequence += 1;
  return createBrowserReceipt({
    state: "simulated",
    operation,
    correlationId: `preview:${operation}:${previewCorrelationSequence}`,
    message,
  });
}

function requirePreviewPath(projectPath: string): void {
  if (!projectPath.startsWith(PREVIEW_PREFIX)) {
    throw new Error(
      "Browser preview data is available only through browser-preview:// paths.",
    );
  }
}

function cloneScripts(scripts: readonly ScriptFile[]): ScriptFile[] {
  return scripts.map((script) => ({ ...script }));
}

function createProjectState(
  templateName: string,
  projectName: string,
  path: string,
): ProjectState {
  const preset = getTemplatePreset(templateName) ?? getTemplatePreset("obby");
  if (!preset) {
    throw new Error("Browser preview template data is unavailable.");
  }

  return {
    name: projectName,
    path,
    template: templateName,
    hierarchy: hierarchyToInstanceNode(preset.hierarchy),
    scripts: cloneScripts(preset.scripts),
    stageCount: preset.stageCount,
  };
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/");
}

function previewFileKey(projectPath: string, relativePath: string): string {
  return `${projectPath}::${normalizeRelativePath(relativePath)}`;
}

function scriptType(relativePath: string): ScriptFile["scriptType"] {
  if (relativePath.includes(".server.")) return "server";
  if (relativePath.includes(".client.")) return "client";
  return "module";
}

function scriptName(relativePath: string): string {
  const segments = normalizeRelativePath(relativePath).split("/");
  return segments.pop()?.split(".")[0] ?? "PreviewScript";
}

export const browserPreviewService = {
  async createProject(
    templateName: string,
    projectName: string,
  ): Promise<BrowserPreviewResult<ProjectInfo>> {
    const path = `${PREVIEW_PREFIX}${sanitizeName(projectName)}`;
    previewProjects.set(
      path,
      createProjectState(templateName, projectName, path),
    );

    return {
      receipt: simulatedReceipt(
        "browser_preview.create_project",
        "Created an in-memory preview project; no desktop project was created.",
      ),
      data: {
        name: projectName,
        path,
        template: templateName,
        createdAt: PREVIEW_CREATED_AT,
      },
    };
  },

  async getProjectState(
    projectPath: string,
  ): Promise<BrowserPreviewResult<ProjectState>> {
    requirePreviewPath(projectPath);
    const state = previewProjects.get(projectPath);
    if (!state) {
      throw new Error("Browser preview project was not found in memory.");
    }

    return {
      receipt: simulatedReceipt(
        "browser_preview.get_project_state",
        "Read an in-memory preview project; no desktop project was opened.",
      ),
      data: {
        ...state,
        scripts: cloneScripts(state.scripts),
      },
    };
  },

  async writeFile(
    projectPath: string,
    relativePath: string,
    content: string,
  ): Promise<BrowserPreviewResult<void>> {
    requirePreviewPath(projectPath);
    const state = previewProjects.get(projectPath);
    if (!state) {
      throw new Error("Browser preview project was not found in memory.");
    }

    const normalizedPath = normalizeRelativePath(relativePath);
    previewFiles.set(previewFileKey(projectPath, normalizedPath), content);

    const existingIndex = state.scripts.findIndex(
      (script) => script.relativePath === normalizedPath,
    );
    const nextScript: ScriptFile = {
      relativePath: normalizedPath,
      name: scriptName(normalizedPath),
      scriptType: scriptType(normalizedPath),
      content,
    };
    const scripts = cloneScripts(state.scripts);
    if (existingIndex >= 0) {
      scripts[existingIndex] = nextScript;
    } else {
      scripts.push(nextScript);
    }
    previewProjects.set(projectPath, { ...state, scripts });

    return {
      receipt: simulatedReceipt(
        "browser_preview.write_file",
        "Stored preview file data in memory only; no desktop file was written.",
      ),
      data: undefined,
    };
  },

  async readFile(
    projectPath: string,
    relativePath: string,
  ): Promise<BrowserPreviewResult<string>> {
    requirePreviewPath(projectPath);
    const content = previewFiles.get(previewFileKey(projectPath, relativePath));
    if (content === undefined) {
      throw new Error("Browser preview file was not found in memory.");
    }

    return {
      receipt: simulatedReceipt(
        "browser_preview.read_file",
        "Read preview file data from memory only.",
      ),
      data: content,
    };
  },

  async getSampleDirectorResponse(): Promise<
    BrowserPreviewResult<AiResponse>
  > {
    return {
      receipt: simulatedReceipt(
        "browser_preview.sample_director",
        "Returned a labelled sample Director response; no project was changed.",
      ),
      data: {
        message:
          "[Sample Director] Example only — describe your game in RobloxForge Desktop for a real proposal.",
        changes: [],
      },
    };
  },

  async getSampleGameStats(): Promise<BrowserPreviewResult<GameStats[]>> {
    return {
      receipt: simulatedReceipt(
        "browser_preview.sample_game_stats",
        "Returned labelled sample analytics; no Roblox owner analytics were read.",
      ),
      data: [
        {
          universe_id: "sample-only-universe-001",
          name: "[Sample only] Space Obby Adventure",
          playing: 23,
          visits: 12_847,
          favorites: 342,
          updated: PREVIEW_STATS_UPDATED_AT,
        },
        {
          universe_id: "sample-only-universe-002",
          name: "[Sample only] Lava Obby Challenge",
          playing: 8,
          visits: 5_621,
          favorites: 128,
          updated: PREVIEW_STATS_UPDATED_AT,
        },
      ],
    };
  },
};
