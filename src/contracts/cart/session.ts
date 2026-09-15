/**
 * Guest cart session contract (Phase 3.3).
 *
 * PR #10: `carts.session_id` XOR `carts.user_id`; RLS is authenticated-only.
 * Anon has no SELECT/INSERT/UPDATE on carts. Do not open anon RLS writes.
 *
 * Persistence is server-mediated: httpOnly cookie → Route Handler / Server
 * Action → service-role (or a SECURITY DEFINER RPC) scoped to that session_id.
 * Cookie value is the session_id, not the cart UUID.
 *
 * Routes are 3.6. This module is the importable contract.
 */

export const GUEST_CART_COOKIE_NAME = "shadesuk_guest_cart";

export const GUEST_CART_SESSION_ID_PATTERN = /^[0-9a-f]{64}$/;

export const GUEST_CART_COOKIE = {
  name: GUEST_CART_COOKIE_NAME,
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  /** Seconds. 30 days. */
  maxAgeSeconds: 60 * 60 * 24 * 30,
} as const;

export type GuestCartCookieSetOptions = {
  name: typeof GUEST_CART_COOKIE_NAME;
  value: string;
  httpOnly: true;
  path: "/";
  sameSite: "lax";
  secure: boolean;
  maxAge: number;
};

export function createGuestCartSessionId(
  randomBytes: (size: number) => Uint8Array = defaultRandomBytes,
): string {
  return toHex(randomBytes(32));
}

export function isGuestCartSessionId(value: string | undefined | null): value is string {
  return typeof value === "string" && GUEST_CART_SESSION_ID_PATTERN.test(value);
}

export function guestCartCookieSetOptions(
  sessionId: string,
  options?: { secure?: boolean },
): GuestCartCookieSetOptions {
  if (!isGuestCartSessionId(sessionId)) {
    throw new Error("Invalid guest cart session id.");
  }
  return {
    name: GUEST_CART_COOKIE_NAME,
    value: sessionId,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: options?.secure ?? true,
    maxAge: GUEST_CART_COOKIE.maxAgeSeconds,
  };
}

/**
 * How a request is bound to a cart. Never accept cart UUID or session_id
 * from the client body as proof of ownership.
 */
export type CartOwner =
  | { kind: "guest"; sessionId: string }
  | { kind: "account"; userId: string };

export const CART_MEDIATION_RULES = {
  anonRlsWrites: false,
  clientMustNotSendSessionId: true,
  serviceRoleOnlyForGuestWrites: true,
  unauthenticatedHandlersMustNotReturnAdminRows: true,
} as const;

function defaultRandomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
