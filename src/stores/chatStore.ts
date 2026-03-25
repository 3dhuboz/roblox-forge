import { create } from "zustand";
import type { ChatMessage } from "../types/ai";
import { aiCommands } from "../services/tauriCommands";
import { useProjectStore } from "./projectStore";
import { useUserStore } from "./userStore";

interface ChatStore {
  messages: ChatMessage[];
  isThinking: boolean;
  error: string | null;

  sendMessage: (projectPath: string, content: string) => Promise<void>;
  clearChat: () => void;
}

let messageCounter = 0;

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isThinking: false,
  error: null,

  sendMessage: async (projectPath, content) => {
    const userMessage: ChatMessage = {
      id: `msg-${++messageCounter}`,
      role: "user",
      content,
      timestamp: Date.now(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isThinking: true,
      error: null,
    }));

    try {
      const history = get().messages;
      const { profile } = useUserStore.getState();
      const response = await aiCommands.sendChatMessage(
        projectPath,
        content,
        history,
        profile.experienceLevel,
        profile.displayName,
      );

      const assistantMessage: ChatMessage = {
        id: `msg-${++messageCounter}`,
        role: "assistant",
        content: response.message,
        timestamp: Date.now(),
        changes: response.changes,
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
      }));

      // Refresh project state after AI makes changes
      if (response.changes.length > 0) {
        await useProjectStore.getState().refreshProjectState();
      }
    } catch (e) {
      set({ error: String(e) });
    } finally {
      set({ isThinking: false });
    }
  },

  clearChat: () => {
    set({ messages: [], error: null });
    messageCounter = 0;
  },
}));
