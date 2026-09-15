/**
 * Signed httpOnly identity for guest-tracking rate limits.
 * Independent of x-forwarded-for. Never serialise this id to the browser.
 * Production HMAC uses the same fail-closed secret as guest cart cookies.
 */

import { createHmac, randomBytes } from "node:crypto";
import { safeEqual } from "@/lib/guest-cookie-hmac";

export const TRACKING_LIMITER_COOKIE_NAME = "shadesuk_track_rl";
export const TRACKING_LIMITER_COOKIE_VERSION = "trl1";
export const TRACKING_LIMITER_ID_PATTERN = /^[0-9a-f]{64}$/;
export const TRACKING_LIMITER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

export function createTrackingLimiterId(
  entropy: (size: number) => Uint8Array = defaultEntropy,
): string {
  return toHex(entropy(32));
}

export function isTrackingLimiterId(value: string | undefined | null): value is string {
  return typeof value === "string" && TRACKING_LIMITER_ID_PATTERN.test(value);
}

export function signTrackingLimiterId(id: string, secret: string): string {
  if (!isTrackingLimiterId(id) || !secret) {
    return "";
  }
  return createHmac("sha256", secret).update("shadesuk-track-rl\n").update(id).digest("hex");
}

export function encodeTrackingLimiterCookie(id: string, secret: string): string {
  const hmac = signTrackingLimiterId(id, secret);
  if (!hmac) {
    return "";
  }
  return `${TRACKING_LIMITER_COOKIE_VERSION}.${id}.${hmac}`;
}

export function decodeTrackingLimiterCookie(
  value: string | undefined | null,
  secret: string,
): string | null {
  if (!value || !secret) {
    return null;
  }
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== TRACKING_LIMITER_COOKIE_VERSION) {
    return null;
  }
  const [, id, hmac] = parts;
  if (!isTrackingLimiterId(id) || !hmac) {
    return null;
  }
  const expected = signTrackingLimiterId(id, secret);
  if (!expected || !safeEqual(hmac, expected)) {
    return null;
  }
  return id;
}

function defaultEntropy(size: number): Uint8Array {
  return randomBytes(size);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
