import { browserPreviewService, projectCommands } from "./tauriCommands";

const BROWSER_PREVIEW_PROJECT_PREFIX = "browser-preview://";

export function isBrowserPreviewProjectPath(projectPath: string): boolean {
  return projectPath.startsWith(BROWSER_PREVIEW_PROJECT_PREFIX);
}

export async function writeFile(
  projectPath: string,
  relativePath: string,
  content: string,
): Promise<void> {
  if (isBrowserPreviewProjectPath(projectPath)) {
    await browserPreviewService.writeFile(projectPath, relativePath, content);
    return;
  }

  return projectCommands.writeFile(projectPath, relativePath, content);
}

export async function readFile(
  projectPath: string,
  relativePath: string,
): Promise<string> {
  if (isBrowserPreviewProjectPath(projectPath)) {
    return (await browserPreviewService.readFile(projectPath, relativePath)).data;
  }

  return projectCommands.readFile(projectPath, relativePath);
}
