import { create } from "zustand";
import type { ChatMessage, AiChange } from "../types/ai";
import { aiCommands } from "../services/tauriCommands";
import { useProjectStore } from "./projectStore";
import { useUserStore } from "./userStore";
import { useCanvasStore } from "./canvasStore";

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

      // Execute AI changes against the canvas — actually modify the game
      if (response.changes.length > 0) {
        executeAiChanges(response.changes);
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

/** Execute AI change objects by actually modifying the canvas store. */
function executeAiChanges(changes: AiChange[]) {
  const canvas = useCanvasStore.getState();
  for (const change of changes) {
    if (!change.elementData) continue;
    const ed = change.elementData;
    if (change.type === "add_part" || change.type === "add_stage") {
      const item = {
        type: ed.type,
        category: ed.category as import("./canvasStore").ElementCategory,
        label: ed.label,
        icon: ed.icon,
        defaultWidth: ed.width,
        defaultHeight: ed.height,
        color: ed.color,
        description: "",
      };
      canvas.addElement(item, ed.x, ed.y);
    }
  }
}
