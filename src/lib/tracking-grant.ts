/**
 * Short-lived proof that this browser already passed guest reference + email
 * verification. The order reference is bound to the signed tracking-limiter
 * id. Email is never stored. A bad signature is not a database lookup.
 */

import { createHmac } from "node:crypto";
import { isOrderReference } from "@/contracts/order/reference";
import { safeEqual } from "@/lib/guest-cookie-hmac";
import { isTrackingLimiterId } from "@/lib/tracking-limiter";

export const TRACKING_GRANT_COOKIE_NAME = "shadesuk_track_ok";
export const TRACKING_GRANT_VERSION = "tg1";
export const TRACKING_GRANT_TTL_SECONDS = 15 * 60;

const GRANT_PURPOSE = "shadesuk-track-grant";

export type TrackingGrantResult =
  | { status: "valid"; orderReference: string }
  | { status: "expired" }
  | { status: "invalid" };

export function encodeTrackingGrant(input: {
  orderReference: string;
  limiterId: string;
  secret: string;
  now?: number;
}): string {
  if (!input.secret || !isOrderReference(input.orderReference) || !isTrackingLimiterId(input.limiterId)) {
    return "";
  }
  const now = input.now ?? Date.now();
  const expiresAt = Math.floor(now / 1000) + TRACKING_GRANT_TTL_SECONDS;
  const hmac = signTrackingGrant({
    orderReference: input.orderReference,
    expiresAt,
    limiterId: input.limiterId,
    secret: input.secret,
  });
  if (!hmac) {
    return "";
  }
  return `${TRACKING_GRANT_VERSION}.${input.orderReference}.${expiresAt}.${hmac}`;
}

export function decodeTrackingGrant(input: {
  value: string | null | undefined;
  limiterId: string | null;
  secret: string;
  now?: number;
}): TrackingGrantResult {
  if (!input.value || !input.secret || !isTrackingLimiterId(input.limiterId)) {
    return { status: "invalid" };
  }
  const parts = input.value.split(".");
  if (parts.length !== 4 || parts[0] !== TRACKING_GRANT_VERSION) {
    return { status: "invalid" };
  }
  const [, orderReference, expiresRaw, hmac] = parts;
  if (!orderReference || !hmac || !isOrderReference(orderReference) || !/^\d+$/.test(expiresRaw ?? "")) {
    return { status: "invalid" };
  }
  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt)) {
    return { status: "invalid" };
  }
  const expected = signTrackingGrant({
    orderReference,
    expiresAt,
    limiterId: input.limiterId,
    secret: input.secret,
  });
  if (!expected || !safeEqual(hmac, expected)) {
    return { status: "invalid" };
  }
  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
  if (expiresAt > nowSeconds + TRACKING_GRANT_TTL_SECONDS + 60) {
    return { status: "invalid" };
  }
  if (nowSeconds >= expiresAt) {
    return { status: "expired" };
  }
  return { status: "valid", orderReference };
}

function signTrackingGrant(input: {
  orderReference: string;
  expiresAt: number;
  limiterId: string;
  secret: string;
}): string {
  if (!input.secret) {
    return "";
  }
  return createHmac("sha256", input.secret)
    .update(GRANT_PURPOSE)
    .update("\n")
    .update(input.orderReference)
    .update("\n")
    .update(String(input.expiresAt))
    .update("\n")
    .update(input.limiterId)
    .digest("hex");
}
