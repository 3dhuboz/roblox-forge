import { invoke } from "@tauri-apps/api/core";
import type { ProjectInfo, ProjectState } from "../types/project";
import type { AiResponse, ChatMessage } from "../types/ai";
import type { AuthState, PublishResult } from "../types/roblox";
import type { ValidationIssue } from "../types/validation";
import { isTauriRuntime } from "../lib/isTauriRuntime";
import * as mock from "./browserDevMocks";

const NEED_DESKTOP =
  "RobloxForge must run as the desktop app. Install Rust from https://rustup.rs/ and run npm run tauri dev.";

async function devOrInvoke<T>(
  runInvoke: () => Promise<T>,
  runMock: () => T | Promise<T>,
): Promise<T> {
  if (isTauriRuntime()) {
    return runInvoke();
  }
  if (!import.meta.env.DEV) {
    throw new Error(NEED_DESKTOP);
  }
  return runMock();
}

async function devOrInvokeTauriOnly<T>(runInvoke: () => Promise<T>): Promise<T> {
  if (isTauriRuntime()) {
    return runInvoke();
  }
  throw new Error(
    import.meta.env.DEV
      ? "This action only works in the desktop app. Run npm run tauri dev."
      : NEED_DESKTOP,
  );
}

export const projectCommands = {
  createProject: (templateName: string, projectName: string) =>
    devOrInvoke(
      () => invoke<ProjectInfo>("create_project", { templateName, projectName }),
      () => mock.mockCreateProject(templateName, projectName),
    ),

  getProjectState: (projectPath: string) =>
    devOrInvoke(
      () => invoke<ProjectState>("get_project_state", { projectPath }),
      () => mock.mockGetProjectState(projectPath),
    ),

  writeFile: (projectPath: string, relativePath: string, content: string) =>
    devOrInvoke(
      () =>
        invoke<void>("write_file", { projectPath, relativePath, content }),
      async () => {
        mock.mockWriteFile(projectPath, relativePath, content);
      },
    ),
};

export const aiCommands = {
  sendChatMessage: (
    projectPath: string,
    message: string,
    history: ChatMessage[],
    userLevel?: string,
    userName?: string,
  ) =>
    devOrInvoke(
      () =>
        invoke<AiResponse>("send_chat_message", {
          projectPath,
          message,
          history,
          userLevel,
          userName,
        }),
      () => mock.mockSendChatMessage(message),
    ),

  setApiKey: (apiKey: string) =>
    devOrInvoke(
      () => invoke<void>("set_api_key", { apiKey }),
      async () => {
        void apiKey;
      },
    ),
};

export const buildCommands = {
  buildProject: (projectPath: string) =>
    devOrInvoke(
      () => invoke<{ rbxlPath: string; warnings: string[] }>("build_project", { projectPath }),
      () => mock.mockBuildProject(projectPath),
    ),
};

export const authCommands = {
  startOauthFlow: () =>
    devOrInvokeTauriOnly(() => invoke<string>("start_oauth_flow")),

  handleOauthCallback: (code: string, state: string) =>
    devOrInvokeTauriOnly(() =>
      invoke<AuthState>("handle_oauth_callback", { code, state }),
    ),

  getAuthState: () =>
    devOrInvoke(
      () => invoke<AuthState | null>("get_auth_state"),
      () => mock.mockGetAuthState(),
    ),

  refreshAuthToken: () =>
    devOrInvokeTauriOnly(() => invoke<AuthState>("refresh_auth_token")),

  logout: () =>
    devOrInvoke(
      () => invoke<void>("logout"),
      async () => {},
    ),
};

export const publishCommands = {
  publishGame: (
    projectPath: string,
    gameName: string,
    gameDescription: string,
    universeId: string,
    placeId: string,
  ) =>
    devOrInvoke(
      () =>
        invoke<PublishResult>("publish_game", {
          projectPath,
          gameName,
          gameDescription,
          universeId,
          placeId,
        }),
      () => mock.mockPublishGame(),
    ),
};

export const validationCommands = {
  validateProject: (projectPath: string) =>
    devOrInvoke(
      () => invoke<ValidationIssue[]>("validate_project", { projectPath }),
      () => mock.mockValidateProject(),
    ),
};
