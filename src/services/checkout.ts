import "server-only";

import { revalidatePath } from "next/cache";
import { readCheckoutDraft, writeCheckoutDraft } from "@/lib/checkout-draft-store";
import {
  formatUkPostcode,
  hasCheckoutFieldErrors,
  normalizeCountry,
  normalizeEmailInput,
  validateCheckoutAddress,
  validateCheckoutEmail,
} from "@/lib/checkout-validate";
import { containsForbiddenCartOwnership } from "@/lib/ownership-keys";
import { readGuestCartSessionId } from "@/lib/guest-cart-cookie";
import { getPublicCart } from "@/services/cart";
import {
  CHECKOUT_COUNTRY_GB,
  emptyCheckoutDraft,
  type CheckoutAddressEntry,
  type CheckoutFieldErrors,
  type CheckoutStepId,
  type PublicCheckoutDraft,
} from "@/types/checkout";
import type { PublicCart } from "@/types/cart";

export type CheckoutSnapshot = {
  cart: PublicCart;
  draft: PublicCheckoutDraft;
};

export async function getCheckoutSnapshot(): Promise<CheckoutSnapshot> {
  const sessionId = await readGuestCartSessionId();
  const cart = await getPublicCart();
  const draft = await readCheckoutDraft(sessionId);
  return sanitizeSnapshot({ cart, draft });
}

export async function saveCheckoutContact(email: string): Promise<
  | { status: "ok"; cart: PublicCart; draft: PublicCheckoutDraft }
  | { status: "invalid"; cart: PublicCart; draft: PublicCheckoutDraft; errors: CheckoutFieldErrors }
  | { status: "empty" }
  | { status: "expired"; cart: PublicCart; draft: PublicCheckoutDraft }
  | { status: "error" }
> {
  const sessionId = await readGuestCartSessionId();
  const cart = await getPublicCart();
  if (!sessionId || cart.items.length === 0) {
    return { status: "empty" };
  }
  const current = await readCheckoutDraft(sessionId);
  if (current.expired) {
    return { status: "expired", cart, draft: current };
  }
  const normalized = normalizeEmailInput(email).slice(0, 254);
  const errors = validateCheckoutEmail(normalized);
  const draft: PublicCheckoutDraft = { ...current, email: normalized };
  if (hasCheckoutFieldErrors(errors)) {
    return { status: "invalid", cart, draft, errors };
  }
  draft.step = "address";
  try {
    await persistDraft(sessionId, draft);
  } catch {
    return { status: "error" };
  }
  return { status: "ok", cart, draft };
}

export async function saveCheckoutAddress(input: {
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string;
  city: string;
  county?: string;
  postcode: string;
  country: string;
  addressEntry?: CheckoutAddressEntry;
}): Promise<
  | { status: "ok"; cart: PublicCart; draft: PublicCheckoutDraft }
  | { status: "invalid"; cart: PublicCart; draft: PublicCheckoutDraft; errors: CheckoutFieldErrors }
  | { status: "empty" }
  | { status: "expired"; cart: PublicCart; draft: PublicCheckoutDraft }
  | { status: "error" }
> {
  const sessionId = await readGuestCartSessionId();
  const cart = await getPublicCart();
  if (!sessionId || cart.items.length === 0) {
    return { status: "empty" };
  }
  const current = await readCheckoutDraft(sessionId);
  if (current.expired) {
    return { status: "expired", cart, draft: current };
  }
  if (!current.email) {
    return {
      status: "invalid",
      cart,
      draft: { ...current, step: "contact" },
      errors: validateCheckoutEmail(current.email),
    };
  }

  const country = normalizeCountry(input.country);
  const postcode = formatUkPostcode(input.postcode).slice(0, 12);
  const draft: PublicCheckoutDraft = {
    ...current,
    firstName: input.firstName.trim().slice(0, 80),
    lastName: input.lastName.trim().slice(0, 80),
    line1: input.line1.trim().slice(0, 120),
    line2: (input.line2?.trim() ?? "").slice(0, 120),
    city: input.city.trim().slice(0, 80),
    county: (input.county?.trim() ?? "").slice(0, 80),
    postcode,
    country: country || CHECKOUT_COUNTRY_GB,
    addressEntry: input.addressEntry ?? "manual",
  };
  const errors = validateCheckoutAddress(draft);
  if (hasCheckoutFieldErrors(errors)) {
    draft.addressEntry = "manual";
    return { status: "invalid", cart, draft, errors };
  }
  draft.step = "review";
  try {
    await persistDraft(sessionId, draft);
  } catch {
    return { status: "error" };
  }
  return { status: "ok", cart, draft };
}

export async function setCheckoutStep(step: CheckoutStepId): Promise<
  | { status: "ok"; cart: PublicCart; draft: PublicCheckoutDraft }
  | { status: "empty" }
  | { status: "expired"; cart: PublicCart; draft: PublicCheckoutDraft }
  | { status: "error" }
> {
  const sessionId = await readGuestCartSessionId();
  const cart = await getPublicCart();
  if (!sessionId || cart.items.length === 0) {
    return { status: "empty" };
  }
  const current = await readCheckoutDraft(sessionId);
  if (current.expired) {
    return { status: "expired", cart, draft: current };
  }
  const draft = constrainStep({ ...current, step });
  try {
    await persistDraft(sessionId, draft);
  } catch {
    return { status: "error" };
  }
  return { status: "ok", cart, draft };
}

function constrainStep(draft: PublicCheckoutDraft): PublicCheckoutDraft {
  if (draft.step === "review" && (!draft.email || !draft.line1 || !draft.postcode)) {
    return { ...draft, step: draft.email ? "address" : "contact" };
  }
  if (draft.step === "address" && !draft.email) {
    return { ...draft, step: "contact" };
  }
  return draft;
}

async function persistDraft(sessionId: string, draft: PublicCheckoutDraft): Promise<void> {
  const next = { ...draft, expired: false };
  if (containsForbiddenCartOwnership(next)) {
    throw new Error("Checkout draft must not contain ownership keys.");
  }
  await writeCheckoutDraft(sessionId, next);
  revalidatePath("/checkout");
}

function sanitizeSnapshot(snapshot: CheckoutSnapshot): CheckoutSnapshot {
  if (containsForbiddenCartOwnership(snapshot.draft)) {
    return { cart: snapshot.cart, draft: emptyCheckoutDraft() };
  }
  return { cart: snapshot.cart, draft: constrainStep(snapshot.draft) };
}
