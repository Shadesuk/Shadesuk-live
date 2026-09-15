export type CartOriginInput = {
  origin: string | null;
  referer: string | null;
  host: string | null;
  siteUrl: string;
};

export function allowedCartOrigins(siteUrl: string): string[] {
  const origins = new Set<string>([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ]);
  const fromSite = parseOrigin(siteUrl);
  if (fromSite) {
    origins.add(fromSite);
  }
  return [...origins];
}

export function isAllowedCartActionOrigin(input: CartOriginInput): boolean {
  const origin = parseOrigin(input.origin) ?? originFromReferer(input.referer);
  if (!origin) {
    return false;
  }
  if (allowedCartOrigins(input.siteUrl).includes(origin)) {
    return true;
  }
  return matchesRequestHost(origin, input.host);
}

function parseOrigin(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function originFromReferer(referer: string | null): string | null {
  return parseOrigin(referer);
}

function matchesRequestHost(origin: string, hostHeader: string | null): boolean {
  if (!hostHeader) {
    return false;
  }
  try {
    const host = hostHeader.split(",")[0]?.trim();
    if (!host) {
      return false;
    }
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
