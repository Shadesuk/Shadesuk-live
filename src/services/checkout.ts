import "server-only";

import { revalidatePath } from "next/cache";
import { getOptionalAccountUser } from "@/lib/account-session";
import { readCheckoutDraft, writeCheckoutDraft } from "@/lib/checkout-draft-store";
import {
  formatUkPostcode,
  hasCheckoutFieldErrors,
  normalizeCountry,
  normalizeEmailInput,
  validateDeliverableCheckoutAddress,
  validateCheckoutEmail,
} from "@/lib/checkout-validate";
import { freezeCheckoutQuoteLock } from "@/lib/checkout-quote-freeze";
import {
  checkoutQuoteFromLock,
  liveTotalUndercutsLock,
  lockCoversLines,
  quoteLockForCountry,
} from "@/lib/checkout-quote-lock";
import {
  checkoutQuoteFromCart,
  checkoutUnavailableBlocked,
  type CheckoutQuote,
} from "@/lib/checkout-quote";
import { containsForbiddenCartOwnership } from "@/lib/ownership-keys";
import { bindGuestCartSession, readGuestCartSessionId } from "@/lib/guest-cart-cookie";
import { getPublicCart } from "@/services/cart";
import { loadLivePendingPaymentLines } from "@/services/pending-payment";
import {
  CHECKOUT_COUNTRY_GB,
  emptyCheckoutDraft,
  type CheckoutAddressEntry,
  type CheckoutMutationResult,
  type CheckoutStepId,
  type PublicCheckoutDraft,
} from "@/types/checkout";
import type { PublicCart } from "@/types/cart";

export type CheckoutSnapshot = {
  cart: PublicCart;
  draft: PublicCheckoutDraft;
  quote: CheckoutQuote;
};

export async function getCheckoutSnapshot(): Promise<CheckoutSnapshot> {
  const cart = await getPublicCart();
  const sessionId = await ensureCheckoutSession(cart);
  const draft = await readCheckoutDraft(sessionId);
  const quote = await quoteForDraft(cart, draft);
  return sanitizeSnapshot({ cart, draft, quote });
}

export async function saveCheckoutContact(email: string): Promise<CheckoutMutationResult> {
  const loaded = await loadCheckout();
  if (!loaded) {
    return { status: "empty" };
  }
  const { sessionId, cart, current, quote } = loaded;
  if (current.expired) {
    return { status: "expired", cart, draft: current, quote };
  }
  const normalized = normalizeEmailInput(email).slice(0, 254);
  const errors = validateCheckoutEmail(normalized);
  const draft: PublicCheckoutDraft = { ...current, email: normalized };
  if (hasCheckoutFieldErrors(errors)) {
    return { status: "invalid", cart, draft, quote, errors };
  }
  draft.step = "address";
  try {
    await persistDraft(sessionId, draft);
  } catch {
    return { status: "error" };
  }
  return { status: "ok", cart, draft, quote };
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
}): Promise<CheckoutMutationResult> {
  const loaded = await loadCheckout();
  if (!loaded) {
    return { status: "empty" };
  }
  const { sessionId, cart, current, quote } = loaded;
  if (current.expired) {
    return { status: "expired", cart, draft: current, quote };
  }
  if (!current.email) {
    return {
      status: "invalid",
      cart,
      draft: { ...current, step: "contact" },
      quote,
      errors: validateCheckoutEmail(current.email),
    };
  }

  const country = normalizeCountry(input.country);
  const postcode = (
    country === CHECKOUT_COUNTRY_GB ? formatUkPostcode(input.postcode) : input.postcode.trim()
  ).slice(0, 12);
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
  const countryChanged = normalizeCountry(draft.country) !== normalizeCountry(current.country);
  if (countryChanged) {
    draft.quoteLock = null;
    draft.step = "address";
  }
  const nextQuote = checkoutQuoteFromCart(cart, draft.country);
  const errors = validateDeliverableCheckoutAddress(draft);
  if (hasCheckoutFieldErrors(errors)) {
    draft.addressEntry = "manual";
    draft.step = "address";
    if (countryChanged) {
      try {
        await persistDraft(sessionId, draft);
      } catch {
        return { status: "error" };
      }
    }
    return { status: "invalid", cart, draft, quote: nextQuote, errors };
  }
  if (checkoutUnavailableBlocked(cart)) {
    draft.step = "address";
    draft.quoteLock = null;
    try {
      await persistDraft(sessionId, draft);
    } catch {
      return { status: "error" };
    }
    return { status: "blocked", cart, draft, quote: nextQuote };
  }
  const frozen = await freezeSavedQuote(draft.country);
  if (frozen.status === "error") {
    return { status: "error" };
  }
  if (frozen.status === "blocked") {
    draft.step = "address";
    draft.quoteLock = frozen.lock;
    try {
      await persistDraft(sessionId, draft);
    } catch {
      return { status: "error" };
    }
    return { status: "blocked", cart, draft, quote: nextQuote };
  }
  draft.quoteLock = frozen.lock;
  draft.step = "review";
  const savedQuote = frozen.lock ? checkoutQuoteFromLock(frozen.lock) : nextQuote;
  try {
    await persistDraft(sessionId, draft);
  } catch {
    return { status: "error" };
  }
  return { status: "ok", cart, draft, quote: savedQuote };
}

