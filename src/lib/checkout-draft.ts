import { createHmac } from "node:crypto";
import { hasForbiddenOwnershipKey } from "@/lib/ownership-keys";
import {
  CHECKOUT_COUNTRY_GB,
  CHECKOUT_STEP_IDS,
  emptyCheckoutDraft,
  type CheckoutAddressEntry,
  type CheckoutStepId,
  type PublicCheckoutDraft,
} from "@/types/checkout";

export const CHECKOUT_DRAFT_COOKIE = "shadesuk_guest_checkout";
export const CHECKOUT_DRAFT_TTL_SECONDS = 60 * 60 * 24;
export const CHECKOUT_DRAFT_TTL_MS = CHECKOUT_DRAFT_TTL_SECONDS * 1000;

type CheckoutDraftPayload = {
  step: CheckoutStepId;
  email: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
  addressEntry: CheckoutAddressEntry;
  updatedAt: number;
};

export function encodeCheckoutDraftCookie(
  sessionId: string,
  draft: PublicCheckoutDraft,
  now = Date.now(),
): string {
  const payload: CheckoutDraftPayload = {
    step: draft.step,
    email: draft.email,
    firstName: draft.firstName,
    lastName: draft.lastName,
    line1: draft.line1,
    line2: draft.line2,
    city: draft.city,
    county: draft.county,
    postcode: draft.postcode,
    country: draft.country || CHECKOUT_COUNTRY_GB,
    addressEntry: draft.addressEntry,
    updatedAt: now,
  };
  const body = JSON.stringify(payload);
  const hmac = sign(sessionId, body);
  return `v1.${Buffer.from(body, "utf8").toString("base64url")}.${hmac}`;
}

export function decodeCheckoutDraftCookie(
  sessionId: string,
  value: string | undefined | null,
  now = Date.now(),
): PublicCheckoutDraft {
  if (!value) {
    return emptyCheckoutDraft();
  }
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    return emptyCheckoutDraft();
  }
  const [, encoded, hmac] = parts;
  if (!encoded || !hmac) {
    return emptyCheckoutDraft();
  }
  let body: string;
  try {
    body = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return emptyCheckoutDraft();
  }
  if (!safeEqual(hmac, sign(sessionId, body))) {
    return emptyCheckoutDraft();
  }
  try {
    const parsed: unknown = JSON.parse(body);
    return parsePayload(parsed, now);
  } catch {
    return emptyCheckoutDraft();
  }
}

function parsePayload(raw: unknown, now: number): PublicCheckoutDraft {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyCheckoutDraft();
  }
  if (hasForbiddenOwnershipKey(raw)) {
    return emptyCheckoutDraft();
  }
  const record = raw as Record<string, unknown>;
  const updatedAt = typeof record.updatedAt === "number" ? record.updatedAt : 0;
  const expired = !updatedAt || now - updatedAt > CHECKOUT_DRAFT_TTL_MS;
  const draft = emptyCheckoutDraft();
  draft.step = parseStep(record.step);
  draft.email = asText(record.email);
  draft.firstName = asText(record.firstName);
  draft.lastName = asText(record.lastName);
  draft.line1 = asText(record.line1);
  draft.line2 = asText(record.line2);
  draft.city = asText(record.city);
  draft.county = asText(record.county);
  draft.postcode = asText(record.postcode);
  draft.country = asText(record.country) || CHECKOUT_COUNTRY_GB;
  draft.addressEntry = record.addressEntry === "manual" ? "manual" : "search";
  draft.expired = expired;
  return draft;
}

function parseStep(value: unknown): CheckoutStepId {
  if (typeof value === "string" && CHECKOUT_STEP_IDS.includes(value as CheckoutStepId)) {
    return value as CheckoutStepId;
  }
  return "contact";
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sign(sessionId: string, body: string): string {
  return createHmac("sha256", sessionId).update(body).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}
