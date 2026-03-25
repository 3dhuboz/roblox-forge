import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { useChatStore } from "../../stores/chatStore";
import { useUserStore } from "../../stores/userStore";
import { SmartSuggestions } from "./SmartSuggestions";
import type { ChatMessage } from "../../types/ai";

interface ChatPanelProps {
  projectPath: string;
}

export function ChatPanel({ projectPath }: ChatPanelProps) {
  const { messages, isThinking, sendMessage, error } = useChatStore();
  const { profile } = useUserStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;
    const msg = input;
    setInput("");
    await sendMessage(projectPath, msg);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-500">
            <Sparkles size={40} className="text-indigo-500" />
            <p className="text-center text-lg font-medium text-gray-300">
              {profile.experienceLevel === "beginner"
                ? `Hey ${profile.displayName || "there"}! Tell me what kind of game you want!`
                : profile.experienceLevel === "advanced"
                  ? "Describe your game or give specific instructions."
                  : "What do you want to build? I'll help you out."}
            </p>
            <p className="text-center text-sm">
              {profile.experienceLevel === "beginner"
                ? "Just describe it in your own words — I'll handle the rest."
                : "Describe what you want or use the suggestions below."}
            </p>
            <div className="mt-2 w-full">
              <SmartSuggestions onSelect={setInput} messageCount={0} />
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isThinking && (
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600">
              <Sparkles size={14} />
            </div>
            <div className="rounded-xl bg-gray-800 px-4 py-3">
              <Loader2 size={16} className="animate-spin text-gray-400" />
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Smart suggestions (shown after messages exist) */}
      {messages.length > 0 && !isThinking && (
        <SmartSuggestions
          onSelect={setInput}
          messageCount={messages.length}
        />
      )}

      {/* Input */}
      <div className="border-t border-gray-800 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Describe what you want to add or change..."
            disabled={isThinking}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`mb-4 flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-gray-700" : "bg-indigo-600"
        }`}
      >
        {isUser ? "Y" : <Sparkles size={14} />}
      </div>
      <div className={`max-w-[80%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-indigo-600 text-white"
              : "bg-gray-800 text-gray-200"
          }`}
        >
          {message.content}
        </div>

        {message.changes && message.changes.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.changes.map((change, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 text-xs text-gray-500"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                {change.description}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
