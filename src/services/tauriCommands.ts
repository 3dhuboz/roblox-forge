import { invoke } from "@tauri-apps/api/core";
import type { AiResponse, ChatMessage } from "../types/ai";
import type { ProjectInfo, ProjectState } from "../types/project";
import { createBrowserReceipt, type OperationReceipt } from "../types/receipts";
import type { AuthState, PublishResult } from "../types/roblox";
import type {
  CredentialMutationReceipt,
  PublishRobloxProjectInput,
  RegisterRobloxTargetInput,
  RobloxAuthorityState,
  RobloxCredentialPurpose,
  RobloxPublishReceipt,
  TargetRegistrationReceipt,
} from "../types/robloxAuthority";
import type { ValidationIssue } from "../types/validation";
import { isTauriRuntime } from "../lib/isTauriRuntime";

const DESKTOP_RECOVERY_ACTION =
  "Open RobloxForge Desktop to run this operation.";
const UNAVAILABLE_MESSAGE =
  "This authority operation is unavailable in browser preview.";

let browserCorrelationSequence = 0;

type AuthorityOperation =
  | "create_project"
  | "get_project_state"
  | "write_file"
  | "read_file"
  | "send_chat_message"
  | "set_api_key"
  | "get_roblox_authority_state"
  | "set_roblox_api_key"
  | "delete_roblox_api_key"
  | "register_roblox_target"
  | "publish_roblox_project"
  | "build_project"
  | "start_oauth_flow"
  | "handle_oauth_callback"
  | "refresh_auth_token"
  | "logout"
  | "publish_game"
  | "fetch_game_stats"
  | "start_rojo_serve"
  | "stop_rojo_serve"
  | "validate_project"
  | "auto_fix_issue";

function nextBrowserCorrelationId(): string {
  browserCorrelationSequence += 1;
  return `browser:authority:${browserCorrelationSequence}`;
}

export class OperationUnavailableError extends Error {
  readonly receipt: OperationReceipt;

  constructor(receipt: OperationReceipt) {
    super(receipt.message);
    this.name = "OperationUnavailableError";
    this.receipt = receipt;
  }
}

export function isOperationUnavailableError(
  error: unknown,
): error is OperationUnavailableError {
  return error instanceof OperationUnavailableError;
}

async function authorityOrInvoke<T>(
  operation: AuthorityOperation,
  runInvoke: () => Promise<T>,
): Promise<T> {
  if (isTauriRuntime()) {
    return runInvoke();
  }

  const receiptOperation =
    operation === "set_api_key"
      ? "set_key"
      : operation === "set_roblox_api_key"
        ? "set_roblox_key"
        : operation === "delete_roblox_api_key"
          ? "delete_roblox_key"
          : operation === "refresh_auth_token"
            ? "refresh_auth"
            : operation;
  const receipt = createBrowserReceipt({
    state: "unavailable",
    operation: receiptOperation,
    correlationId: nextBrowserCorrelationId(),
    message: UNAVAILABLE_MESSAGE,
    recoveryAction: DESKTOP_RECOVERY_ACTION,
  });

  // These are fixed command identifiers, not untrusted input. The receipt
  // sanitizer rejects their secret-marker substrings, so restore the exact
  // static Tauri operation after all user-controlled receipt fields are clean.
  throw new OperationUnavailableError(
    receiptOperation === operation ? receipt : { ...receipt, operation },
  );
}

async function passiveOrInvoke<T>(
  runInvoke: () => Promise<T>,
  browserValue: () => T,
): Promise<T> {
  return isTauriRuntime() ? runInvoke() : browserValue();
}

