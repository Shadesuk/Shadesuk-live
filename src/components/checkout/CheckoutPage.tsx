"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  retrieveCheckoutAddressAction,
  saveCheckoutAddressAction,
  saveCheckoutContactAction,
  searchCheckoutAddressAction,
  setCheckoutStepAction,
} from "@/app/(storefront)/checkout/actions";
import { CheckoutAddress } from "@/components/checkout/CheckoutAddress";
import { CheckoutContact } from "@/components/checkout/CheckoutContact";
import { CheckoutExpired } from "@/components/checkout/CheckoutExpired";
import { CheckoutReview } from "@/components/checkout/CheckoutReview";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { useCart } from "@/components/cart/CartProvider";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { InlineError } from "@/components/ui/InlineError";
import type { AddressFormValue } from "@/components/address/AddressForm";
import { track } from "@/lib/analytics";
import { mergeLookupPostalAddress } from "@/lib/address-merge";
import { EMPTY_BAG_CTA, EMPTY_BAG_DESCRIPTION, EMPTY_BAG_TITLE } from "@/lib/cart-copy";
import {
  CHECKOUT_CART_UNAVAILABLE,
  CHECKOUT_ITEM_UNAVAILABLE,
  CHECKOUT_LOCK_EXPIRED,
  CHECKOUT_PRICE_CHANGED,
  CHECKOUT_REQUEST_ERROR,
  CHECKOUT_STEPS,
  CHECKOUT_TITLE,
} from "@/lib/checkout-copy";
import { liveTotalUndercutsLock, quoteMatchesLock } from "@/lib/checkout-quote-lock";
import {
  checkoutHasPriceChange,
  checkoutQuoteFromCart,
  checkoutUnavailableBlocked,
  type CheckoutQuote,
} from "@/lib/checkout-quote";
import { routes } from "@/lib/navigation";
import { usePinPageStart } from "@/lib/page-scroll";
import type {
  CheckoutFieldErrors,
  CheckoutMutationResult,
  CheckoutStepId,
  PublicCheckoutDraft,
} from "@/types/checkout";
import type { PostalAddress } from "@/types/integrations";
import type { PublicCart } from "@/types/cart";
import styles from "./CheckoutPage.module.css";

type CheckoutPageProps = {
  initialCart: PublicCart;
  initialDraft: PublicCheckoutDraft;
  initialQuote: CheckoutQuote;
  accountEmail?: string;
  authNotice?: string;
};

