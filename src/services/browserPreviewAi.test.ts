import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PRIVATE_KEY = ["sk", "or", "v1", "private-browser-key"].join("-");
const UNSUPPORTED_KEY = ["sk", "ant", "private-key"].join("-");

async function subject() {
  return import("./browserPreviewAi");
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("browser preview AI", () => {
  it("validates an OpenRouter key before keeping it for the tab session", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { label: "RobloxForge" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const ai = await subject();

    await ai.saveBrowserAiKey(PRIVATE_KEY);

    expect(await ai.checkBrowserAiKey()).toBe("openrouter");
    expect(fetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/key",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: `Bearer ${PRIVATE_KEY}`,
        }),
      }),
    );
    expect(JSON.stringify({ ...localStorage })).not.toContain(PRIVATE_KEY);
  });

  it("rejects unsupported or invalid keys without retaining them", async () => {
    const ai = await subject();

    await expect(ai.saveBrowserAiKey(UNSUPPORTED_KEY)).rejects.toThrow(
      /OpenRouter/i,
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(await ai.checkBrowserAiKey()).toBeNull();

    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(ai.saveBrowserAiKey(PRIVATE_KEY)).rejects.toThrow(
      /did not accept/i,
    );
    expect(await ai.checkBrowserAiKey()).toBeNull();
  });

  it("returns a bounded chat-only response without leaking project paths", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "Build three readable stages." } }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    const ai = await subject();
    await ai.saveBrowserAiKey(PRIVATE_KEY);

    const response = await ai.sendBrowserAiMessage({
      message: "Help me improve the obby.",
      history: [],
      userLevel: "beginner",
      userName: "Steve",
    });

    expect(response).toEqual({
      message: "Build three readable stages.",
      changes: [],
    });
    const [, request] = vi.mocked(fetch).mock.calls[1];
    const body = String(request?.body);
    expect(body).toContain('"model":"openrouter/auto"');
    expect(body).not.toContain("browser-preview://");
    expect(body).not.toContain(PRIVATE_KEY);
  });

  it("redacts provider errors and never echoes the submitted key", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(
        new Response(`Rejected ${PRIVATE_KEY}`, { status: 403 }),
      );
    const ai = await subject();
    await ai.saveBrowserAiKey(PRIVATE_KEY);

    const failure = await ai
      .sendBrowserAiMessage({ message: "Hello", history: [] })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe(
      "OpenRouter rejected the request (403).",
    );
    expect((failure as Error).message).not.toContain(PRIVATE_KEY);
  });
});
