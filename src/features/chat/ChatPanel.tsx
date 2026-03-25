import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles, CheckCircle } from "lucide-react";
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

  const displayName = profile.displayName || "there";

  return (
    <div className="flex h-full flex-col bg-gray-950">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-indigo-500/20">
              <Sparkles size={28} className="text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-white">
                Hey {displayName}! What should we build?
              </h2>
              <p className="mt-2 max-w-sm text-sm text-gray-400">
                Just tell me what you want in your game. I'll create all the code and parts for you!
              </p>
            </div>
            <div className="mt-3 w-full max-w-lg">
              <SmartSuggestions onSelect={setInput} messageCount={0} />
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} displayName={displayName} />
        ))}

        {isThinking && (
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
              <Sparkles size={16} className="text-white" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-gray-800/80 px-4 py-3">
              <Loader2 size={16} className="animate-spin text-indigo-400" />
              <span className="text-sm text-gray-400">Building your game...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">
            Something went wrong — {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions after messages */}
      {messages.length > 0 && !isThinking && (
        <SmartSuggestions onSelect={setInput} messageCount={messages.length} />
      )}

      {/* Input */}
      <div className="border-t border-gray-800/40 bg-gray-900/50 p-4">
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
            placeholder="Tell me what to add or change..."
            disabled={isThinking}
            className="flex-1 rounded-xl border border-gray-700/50 bg-gray-800/60 px-4 py-3 text-[15px] text-white placeholder-gray-500 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-500 hover:shadow-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, displayName }: { message: ChatMessage; displayName: string }) {
  const isUser = message.role === "user";

  return (
    <div className={`mb-5 flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
          isUser
            ? "bg-gray-700 text-gray-300"
            : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
        }`}
      >
        {isUser ? displayName.charAt(0).toUpperCase() : <Sparkles size={16} />}
      </div>

      <div className={`max-w-[85%] ${isUser ? "text-right" : ""}`}>
        {/* Message bubble */}
        <div
          className={`inline-block rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${
            isUser
              ? "rounded-tr-md bg-indigo-600 text-white"
              : "rounded-tl-md bg-gray-800/80 text-gray-100"
          }`}
        >
          {message.content}
        </div>

        {/* Changes made - shown as friendly cards */}
        {message.changes && message.changes.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.changes.map((change, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg bg-emerald-950/30 border border-emerald-900/30 px-3 py-2"
              >
                <CheckCircle size={14} className="shrink-0 text-emerald-400" />
                <span className="text-[13px] text-emerald-200">{change.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
