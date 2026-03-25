import { create } from "zustand";
import type { AuthState } from "../types/roblox";
import { authCommands } from "../services/tauriCommands";

interface AuthStore {
  auth: AuthState | null;
  isConnecting: boolean;
  error: string | null;

  checkAuth: () => Promise<void>;
  startLogin: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  auth: null,
  isConnecting: false,
  error: null,

  checkAuth: async () => {
    try {
      const auth = await authCommands.getAuthState();
      if (auth && auth.expiresAt > Date.now()) {
        set({ auth });
      } else if (auth) {
        const refreshed = await authCommands.refreshAuthToken();
        set({ auth: refreshed });
      }
    } catch {
      set({ auth: null });
    }
  },

  startLogin: async () => {
    set({ isConnecting: true, error: null });
    try {
      await authCommands.startOauthFlow();
      // The Rust backend opens the browser and handles the callback
      // We poll for auth state
      const pollInterval = setInterval(async () => {
        try {
          const auth = await authCommands.getAuthState();
          if (auth) {
            clearInterval(pollInterval);
            set({ auth, isConnecting: false });
          }
        } catch {
          // Still waiting
        }
      }, 1000);

      // Timeout after 2 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        set({ isConnecting: false, error: "Login timed out" });
      }, 120000);
    } catch (e) {
      set({ error: String(e), isConnecting: false });
    }
  },

  logout: async () => {
    try {
      await authCommands.logout();
      set({ auth: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));
