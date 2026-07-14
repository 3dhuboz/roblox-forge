import { describe, expect, it, vi } from "vitest";
import { EXAMPLE_MARKET_RADAR_SNAPSHOT } from "../intelligence/marketRadarExample";
import { requestMarketRadarSnapshot } from "./marketRadarClient";

describe("Market Radar client", () => {
  it("performs no network request without an explicit authority", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(requestMarketRadarSnapshot()).resolves.toMatchObject({
      kind: "unavailable",
      reason: "authority_not_supplied",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("performs no network request without both an endpoint and token provider", async () => {
    const fetcher = vi.fn();

    await expect(
      requestMarketRadarSnapshot({
        endpoint: "",
        getToken: async () => "private-token",
        fetcher,
      }),
    ).resolves.toMatchObject({ kind: "unavailable" });
    await expect(
      requestMarketRadarSnapshot({
        endpoint: "https://radar.example.test/v1/radar/latest",
        getToken: async () => null,
        fetcher,
      }),
    ).resolves.toMatchObject({
      kind: "unavailable",
      reason: "token_unavailable",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns a validated snapshot only after explicit authenticated fetch", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(EXAMPLE_MARKET_RADAR_SNAPSHOT), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await requestMarketRadarSnapshot({
      endpoint: "https://radar.example.test/v1/radar/latest",
      getToken: async () => "private-token",
      fetcher,
    });

    expect(result).toEqual({
      kind: "ready",
      snapshot: EXAMPLE_MARKET_RADAR_SNAPSHOT,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://radar.example.test/v1/radar/latest",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer private-token",
        }),
      }),
    );
  });

  it("fails closed for empty, malformed, unauthorized, and network responses", async () => {
    const request = (response: Response | Error) =>
      requestMarketRadarSnapshot({
        endpoint: "https://radar.example.test/v1/radar/latest",
        getToken: async () => "private-token",
        fetcher: vi
          .fn()
          .mockImplementation(() =>
            response instanceof Error
              ? Promise.reject(response)
              : Promise.resolve(response),
          ),
      });

    await expect(request(new Response(null, { status: 204 }))).resolves.toMatchObject(
      { kind: "empty" },
    );
    await expect(
      request(
        new Response(JSON.stringify({ ...EXAMPLE_MARKET_RADAR_SNAPSHOT, extra: true }), {
          status: 200,
        }),
      ),
    ).resolves.toMatchObject({ kind: "malformed" });
    await expect(request(new Response(null, { status: 401 }))).resolves.toMatchObject(
      { kind: "unavailable", reason: "unauthorized" },
    );
    await expect(request(new Error("offline"))).resolves.toMatchObject({
      kind: "error",
    });
  });
});
