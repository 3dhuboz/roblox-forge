import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as browserAi from "../services/browserPreviewAi";
import { aiCommands } from "../services/tauriCommands";
import { useProjectStore } from "./projectStore";
import { useChatStore } from "./chatStore";

const originalProjectState = useProjectStore.getState();

beforeEach(() => {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown })
    .__TAURI_INTERNALS__;
  useChatStore.setState({ messages: [], isThinking: false, error: null });
  useProjectStore.setState(originalProjectState, true);
  vi.spyOn(browserAi, "sendBrowserAiMessage").mockResolvedValue({
    message: "Add a checkpoint after each stage.",
    changes: [],
  });
  vi.spyOn(aiCommands, "sendChatMessage");
});

afterEach(() => {
  useChatStore.setState({ messages: [], isThinking: false, error: null });
  useProjectStore.setState(originalProjectState, true);
  vi.restoreAllMocks();
});

describe("chatStore browser preview AI", () => {
  it("uses real chat-only browser AI without claiming project changes", async () => {
    const refreshProjectState = vi.fn();
    useProjectStore.setState({ refreshProjectState });

    await useChatStore
      .getState()
      .sendMessage("browser-preview://My_Obby", "Improve my checkpoints");

    expect(browserAi.sendBrowserAiMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Improve my checkpoints",
      }),
    );
    expect(aiCommands.sendChatMessage).not.toHaveBeenCalled();
    expect(refreshProjectState).not.toHaveBeenCalled();
    const messages = useChatStore.getState().messages;
    expect(messages[messages.length - 1]).toMatchObject({
      role: "assistant",
      content: "Add a checkpoint after each stage.",
      changes: [],
    });
    expect(useChatStore.getState().error).toBeNull();
  });
});
