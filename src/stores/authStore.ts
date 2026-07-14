import { create } from "zustand";
import type { AuthState } from "../types/roblox";
import {
  authCommands,
  isOperationUnavailableError,
} from "../services/tauriCommands";
import { isTauriRuntime } from "../lib/isTauriRuntime";

export type AuthStatus =
  | "unknown"
  | "checking"
  | "signed_out"
  | "signed_in"
  | "unavailable"
  | "error";

export const AUTH_DESKTOP_REQUIRED_MESSAGE =
  "Roblox authentication requires the RobloxForge Desktop app. Open the Desktop app to continue.";

const LOGIN_POLL_INTERVAL_MS = 1_000;
const LOGIN_TIMEOUT_MS = 120_000;

interface AuthStore {
  auth: AuthState | null;
  status: AuthStatus;
  isConnecting: boolean;
  error: string | null;

  checkAuth: () => Promise<void>;
  startLogin: () => Promise<void>;
  logout: () => Promise<void>;
}

type AuthStateUpdate = Pick<
  AuthStore,
  "auth" | "status" | "isConnecting" | "error"
>;

function isValidAuth(auth: AuthState | null): auth is AuthState {
  return auth !== null && auth.expiresAt > Date.now();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function unavailableMessage(error?: unknown, existing?: string | null): string {
  const detail = error === undefined ? existing : errorMessage(error);
  if (!detail) {
    return AUTH_DESKTOP_REQUIRED_MESSAGE;
  }
  return detail.includes(AUTH_DESKTOP_REQUIRED_MESSAGE)
    ? detail
    : `${detail} ${AUTH_DESKTOP_REQUIRED_MESSAGE}`;
}

function failureState(error: unknown): AuthStateUpdate {
  if (isOperationUnavailableError(error)) {
    return {
      auth: null,
      status: "unavailable",
      isConnecting: false,
      error: unavailableMessage(error),
    };
  }

  return {
    auth: null,
    status: "error",
    isConnecting: false,
    error: errorMessage(error),
  };
}

export const useAuthStore = create<AuthStore>((set, get) => {
  let actionSequence = 0;
  let loginPollTimer: ReturnType<typeof setTimeout> | null = null;
  let loginTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  const clearLoginTimers = () => {
    if (loginPollTimer !== null) {
      clearTimeout(loginPollTimer);
      loginPollTimer = null;
    }
    if (loginTimeoutTimer !== null) {
      clearTimeout(loginTimeoutTimer);
      loginTimeoutTimer = null;
    }
  };

  const beginAction = () => {
    actionSequence += 1;
    clearLoginTimers();
    return actionSequence;
  };

  const isCurrentAction = (actionId: number) => actionSequence === actionId;

  const finishLogin = (actionId: number, update: AuthStateUpdate) => {
    if (!isCurrentAction(actionId)) {
      return;
    }
    clearLoginTimers();
    actionSequence += 1;
    set(update);
  };

  const pollForLogin = async (actionId: number): Promise<void> => {
    loginPollTimer = null;
    if (!isCurrentAction(actionId)) {
      return;
    }

    try {
      const auth = await authCommands.getAuthState();
      if (!isCurrentAction(actionId)) {
        return;
      }
      if (isValidAuth(auth)) {
        finishLogin(actionId, {
          auth,
          status: "signed_in",
          isConnecting: false,
          error: null,
        });
        return;
      }

      loginPollTimer = setTimeout(
        () => void pollForLogin(actionId),
        LOGIN_POLL_INTERVAL_MS,
      );
    } catch (error) {
      finishLogin(actionId, failureState(error));
    }
  };

  return {
    auth: null,
    status: "unknown",
    isConnecting: false,
    error: null,

    checkAuth: async () => {
      const actionId = beginAction();
      if (!isTauriRuntime()) {
        set({
          auth: null,
          status: "unavailable",
          isConnecting: false,
          error: AUTH_DESKTOP_REQUIRED_MESSAGE,
        });
        return;
      }

      set({
        auth: null,
        status: "checking",
        isConnecting: false,
        error: null,
      });

      try {
        const auth = await authCommands.getAuthState();
        if (!isCurrentAction(actionId)) {
          return;
        }
        if (auth === null) {
          set({
            auth: null,
            status: "signed_out",
            isConnecting: false,
            error: null,
          });
          return;
        }
        if (isValidAuth(auth)) {
          set({
            auth,
            status: "signed_in",
            isConnecting: false,
            error: null,
          });
          return;
        }

        const refreshed = await authCommands.refreshAuthToken();
        if (!isCurrentAction(actionId)) {
          return;
        }
        if (!isValidAuth(refreshed)) {
          set({
            auth: null,
            status: "error",
            isConnecting: false,
            error: "Roblox returned an expired authentication session.",
          });
          return;
        }
        set({
          auth: refreshed,
          status: "signed_in",
          isConnecting: false,
          error: null,
        });
      } catch (error) {
        if (isCurrentAction(actionId)) {
          set(failureState(error));
        }
      }
    },

    startLogin: async () => {
      const previousStatus = get().status;
      const previousError = get().error;
      const actionId = beginAction();
      if (!isTauriRuntime() || previousStatus === "unavailable") {
        set({
          auth: null,
          status: "unavailable",
          isConnecting: false,
          error: unavailableMessage(undefined, previousError),
        });
        return;
      }

      set({
        auth: null,
        status: "checking",
        isConnecting: true,
        error: null,
      });

      try {
        await authCommands.startOauthFlow();
        if (!isCurrentAction(actionId)) {
          return;
        }

        loginTimeoutTimer = setTimeout(() => {
          finishLogin(actionId, {
            auth: null,
            status: "error",
            isConnecting: false,
            error: "Login timed out",
          });
        }, LOGIN_TIMEOUT_MS);
        loginPollTimer = setTimeout(
          () => void pollForLogin(actionId),
          LOGIN_POLL_INTERVAL_MS,
        );
      } catch (error) {
        finishLogin(actionId, failureState(error));
      }
    },

    logout: async () => {
      const previousStatus = get().status;
      const previousError = get().error;
      const previousAuth = get().auth;
      const actionId = beginAction();
      if (!isTauriRuntime() || previousStatus === "unavailable") {
        set({
          auth: null,
          status: "unavailable",
          isConnecting: false,
          error: unavailableMessage(undefined, previousError),
        });
        return;
      }

      set({ status: "checking", isConnecting: false, error: null });
      try {
        await authCommands.logout();
        if (isCurrentAction(actionId)) {
          set({
            auth: null,
            status: "signed_out",
            isConnecting: false,
            error: null,
          });
        }
      } catch (error) {
        if (isCurrentAction(actionId)) {
          if (isOperationUnavailableError(error)) {
            set(failureState(error));
          } else if (
            previousStatus === "signed_in" &&
            isValidAuth(previousAuth)
          ) {
            set({
              auth: previousAuth,
              status: "signed_in",
              isConnecting: false,
              error: errorMessage(error),
            });
          } else {
            set(failureState(error));
          }
        }
      }
    },
  };
});
