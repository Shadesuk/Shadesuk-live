import { createHmac } from "node:crypto";
import { isGuestCartSessionId } from "@/contracts";

/**
 * Guest cart-lines and checkout-draft cookies are HMAC-signed with a server
 * secret and bound to the httpOnly session id. The session id is never the
 * HMAC key (PR #15 Medium) and is never stored in the cookie payload.
 */
export const GUEST_COOKIE_HMAC_VERSION = "v2";

const LOCAL_DEV_FALLBACK = "shadesuk-local-guest-cookie-dev";

export type GuestCookieSecretInput = {
  guestCookieSecret?: string | undefined;
  supabaseSecret?: string | undefined;
};

export function resolveGuestCookieSecret(input?: GuestCookieSecretInput): string {
  const guest = firstNonEmpty(
    input?.guestCookieSecret,
    process.env.GUEST_COOKIE_SECRET,
  );
  if (guest) {
    return guest;
  }
  const supabase = firstNonEmpty(
    input?.supabaseSecret,
    process.env.SUPABASE_SECRET_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  if (supabase) {
    return supabase;
  }
  return LOCAL_DEV_FALLBACK;
}

export function signGuestCookiePayload(
  sessionId: string,
  body: string,
  secret: string = resolveGuestCookieSecret(),
): string {
  if (!isGuestCartSessionId(sessionId) || !secret) {
    return "";
  }
  return createHmac("sha256", secret).update(sessionId).update("\n").update(body).digest("hex");
}

export function guestCookieSignatureMatches(input: {
  sessionId: string;
  body: string;
  hmac: string;
  secret?: string;
}): boolean {
  const expected = signGuestCookiePayload(
    input.sessionId,
    input.body,
    input.secret ?? resolveGuestCookieSecret(),
  );
  if (!expected || !input.hmac) {
    return false;
  }
  return safeEqual(input.hmac, expected);
}

export function encodeGuestCookieValue(body: string, hmac: string): string {
  return `${GUEST_COOKIE_HMAC_VERSION}.${Buffer.from(body, "utf8").toString("base64url")}.${hmac}`;
}

export function decodeGuestCookieValue(value: string | undefined | null): {
  body: string;
  hmac: string;
} | null {
  if (!value) {
    return null;
  }
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== GUEST_COOKIE_HMAC_VERSION) {
    return null;
  }
  const [, encoded, hmac] = parts;
  if (!encoded || !hmac) {
    return null;
  }
  try {
    return { body: Buffer.from(encoded, "base64url").toString("utf8"), hmac };
  } catch {
    return null;
  }
}

export function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim() ?? "";
    if (trimmed) {
      return trimmed;
    }
  }
  return "";
}
