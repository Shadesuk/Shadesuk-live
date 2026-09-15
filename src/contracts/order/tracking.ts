import { createHash, timingSafeEqual } from "node:crypto";
import { isOrderReference, parseOrderReferenceInput } from "./reference";

/**
 * Guest tracking verification (handoff §64, account_order_tracking.md §11).
 *
 * Request shape matches the locked form: order reference + email.
 * Routes are 3.13. Lookup is server-side with service-role after this check.
 * Anon must never SELECT orders by reference alone.
 *
 * Forbidden: GET /order/12345 or GET /order/{guessable} without verification.
 */

export const GUEST_TRACKING_FORM_FIELDS = ["orderReference", "email"] as const;

export type GuestTrackingRequest = {
  orderReference: string;
  email: string;
};

export type GuestTrackingFailureCode =
  | "invalid_input"
  | "not_found"
  | "rate_limited";

/**
 * Same customer copy for unknown reference, wrong email, and malformed input
 * after parse, so the form cannot be used as an existence oracle.
 */
export const GUEST_TRACKING_GENERIC_ERROR =
  "We couldn't find an order with those details.";

export type GuestTrackingLookup =
  | { ok: true; orderReference: string; email: string }
  | { ok: false; code: GuestTrackingFailureCode; message: string };

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailsMatch(left: string, right: string): boolean {
  const a = emailFingerprint(normalizeEmail(left));
  const b = emailFingerprint(normalizeEmail(right));
  return timingSafeEqual(a, b);
}

export function parseGuestTrackingRequest(
  input: Partial<GuestTrackingRequest> | Record<string, unknown>,
): GuestTrackingLookup {
  const orderReference = parseOrderReferenceInput(
    readString(input, "orderReference") ?? readString(input, "order_reference"),
  );
  const emailRaw = readString(input, "email");
  const email = emailRaw ? normalizeEmail(emailRaw) : "";

  if (!orderReference || !email || !email.includes("@")) {
    return {
      ok: false,
      code: "invalid_input",
      message: GUEST_TRACKING_GENERIC_ERROR,
    };
  }

  return { ok: true, orderReference, email };
}

export function verifyGuestTrackingEmail(input: {
  requestEmail: string;
  orderEmail: string;
}): boolean {
  return emailsMatch(input.requestEmail, input.orderEmail);
}

export function guestTrackingVerified(input: {
  orderReference: string;
  requestEmail: string;
  orderEmail: string;
}): boolean {
  if (!isOrderReference(input.orderReference)) {
    return false;
  }
  return verifyGuestTrackingEmail({
    requestEmail: input.requestEmail,
    orderEmail: input.orderEmail,
  });
}

function emailFingerprint(email: string): Buffer {
  return createHash("sha256").update(email).digest();
}

function readString(
  input: Partial<GuestTrackingRequest> | Record<string, unknown>,
  key: string,
): string | undefined {
  const value = input[key as keyof typeof input];
  return typeof value === "string" ? value : undefined;
}

/** 3.13 must rate-limit before lookup. Not implemented in 3.3. */
export const GUEST_TRACKING_RATE_LIMIT = {
  windowSeconds: 15 * 60,
  maxAttempts: 5,
  key: "ip+orderReference",
} as const;
