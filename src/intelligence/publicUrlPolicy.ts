export interface ResolvedAddress {
  readonly address: string;
  readonly family: 4 | 6;
}

export type PublicUrlResolver = (
  hostname: string,
) => Promise<readonly ResolvedAddress[]>;

export type PublicUrlIssueCode =
  | "invalid_url"
  | "https_required"
  | "credentials_forbidden"
  | "hostname_forbidden"
  | "resolution_failed"
  | "resolution_empty"
  | "resolution_address_invalid"
  | "address_not_public";

export interface PublicUrlIssue {
  readonly code: PublicUrlIssueCode;
  readonly message: string;
  readonly input: string;
  readonly hostname?: string;
  readonly address?: string;
  readonly hopIndex?: number;
}

export interface PublicUrlTarget {
  readonly url: string;
  readonly origin: string;
  readonly hostname: string;
  readonly addresses: readonly ResolvedAddress[];
}

export type PublicUrlValidationResult =
  | { readonly ok: true; readonly target: PublicUrlTarget }
  | { readonly ok: false; readonly issues: readonly PublicUrlIssue[] };

export type PublicUrlHopsValidationResult =
  | { readonly ok: true; readonly targets: readonly PublicUrlTarget[] }
  | { readonly ok: false; readonly issues: readonly PublicUrlIssue[] };

const INTERNAL_HOSTNAME_SUFFIXES = [
  ".corp",
  ".example",
  ".home",
  ".internal",
  ".invalid",
  ".lan",
  ".local",
  ".localdomain",
  ".localhost",
  ".onion",
  ".test",
] as const;

const IPV4_NON_PUBLIC_BLOCKS: readonly (readonly [number, number])[] = [
  [0x00000000, 8],
  [0x0a000000, 8],
  [0x64400000, 10],
  [0x7f000000, 8],
  [0xa9fe0000, 16],
  [0xac100000, 12],
  [0xc0000000, 24],
  [0xc0000200, 24],
  [0xc01fc400, 24],
  [0xc034c100, 24],
  [0xc0586300, 24],
  [0xc0a80000, 16],
  [0xc0af3000, 24],
  [0xc6120000, 15],
  [0xc6336400, 24],
  [0xcb007100, 24],
  [0xe0000000, 4],
  [0xf0000000, 4],
];

function issue(
  code: PublicUrlIssueCode,
  message: string,
  input: string,
  details: Pick<PublicUrlIssue, "hostname" | "address"> = {},
): PublicUrlValidationResult {
  return { ok: false, issues: [{ code, message, input, ...details }] };
}

function parseIpv4(address: string): readonly number[] | undefined {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) {
    return undefined;
  }

  const octets = address.split(".").map(Number);
  return octets.every((octet) => Number.isInteger(octet) && octet <= 255)
    ? octets
    : undefined;
}

