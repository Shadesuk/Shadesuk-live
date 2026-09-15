/**
 * Best-effort client address for in-app rate limits.
 *
 * Leftmost X-Forwarded-For is client-controlled and must not be the only key.
 * Platform headers are trusted only when the matching platform signal is present.
 */

export type AddressHeaderReader = {
  get(name: string): string | null;
};

export type AddressHeaderEnv = {
  vercel?: boolean;
};

const IPV4 =
  /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-f:.]+$/i;

export function clientAddressFromHeaders(
  headers: AddressHeaderReader,
  env: AddressHeaderEnv = { vercel: Boolean(process.env.VERCEL) },
): string | null {
  if (env.vercel) {
    const vercel = firstValidIp(headers.get("x-vercel-forwarded-for"));
    if (vercel) {
      return vercel;
    }
  }

  if (headers.get("cf-ray")) {
    const cloudflare = firstValidIp(headers.get("cf-connecting-ip"));
    if (cloudflare) {
      return cloudflare;
    }
  }

  const realIp = headers.get("x-real-ip");
  if (realIp && !realIp.includes(",")) {
    const parsed = firstValidIp(realIp);
    if (parsed) {
      return parsed;
    }
  }

  return lastValidIp(headers.get("x-forwarded-for"));
}

export function firstValidIp(value: string | null | undefined): string | null {
  return validIps(value)[0] ?? null;
}

export function lastValidIp(value: string | null | undefined): string | null {
  const ips = validIps(value);
  return ips[ips.length - 1] ?? null;
}

function validIps(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(isIpAddress);
}

export function isIpAddress(value: string): boolean {
  if (!value || value.length > 45) {
    return false;
  }
  if (IPV4.test(value)) {
    return true;
  }
  return value.includes(":") && IPV6.test(value);
}
