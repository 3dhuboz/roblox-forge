import { describe, expect, it, vi } from "vitest";

import {
  validatePublicUrl,
  validatePublicUrlHops,
  type PublicUrlResolver,
  type PublicUrlValidationResult,
  type ResolvedAddress,
} from "../../src/intelligence/publicUrlPolicy";

const PUBLIC_IPV4: readonly ResolvedAddress[] = [
  { address: "93.184.216.34", family: 4 },
];

function issueCodes(result: PublicUrlValidationResult): string[] {
  if (result.ok) {
    throw new Error(`Expected URL rejection, received ${result.target.url}`);
  }
  return result.issues.map((issue) => issue.code);
}

describe("public URL runtime policy", () => {
  it("canonicalizes an IDN HTTPS target and returns every resolved address", async () => {
    const resolver = vi.fn<PublicUrlResolver>(async () => [
      ...PUBLIC_IPV4,
      {
        address: "2606:2800:220:1:248:1893:25c8:1946",
        family: 6,
      },
    ]);

    const result = await validatePublicUrl(
      "HTTPS://BÜCHER.example.com:443/a/../public?q=1#not-sent",
      resolver,
    );

    expect(result).toEqual({
      ok: true,
      target: {
        url: "https://xn--bcher-kva.example.com/public?q=1",
        origin: "https://xn--bcher-kva.example.com",
        hostname: "xn--bcher-kva.example.com",
        addresses: [
          ...PUBLIC_IPV4,
          {
            address: "2606:2800:220:1:248:1893:25c8:1946",
            family: 6,
          },
        ],
      },
    });
    expect(resolver).toHaveBeenCalledOnce();
    expect(resolver).toHaveBeenCalledWith("xn--bcher-kva.example.com");
  });

  it.each([
    ["invalid URL", "not a URL", "invalid_url"],
    ["HTTP", "http://evidence.example.com/public", "https_required"],
    ["file", "file:///etc/passwd", "https_required"],
    ["userinfo", "https://user:password@evidence.example.com/", "credentials_forbidden"],
    ["localhost", "https://localhost/", "hostname_forbidden"],
    ["localhost subdomain", "https://api.localhost/", "hostname_forbidden"],
    ["single-label", "https://printer/", "hostname_forbidden"],
    ["internal suffix", "https://metadata.internal/", "hostname_forbidden"],
    ["local suffix", "https://metadata.local/", "hostname_forbidden"],
    ["IPv4 literal", "https://127.0.0.1/", "hostname_forbidden"],
    ["encoded IPv4 literal", "https://%31%32%37.0.0.1/", "hostname_forbidden"],
    ["IPv6 literal", "https://[::1]/", "hostname_forbidden"],
  ])("rejects %s before DNS resolution", async (_label, input, code) => {
    const resolver = vi.fn<PublicUrlResolver>(async () => PUBLIC_IPV4);

    const result = await validatePublicUrl(input, resolver);

    expect(issueCodes(result)).toContain(code);
    expect(resolver).not.toHaveBeenCalled();
  });

  it("rejects an empty DNS answer", async () => {
    const result = await validatePublicUrl("https://evidence.example.com/", async () => []);

    expect(issueCodes(result)).toContain("resolution_empty");
  });

  it.each<ResolvedAddress>([
    { address: "0.0.0.0", family: 4 },
    { address: "10.1.2.3", family: 4 },
    { address: "100.64.0.1", family: 4 },
    { address: "127.42.0.1", family: 4 },
    { address: "169.254.169.254", family: 4 },
    { address: "172.31.255.254", family: 4 },
    { address: "192.168.1.1", family: 4 },
    { address: "192.0.2.1", family: 4 },
    { address: "198.18.0.1", family: 4 },
    { address: "198.51.100.1", family: 4 },
    { address: "203.0.113.1", family: 4 },
    { address: "224.0.0.1", family: 4 },
    { address: "240.0.0.1", family: 4 },
    { address: "::", family: 6 },
    { address: "::1", family: 6 },
    { address: "fe80::1", family: 6 },
    { address: "fc00::1", family: 6 },
    { address: "fd12:3456:789a::1", family: 6 },
    { address: "2001::1", family: 6 },
    { address: "2001:db8::1", family: 6 },
    { address: "2002:c000:0204::1", family: 6 },
    { address: "3fff::1", family: 6 },
    { address: "ff02::1", family: 6 },
  ])("rejects non-public or reserved resolver address $address", async (address) => {
    const result = await validatePublicUrl(
      "https://evidence.example.com/",
      async () => [address],
    );

    expect(issueCodes(result)).toContain("address_not_public");
  });

  it("rejects the whole target when any resolved address is not public", async () => {
    const result = await validatePublicUrl(
      "https://evidence.example.com/",
      async () => [...PUBLIC_IPV4, { address: "10.0.0.1", family: 4 }],
    );

    expect(issueCodes(result)).toContain("address_not_public");
  });

  it("returns a structured issue for resolver errors and malformed address answers", async () => {
    const resolverFailure = await validatePublicUrl(
      "https://evidence.example.com/",
      async () => {
        throw new Error("DNS unavailable");
      },
    );
    const malformedAnswer = await validatePublicUrl(
      "https://evidence.example.com/",
      async () => [{ address: "999.1.1.1", family: 4 }],
    );

    expect(issueCodes(resolverFailure)).toContain("resolution_failed");
    expect(issueCodes(malformedAnswer)).toContain("resolution_address_invalid");
  });

  it("validates every fetch or redirect hop without caching DNS safety", async () => {
    let resolution = 0;
    const resolver = vi.fn<PublicUrlResolver>(async () => {
      resolution += 1;
      return resolution === 1
        ? PUBLIC_IPV4
        : [{ address: "169.254.169.254", family: 4 }];
    });

    const result = await validatePublicUrlHops(
      ["https://evidence.example.com/start", "https://evidence.example.com/redirect"],
      resolver,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("Expected the rebinding hop to be rejected");
    }
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "address_not_public", hopIndex: 1 }),
      ]),
    );
    expect(resolver).toHaveBeenCalledTimes(2);
  });
});