export async function setCheckoutStep(step: CheckoutStepId): Promise<CheckoutMutationResult> {
  const loaded = await loadCheckout();
  if (!loaded) {
    return { status: "empty" };
  }
  const { sessionId, cart, current, quote } = loaded;
  if (current.expired) {
    return { status: "expired", cart, draft: current, quote };
  }
  const requested =
    step === "review" && (checkoutUnavailableBlocked(cart) || current.lockExpired) ? "address" : step;
  const draft = constrainStep({ ...current, step: requested });
  try {
    await persistDraft(sessionId, draft);
  } catch {
    return { status: "error" };
  }
  if (requested !== step && checkoutUnavailableBlocked(cart)) {
    return { status: "blocked", cart, draft, quote };
  }
  return { status: "ok", cart, draft, quote };
}

export async function restartExpiredCheckout(): Promise<CheckoutMutationResult> {
  const loaded = await loadCheckout();
  if (!loaded) {
    return { status: "empty" };
  }
  const { sessionId, cart, current, quote } = loaded;
  if (!current.expired) {
    return { status: "ok", cart, draft: current, quote };
  }
  const draft = emptyCheckoutDraft();
  try {
    await persistDraft(sessionId, draft);
  } catch {
    return { status: "error" };
  }
  return { status: "ok", cart, draft, quote };
}

async function loadCheckout(): Promise<{
  sessionId: string;
  cart: PublicCart;
  current: PublicCheckoutDraft;
  quote: CheckoutQuote;
} | null> {
  const cart = await getPublicCart();
  const sessionId = await ensureCheckoutSession(cart);
  if (!sessionId || cart.items.length === 0) {
    return null;
  }
  const current = await readCheckoutDraft(sessionId);
  return { sessionId, cart, current, quote: await quoteForDraft(cart, current) };
}

async function quoteForDraft(cart: PublicCart, draft: PublicCheckoutDraft): Promise<CheckoutQuote> {
  const liveQuote = checkoutQuoteFromCart(cart, draft.country);
  const held = quoteLockForCountry(draft.quoteLock, draft.country);
  if (!held) {
    return liveQuote;
  }
  try {
    const lines = await readFreezeLines();
    if (
      lines &&
      lockCoversLines(
        held,
        lines.map((line) => ({ variantId: line.productVariantId, quantity: line.quantity })),
      )
    ) {
      if (liveQuote.shippingStatus === "priced" && liveTotalUndercutsLock(held, liveQuote.totalMinor)) {
        return liveQuote;
      }
      return checkoutQuoteFromLock(held);
    }
  } catch {
    return liveQuote;
  }
  return liveQuote;
}

async function freezeSavedQuote(country: string): Promise<
  | { status: "open"; lock: null }
  | { status: "locked"; lock: NonNullable<PublicCheckoutDraft["quoteLock"]> }
  | { status: "blocked"; lock: PublicCheckoutDraft["quoteLock"] }
  | { status: "error" }
> {
  let lines: Awaited<ReturnType<typeof loadLivePendingPaymentLines>> = null;
  try {
    lines = await readFreezeLines();
  } catch {
    return { status: "error" };
  }
  if (!lines) {
    return { status: "open", lock: null };
  }
  let lock: PublicCheckoutDraft["quoteLock"] = null;
  try {
    lock = await freezeCheckoutQuoteLock({
      countryCode: country,
      lines: lines.map((line) => ({
        variantId: line.productVariantId,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
      })),
    });
  } catch {
    return { status: "error" };
  }
  if (!lock || lock.paymentProvider !== "paypal") {
    return { status: "blocked", lock };
  }
  return { status: "locked", lock };
}

async function readFreezeLines(): Promise<Awaited<ReturnType<typeof loadLivePendingPaymentLines>>> {
  const user = await getOptionalAccountUser();
  return loadLivePendingPaymentLines(user?.id ?? null);
}

async function ensureCheckoutSession(cart: PublicCart): Promise<string | null> {
  const existing = await readGuestCartSessionId();
  if (existing) {
    return existing;
  }
  if (cart.items.length === 0) {
    return null;
  }
  return bindGuestCartSession();
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
    return {
      cart: snapshot.cart,
      draft: emptyCheckoutDraft(),
      quote: snapshot.quote,
    };
  }
  let draft = constrainStep(snapshot.draft);
  if (checkoutUnavailableBlocked(snapshot.cart) && draft.step === "review") {
    draft = { ...draft, step: "address" };
  }
  return { ...snapshot, draft };
}
