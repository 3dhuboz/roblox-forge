const KEYWORDS = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for",
  "function", "if", "in", "local", "nil", "not", "or", "repeat",
  "return", "then", "true", "until", "while", "continue", "type",
  "export", "typeof",
]);

const BUILTINS = new Set([
  "game", "workspace", "script", "print", "warn", "error", "require",
  "tostring", "tonumber", "typeof", "type", "pcall", "xpcall",
  "ipairs", "pairs", "next", "select", "unpack", "rawget", "rawset",
  "setmetatable", "getmetatable", "Instance", "Vector3", "Vector2",
  "CFrame", "Color3", "UDim2", "UDim", "Enum", "math", "string",
  "table", "task", "coroutine", "os", "tick", "wait", "spawn", "delay",
]);

const SERVICES = new Set([
  "Players", "Workspace", "ReplicatedStorage", "ServerScriptService",
  "ServerStorage", "StarterGui", "StarterPlayer", "StarterPlayerScripts",
  "Lighting", "SoundService", "TweenService", "RunService",
  "UserInputService", "CollectionService", "DataStoreService",
  "HttpService", "MarketplaceService", "TextService",
]);

type TokenType = "keyword" | "builtin" | "service" | "string" | "number" | "comment" | "method" | "property" | "plain";

interface Token {
  type: TokenType;
  text: string;
}

export function tokenizeLuau(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < line.length) {
    // Comments: -- to end of line
    if (line[i] === "-" && line[i + 1] === "-") {
      tokens.push({ type: "comment", text: line.slice(i) });
      return tokens;
    }

    // Strings: "..." or '...'
    if (line[i] === '"' || line[i] === "'") {
      const quote = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === "\\") j++;
        j++;
      }
      tokens.push({ type: "string", text: line.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(line[i]) && (i === 0 || /[\s(,=+\-*/<>~[{]/.test(line[i - 1]))) {
      let j = i;
      while (j < line.length && /[0-9.xXa-fA-F_]/.test(line[j])) j++;
      tokens.push({ type: "number", text: line.slice(i, j) });
      i = j;
      continue;
    }

    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
      const word = line.slice(i, j);

      // Check if followed by : (method call) — look ahead past spaces
      const afterWord = line.slice(j).trimStart();
      if (afterWord.startsWith("(")) {
        // function call — could be a builtin
        if (BUILTINS.has(word)) {
          tokens.push({ type: "builtin", text: word });
        } else {
          tokens.push({ type: "method", text: word });
        }
      } else if (KEYWORDS.has(word)) {
        tokens.push({ type: "keyword", text: word });
      } else if (BUILTINS.has(word)) {
        tokens.push({ type: "builtin", text: word });
      } else if (SERVICES.has(word)) {
        tokens.push({ type: "service", text: word });
      } else {
        // Check if preceded by : or . for method/property coloring
        const lastToken = tokens[tokens.length - 1];
        if (lastToken && (lastToken.text === ":" || lastToken.text === ".")) {
          tokens.push({ type: "property", text: word });
        } else {
          tokens.push({ type: "plain", text: word });
        }
      }
      i = j;
      continue;
    }

    // Everything else (operators, punctuation, whitespace)
    tokens.push({ type: "plain", text: line[i] });
    i++;
  }

  return tokens;
}

const TOKEN_CLASSES: Record<TokenType, string> = {
  keyword: "text-purple-400",
  builtin: "text-cyan-300",
  service: "text-yellow-300",
  string: "text-green-400",
  number: "text-orange-300",
  comment: "text-gray-500 italic",
  method: "text-blue-300",
  property: "text-blue-200",
  plain: "text-gray-200",
};

export function getTokenClass(type: TokenType): string {
  return TOKEN_CLASSES[type] || "text-gray-200";
}
