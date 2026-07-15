import type { AiResponse, ChatMessage } from "../types/ai";

const SESSION_KEY = "robloxforge.browser-ai.openrouter-key.v1";
const OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/key";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_MESSAGE_LENGTH = 8_000;
const MAX_HISTORY_MESSAGES = 20;
const REQUEST_TIMEOUT_MS = 45_000;

type OpenRouterChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

export interface BrowserAiMessageInput {
  readonly message: string;
  readonly history: readonly ChatMessage[];
  readonly userLevel?: string;
  readonly userName?: string;
}

function normalizeOpenRouterKey(value: string): string {
  const key = value.trim();
  if (!/^sk-or-[a-z0-9_-]{12,}$/i.test(key)) {
    throw new Error(
      "Browser AI currently supports OpenRouter keys beginning with sk-or-. Anthropic keys remain available in RobloxForge Desktop.",
    );
  }
  return key;
}

function readSessionKey(): string | null {
  try {
    const value = sessionStorage.getItem(SESSION_KEY);
    return value && /^sk-or-[a-z0-9_-]{12,}$/i.test(value) ? value : null;
  } catch {
    return null;
  }
}

function clearSessionKey(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // A failed browser storage write is reported when a key is saved.
  }
}

async function requestWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function safeText(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  return trimmed
    ? [...trimmed].slice(0, MAX_MESSAGE_LENGTH).join("")
    : fallback;
}

function systemPrompt(input: BrowserAiMessageInput): string {
  const name = safeText(input.userName, "Builder").slice(0, 80);
  const level = safeText(input.userLevel, "beginner").slice(0, 40);
  return [
    "You are RobloxForge's browser game-building assistant.",
    `Help ${name}, a ${level} Roblox creator, turn a game idea into clear gameplay loops, progression, level structure, safe monetization, and practical Luau guidance.`,
    "This browser session is advisory only. Never claim that you created, saved, published, or changed project files.",
    "Give concise, actionable steps and ask one focused question when essential information is missing.",
  ].join(" ");
}

export async function saveBrowserAiKey(apiKey: string): Promise<void> {
  const key = normalizeOpenRouterKey(apiKey);
  clearSessionKey();

  let response: Response;
  try {
    response = await requestWithTimeout(OPENROUTER_KEY_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    });
  } catch {
    throw new Error("Could not reach OpenRouter to validate the key.");
  }

  if (!response.ok) {
    throw new Error(`OpenRouter did not accept this key (${response.status}).`);
  }

  try {
    sessionStorage.setItem(SESSION_KEY, key);
  } catch {
    throw new Error(
      "This browser blocked session storage, so RobloxForge could not retain the OpenRouter key.",
    );
  }
}

export async function checkBrowserAiKey(): Promise<string | null> {
  return readSessionKey() ? "openrouter" : null;
}

export async function sendBrowserAiMessage(
  input: BrowserAiMessageInput,
): Promise<AiResponse> {
  const key = readSessionKey();
  if (!key) {
    throw new Error(
      "OpenRouter is not connected for this browser tab. Add a key in Settings.",
    );
  }

  const currentMessage = safeText(
    input.message,
    "Help me plan my Roblox game.",
  );
  const history = input.history.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
    role: message.role,
    content: safeText(message.content, "(empty message)"),
  }));

  let response: Response;
  try {
    response = await requestWithTimeout(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-OpenRouter-Title": "RobloxForge",
      },
      body: JSON.stringify({
        model: "openrouter/auto",
        max_tokens: 2_048,
        messages: [
          { role: "system", content: systemPrompt(input) },
          ...history,
          { role: "user", content: currentMessage },
        ],
      }),
    });
  } catch {
    throw new Error(
      "Could not reach OpenRouter. Check the connection and retry.",
    );
  }

  if (!response.ok) {
    throw new Error(`OpenRouter rejected the request (${response.status}).`);
  }

  let payload: OpenRouterChatResponse;
  try {
    payload = (await response.json()) as OpenRouterChatResponse;
  } catch {
    throw new Error("OpenRouter returned an unreadable response.");
  }
  const message = payload.choices
    ?.map((choice) => choice.message?.content?.trim() ?? "")
    .filter(Boolean)
    .join("");
  if (!message) {
    throw new Error("OpenRouter returned an empty response.");
  }

  return { message, changes: [] };
}