export const projectCommands = {
  createProject: (templateName: string, projectName: string) =>
    authorityOrInvoke("create_project", () =>
      invoke<ProjectInfo>("create_project", { templateName, projectName }),
    ),

  getProjectState: (projectPath: string) =>
    authorityOrInvoke("get_project_state", () =>
      invoke<ProjectState>("get_project_state", { projectPath }),
    ),

  writeFile: (projectPath: string, relativePath: string, content: string) =>
    authorityOrInvoke("write_file", () =>
      invoke<void>("write_file", { projectPath, relativePath, content }),
    ),

  readFile: (projectPath: string, relativePath: string) =>
    authorityOrInvoke("read_file", () =>
      invoke<string>("read_file", { projectPath, relativePath }),
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
    authorityOrInvoke("send_chat_message", () =>
      invoke<AiResponse>("send_chat_message", {
        projectPath,
        message,
        history,
        userLevel,
        userName,
      }),
    ),

  setApiKey: (apiKey: string) =>
    authorityOrInvoke("set_api_key", () =>
      invoke<void>("set_api_key", { apiKey }),
    ),

  checkApiKey: () =>
    passiveOrInvoke(
      () => invoke<string | null>("check_api_key"),
      () => null,
    ),
};

export const buildCommands = {
  buildProject: (projectPath: string) =>
    authorityOrInvoke("build_project", () =>
      invoke<{ rbxlPath: string; warnings: string[] }>("build_project", {
        projectPath,
      }),
    ),
};

export const authCommands = {
  startOauthFlow: () =>
    authorityOrInvoke("start_oauth_flow", () =>
      invoke<string>("start_oauth_flow"),
    ),

  handleOauthCallback: (code: string, state: string) =>
    authorityOrInvoke("handle_oauth_callback", () =>
      invoke<AuthState>("handle_oauth_callback", { code, state }),
    ),

  getAuthState: () =>
    passiveOrInvoke(
      () => invoke<AuthState | null>("get_auth_state"),
      () => null,
    ),

  refreshAuthToken: () =>
    authorityOrInvoke("refresh_auth_token", () =>
      invoke<AuthState>("refresh_auth_token"),
    ),

  logout: () =>
    authorityOrInvoke("logout", () => invoke<void>("logout")),
};

export const publishCommands = {
  publishGame: (
    projectPath: string,
    gameName: string,
    gameDescription: string,
    universeId: string,
    placeId: string,
  ) =>
    authorityOrInvoke("publish_game", () =>
      invoke<PublishResult>("publish_game", {
        projectPath,
        gameName,
        gameDescription,
        universeId,
        placeId,
      }),
    ),
};

export const robloxAuthorityCommands = {
  getState: () =>
    authorityOrInvoke("get_roblox_authority_state", () =>
      invoke<RobloxAuthorityState>("get_roblox_authority_state"),
    ),

  setApiKey: (purpose: RobloxCredentialPurpose, apiKey: string) =>
    authorityOrInvoke("set_roblox_api_key", () =>
      invoke<CredentialMutationReceipt>("set_roblox_api_key", {
        purpose,
        apiKey,
      }),
    ),

  deleteApiKey: (purpose: RobloxCredentialPurpose) =>
    authorityOrInvoke("delete_roblox_api_key", () =>
      invoke<CredentialMutationReceipt>("delete_roblox_api_key", { purpose }),
    ),

  registerTarget: (input: RegisterRobloxTargetInput) =>
    authorityOrInvoke("register_roblox_target", () =>
      invoke<TargetRegistrationReceipt>("register_roblox_target", { ...input }),
    ),

  publishProject: (input: PublishRobloxProjectInput) =>
    authorityOrInvoke("publish_roblox_project", () =>
      invoke<RobloxPublishReceipt>("publish_roblox_project", { ...input }),
    ),
};

export interface GameStats {
  universe_id: string;
  name: string;
  playing: number;
  visits: number;
  favorites: number;
  updated: string;
}

export const dashboardCommands = {
  fetchGameStats: () =>
    authorityOrInvoke("fetch_game_stats", () =>
      invoke<GameStats[]>("fetch_game_stats"),
    ),
};

export interface RojoStatus {
  installed: boolean;
  version: string | null;
  serving: boolean;
  serve_port: number | null;
  install_instructions: string | null;
}

export const rojoCommands = {
  checkStatus: () =>
    passiveOrInvoke(
      () => invoke<RojoStatus>("check_rojo_status"),
      () => ({
        installed: false,
        version: null,
        serving: false,
        serve_port: null,
        install_instructions:
          "Open RobloxForge Desktop to check Rojo installation and status.",
      }),
    ),

  startServe: (projectPath: string) =>
    authorityOrInvoke("start_rojo_serve", () =>
      invoke<number>("start_rojo_serve", { projectPath }),
    ),

  stopServe: () =>
    authorityOrInvoke("stop_rojo_serve", () =>
      invoke<void>("stop_rojo_serve"),
    ),
};

export const validationCommands = {
  validateProject: (projectPath: string) =>
    authorityOrInvoke("validate_project", () =>
      invoke<ValidationIssue[]>("validate_project", { projectPath }),
    ),

  autoFixIssue: (projectPath: string, issueId: string) =>
    authorityOrInvoke("auto_fix_issue", () =>
      invoke<string>("auto_fix_issue", { projectPath, issueId }),
    ),
};

export { browserPreviewService } from "./browserDevMocks";