function ipv4Number(octets: readonly number[]): number {
  return ((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256 + octets[3];
}

function isPublicIpv4(octets: readonly number[]): boolean {
  const value = ipv4Number(octets);
  return !IPV4_NON_PUBLIC_BLOCKS.some(([network, prefix]) => {
    const blockSize = 2 ** (32 - prefix);
    return Math.floor(value / blockSize) === Math.floor(network / blockSize);
  });
}

function parseIpv6(address: string): readonly number[] | undefined {
  const normalized = address.toLowerCase();
  if (normalized.includes(".") || !/^[0-9a-f:]+$/.test(normalized)) {
    return undefined;
  }

  const compressionParts = normalized.split("::");
  if (compressionParts.length > 2) {
    return undefined;
  }

  const left = compressionParts[0] === "" ? [] : compressionParts[0].split(":");
  const right =
    compressionParts.length === 1 || compressionParts[1] === ""
      ? []
      : compressionParts[1].split(":");
  const labels = [...left, ...right];
  if (
    labels.some((label) => !/^[0-9a-f]{1,4}$/.test(label)) ||
    (compressionParts.length === 1 && labels.length !== 8) ||
    (compressionParts.length === 2 && labels.length >= 8)
  ) {
    return undefined;
  }

  const zeroFill = compressionParts.length === 2 ? 8 - labels.length : 0;
  const hextets = [
    ...left.map((label) => Number.parseInt(label, 16)),
    ...Array.from({ length: zeroFill }, () => 0),
    ...right.map((label) => Number.parseInt(label, 16)),
  ];
  return hextets.length === 8 ? hextets : undefined;
}

function isPublicIpv6(hextets: readonly number[]): boolean {
  const first = hextets[0];
  const isGlobalUnicast = first >= 0x2000 && first <= 0x3fff;
  const isIetfProtocolAssignment =
    first === 0x2001 && (hextets[1] & 0xfe00) === 0;
  const isDocumentation = first === 0x2001 && hextets[1] === 0x0db8;
  const isSixToFour = first === 0x2002;
  const isExtendedDocumentation =
    first === 0x3fff && (hextets[1] & 0xf000) === 0;
  return (
    isGlobalUnicast &&
    !isIetfProtocolAssignment &&
    !isDocumentation &&
    !isSixToFour &&
    !isExtendedDocumentation
  );
}

function isIpLiteral(hostname: string): boolean {
  if (parseIpv4(hostname)) {
    return true;
  }
  const unbracketed = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  return Boolean(parseIpv6(unbracketed));
}

function isDnsHostname(hostname: string): boolean {
  if (hostname.length > 253 || hostname.includes(":") || isIpLiteral(hostname)) {
    return false;
  }

  const labels = hostname.split(".");
  if (labels.length < 2) {
    return false;
  }
  if (
    labels.some(
      (label) =>
        label.length === 0 ||
        label.length > 63 ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
    )
  ) {
    return false;
  }

  return !INTERNAL_HOSTNAME_SUFFIXES.some(
    (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix),
  );
}

function validateResolvedAddress(
  answer: ResolvedAddress,
  input: string,
  hostname: string,
): PublicUrlIssue | undefined {
  if (answer.family === 4) {
    const octets = parseIpv4(answer.address);
    if (!octets) {
      return {
        code: "resolution_address_invalid",
        message: "The resolver returned an invalid IPv4 address.",
        input,
        hostname,
        address: answer.address,
      };
    }
    if (!isPublicIpv4(octets)) {
      return {
        code: "address_not_public",
        message: "The resolver returned a non-public IPv4 address.",
        input,
        hostname,
        address: answer.address,
      };
    }
    return undefined;
  }

  if (answer.family === 6) {
    const hextets = parseIpv6(answer.address);
    if (!hextets) {
      return {
        code: "resolution_address_invalid",
        message: "The resolver returned an invalid IPv6 address.",
        input,
        hostname,
        address: answer.address,
      };
    }
    if (!isPublicIpv6(hextets)) {
      return {
        code: "address_not_public",
        message: "The resolver returned a non-public or reserved IPv6 address.",
        input,
        hostname,
        address: answer.address,
      };
    }
    return undefined;
  }

  return {
    code: "resolution_address_invalid",
    message: "The resolver returned an unsupported address family.",
    input,
    hostname,
    address: answer.address,
  };
}

export async function validatePublicUrl(
  input: string,
  resolver: PublicUrlResolver,
): Promise<PublicUrlValidationResult> {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return issue("invalid_url", "The target is not a valid absolute URL.", input);
  }

  if (parsed.protocol !== "https:") {
    return issue("https_required", "Only HTTPS public targets are allowed.", input);
  }
  if (parsed.username !== "" || parsed.password !== "") {
    return issue(
      "credentials_forbidden",
      "Credentials are forbidden in public target URLs.",
      input,
    );
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!isDnsHostname(hostname)) {
    return issue(
      "hostname_forbidden",
      "The target must use a public DNS hostname, not an IP literal or internal name.",
      input,
      { hostname },
    );
  }

  parsed.hostname = hostname;
  parsed.hash = "";

  let answers: readonly ResolvedAddress[];
  try {
    answers = await resolver(hostname);
  } catch {
    return issue(
      "resolution_failed",
      "The target hostname could not be resolved safely.",
      input,
      { hostname },
    );
  }

  if (answers.length === 0) {
    return issue(
      "resolution_empty",
      "The target hostname resolved to no addresses.",
      input,
      { hostname },
    );
  }

  const addressIssues = answers.flatMap((answer) => {
    const addressIssue = validateResolvedAddress(answer, input, hostname);
    return addressIssue ? [addressIssue] : [];
  });
  if (addressIssues.length > 0) {
    return { ok: false, issues: addressIssues };
  }

  return {
    ok: true,
    target: {
      url: parsed.href,
      origin: parsed.origin,
      hostname,
      addresses: answers.map((answer) => ({ ...answer })),
    },
  };
}

export async function validatePublicUrlHops(
  inputs: readonly string[],
  resolver: PublicUrlResolver,
): Promise<PublicUrlHopsValidationResult> {
  const targets: PublicUrlTarget[] = [];
  for (const [hopIndex, input] of inputs.entries()) {
    const result = await validatePublicUrl(input, resolver);
    if (!result.ok) {
      return {
        ok: false,
        issues: result.issues.map((urlIssue) => ({ ...urlIssue, hopIndex })),
      };
    }
    targets.push(result.target);
  }
  return { ok: true, targets };
}