export function CheckoutPage({
  initialCart,
  initialDraft,
  initialQuote,
  accountEmail = "",
  authNotice = "",
}: CheckoutPageProps) {
  const router = useRouter();
  const { applyCart } = useCart();
  const [view, setView] = useState(initialCart);
  const [draft, setDraft] = useState(initialDraft);
  const [quote, setQuote] = useState(initialQuote);
  const [email, setEmail] = useState(initialDraft.email || accountEmail);
  const [address, setAddress] = useState<AddressFormValue>(toAddressValue(initialDraft));
  const [query, setQuery] = useState(initialDraft.postcode);
  const [showForm, setShowForm] = useState(
    initialDraft.addressEntry === "manual" || Boolean(initialDraft.line1),
  );
  const [errors, setErrors] = useState<CheckoutFieldErrors>({});
  const [pending, setPending] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const [cartGone, setCartGone] = useState(false);
  const blocked = checkoutUnavailableBlocked(view);
  const step = draft.step;
  const summaryQuote = step === "address" ? checkoutQuoteFromCart(view, address.country) : quote;
  const reviewLock =
    step !== "address" && draft.quoteLock && quoteMatchesLock(draft.quoteLock, quote) ? draft.quoteLock : null;
  const chargeReady = step !== "review" || !draft.quoteLock || Boolean(reviewLock);
  usePinPageStart(step, "checkout-heading", true);
  const priceChanged = checkoutHasPriceChange(view);
  const liveQuote = checkoutQuoteFromCart(view, step === "address" ? address.country : draft.country);
  const liveCheaper = Boolean(
    step === "review" &&
      draft.quoteLock &&
      liveQuote.shippingStatus === "priced" &&
      liveTotalUndercutsLock(draft.quoteLock, liveQuote.totalMinor),
  );

  useEffect(() => {
    if (view.items.length === 0) {
      return;
    }
    track("begin_checkout", {
      count: view.items.length,
      value: quote.total,
      currency: "GBP",
    });
    // Fire once per checkout visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view.items.length === 0) {
      router.replace(routes.cart);
    }
  }, [router, view.items.length]);

  if (view.items.length === 0) {
    return (
      <EmptyState
        title={EMPTY_BAG_TITLE}
        description={EMPTY_BAG_DESCRIPTION}
        titleAs="h1"
        actions={
          <ButtonLink href={routes.shop} variant="secondary">
            {EMPTY_BAG_CTA}
          </ButtonLink>
        }
      />
    );
  }

  if (draft.expired) {
    return <CheckoutExpired />;
  }

  async function applyResult(result: CheckoutMutationResult): Promise<boolean> {
    if (result.status === "empty") {
      setCartGone(true);
      router.replace(routes.cart);
      return false;
    }
    if (result.status === "error") {
      setRequestError(true);
      return false;
    }
    applyCart(result.cart);
    setView(result.cart);
    setDraft(result.draft);
    setQuote(result.quote);
    setEmail(result.draft.email);
    setAddress(toAddressValue(result.draft));
    if (result.draft.postcode) {
      setQuery(result.draft.postcode);
    }
    if (result.status === "expired") {
      return false;
    }
    if (result.status === "blocked") {
      setShowForm(true);
      return false;
    }
    if (result.status === "invalid") {
      setErrors(result.errors);
      if (result.errors.email) {
        setDraft({ ...result.draft, step: "contact" });
      } else {
        setShowForm(true);
      }
      return false;
    }
    setErrors({});
    setRequestError(false);
    return true;
  }

  async function runMutation(action: () => Promise<CheckoutMutationResult>) {
    if (pending) {
      return;
    }
    setPending(true);
    setRequestError(false);
    try {
      await applyResult(await action());
    } catch {
      setRequestError(true);
    } finally {
      setPending(false);
    }
  }

  async function submitContact() {
    await runMutation(() => saveCheckoutContactAction({ email }));
  }

  async function submitAddress() {
    await runMutation(() =>
      saveCheckoutAddressAction({
        ...address,
        addressEntry: "manual",
      }),
    );
  }

  async function goTo(next: CheckoutStepId) {
    await runMutation(() => setCheckoutStepAction({ step: next }));
  }

  function handleSelect(selected: PostalAddress) {
    setAddress((current) => mergeLookupPostalAddress(current, selected));
    setShowForm(true);
    setQuery(selected.country === "GB" ? selected.postcode : selected.line1);
    track("address_autocomplete_used");
    window.requestAnimationFrame(() => {
      document.getElementById("checkout-line1")?.focus();
    });
  }

  return (
    <div className={styles.page} data-checkout data-checkout-step={step}>
      <h1 id="checkout-heading" tabIndex={-1} className={`text-h2 ${styles.heading}`}>
        {CHECKOUT_TITLE}
      </h1>
      <ol className={styles.steps} aria-label="Checkout steps">
        {CHECKOUT_STEPS.map((item) => {
          const current = item.id === step;
          const reached =
            CHECKOUT_STEPS.findIndex((entry) => entry.id === step) >=
            CHECKOUT_STEPS.findIndex((entry) => entry.id === item.id);
          return (
            <li key={item.id} className={current ? styles.current : undefined} aria-current={current ? "step" : undefined}>
              {reached && !current ? (
                <button type="button" className={styles.stepButton} onClick={() => void goTo(item.id)} disabled={pending}>
                  <span className="text-micro">
                    {item.number} {item.label}
                  </span>
                </button>
              ) : (
                <span className="text-micro">
                  {item.number} {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {authNotice && step !== "contact" ? (
        <p className="text-small" role="alert">
          {authNotice}
        </p>
      ) : null}
      {cartGone ? (
        <p className="text-small" role="alert">
          {CHECKOUT_CART_UNAVAILABLE}
        </p>
      ) : null}
      {requestError ? <InlineError>{CHECKOUT_REQUEST_ERROR}</InlineError> : null}
      {blocked ? (
        <p className="text-small" role="alert">
          {CHECKOUT_ITEM_UNAVAILABLE}{" "}
          <ButtonLink href={routes.cart} variant="tertiary">
            Return to bag
          </ButtonLink>
        </p>
      ) : null}
      {draft.lockExpired ? (
        <p className="text-small" role="status">
          {CHECKOUT_LOCK_EXPIRED}
        </p>
      ) : null}
      {(priceChanged && !(draft.quoteLock && step === "review")) || liveCheaper ? (
        <p className="text-small" role="status">
          {CHECKOUT_PRICE_CHANGED}
        </p>
      ) : null}
      {view.issues.length > 0 ? (
        <ul className={styles.issues} role="status">
          {view.issues.map((issue, index) => (
            <li key={`${issue.issue}-${issue.itemId ?? index}`} className="text-small">
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.mobileSummary}>
            <CheckoutSummary cart={view} quote={summaryQuote} lineLock={reviewLock} collapsible />
          </div>
          {step === "contact" ? (
            <CheckoutContact
              email={email}
              errors={errors}
              pending={pending}
              signedIn={Boolean(accountEmail)}
              authNotice={authNotice}
              onEmailChange={setEmail}
              onSubmit={submitContact}
            />
          ) : null}
          {step === "address" ? (
            <CheckoutAddress
              value={address}
              query={query}
              showForm={showForm}
              errors={errors}
              pending={pending}
              onQueryChange={setQuery}
              onChange={setAddress}
              onManual={() => {
                setShowForm(true);
                track("address_manual_entry");
              }}
              onSelect={handleSelect}
              onBack={() => void goTo("contact")}
              onSubmit={submitAddress}
              search={(next) => searchCheckoutAddressAction({ query: next, country: address.country })}
              retrieve={(id) => retrieveCheckoutAddressAction({ id, country: address.country })}
            />
          ) : null}
          {step === "review" ? (
            <CheckoutReview
              cart={view}
              draft={draft}
              quote={quote}
              lineLock={reviewLock}
              chargeReady={chargeReady}
              pending={pending}
              onBack={() => void goTo("address")}
            />
          ) : null}
        </div>
        <div className={styles.desktopSummary}>
          <CheckoutSummary cart={view} quote={summaryQuote} lineLock={reviewLock} />
        </div>
      </div>
    </div>
  );
}

function toAddressValue(draft: PublicCheckoutDraft): AddressFormValue {
  return {
    firstName: draft.firstName,
    lastName: draft.lastName,
    line1: draft.line1,
    line2: draft.line2,
    city: draft.city,
    county: draft.county,
    postcode: draft.postcode,
    country: draft.country,
  };
}
