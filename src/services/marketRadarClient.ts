import {
  validateMarketRadarSnapshot,
  type MarketRadarSnapshot,
} from "../intelligence/marketRadar";

export type MarketRadarFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface MarketRadarAuthority {
  readonly endpoint: string;
  readonly getToken: () => Promise<string | null>;
  readonly fetcher?: MarketRadarFetch;
}

export type MarketRadarClientResult =
  | { readonly kind: "ready"; readonly snapshot: MarketRadarSnapshot }
  | { readonly kind: "empty" }
  | {
      readonly kind: "unavailable";
      readonly reason:
        | "authority_not_supplied"
        | "endpoint_invalid"
        | "token_unavailable"
        | "unauthorized";
      readonly message: string;
    }
  | { readonly kind: "malformed"; readonly message: string }
  | { readonly kind: "error"; readonly message: string };

function validatedEndpoint(endpoint: string): string | null {
  try {
    const url = new URL(endpoint);
    if (
      url.protocol !== "https:" ||
      url.username !== "" ||
      url.password !== ""
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export async function requestMarketRadarSnapshot(
  authority?: MarketRadarAuthority,
): Promise<MarketRadarClientResult> {
  if (!authority) {
    return {
      kind: "unavailable",
      reason: "authority_not_supplied",
      message: "No live Market Radar authority is configured.",
    };
  }

  const endpoint = validatedEndpoint(authority.endpoint.trim());
  if (!endpoint) {
    return {
      kind: "unavailable",
      reason: "endpoint_invalid",
      message: "The Market Radar authority endpoint is not configured safely.",
    };
  }

  let token: string | null;
  try {
    token = await authority.getToken();
  } catch {
    token = null;
  }
  if (!token?.trim()) {
    return {
      kind: "unavailable",
      reason: "token_unavailable",
      message: "A private-alpha session token is required for live radar data.",
    };
  }

  const fetcher = authority.fetcher ?? globalThis.fetch.bind(globalThis);
  try {
    const response = await fetcher(endpoint, {
      method: "GET",
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token.trim()}`,
      },
    });
    if (response.status === 204) return { kind: "empty" };
    if (response.status === 401 || response.status === 403) {
      return {
        kind: "unavailable",
        reason: "unauthorized",
        message: "The private-alpha Market Radar session is not authorized.",
      };
    }
    if (!response.ok) {
      return {
        kind: "error",
        message: `Market Radar authority returned ${response.status}.`,
      };
    }

    let candidate: unknown;
    try {
      candidate = await response.json();
    } catch {
      return {
        kind: "malformed",
        message: "Market Radar authority returned invalid JSON.",
      };
    }
    if (candidate === null) return { kind: "empty" };
    if (!validateMarketRadarSnapshot(candidate)) {
      return {
        kind: "malformed",
        message: "Market Radar authority response failed the closed radar contract.",
      };
    }
    return { kind: "ready", snapshot: candidate };
  } catch {
    return {
      kind: "error",
      message: "The live Market Radar authority could not be reached.",
    };
  }
}
