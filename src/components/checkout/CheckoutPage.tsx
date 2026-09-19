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
  CHECKOUT_REQUEST_ERROR,
  CHECKOUT_STEPS,
  CHECKOUT_TITLE,
} from "@/lib/checkout-copy";
import { routes } from "@/lib/navigation";
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
  accountEmail?: string;
};

export function CheckoutPage({ initialCart, initialDraft, accountEmail = "" }: CheckoutPageProps) {
  const router = useRouter();
  const { cart, applyCart } = useCart();
  const view = cart.items.length > 0 ? cart : initialCart;
  const [draft, setDraft] = useState(initialDraft);
  const [email, setEmail] = useState(initialDraft.email || accountEmail);
  const [address, setAddress] = useState<AddressFormValue>(toAddressValue(initialDraft));
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(
    initialDraft.addressEntry === "manual" || Boolean(initialDraft.line1),
  );
  const [errors, setErrors] = useState<CheckoutFieldErrors>({});
  const [pending, setPending] = useState(false);
  const [requestError, setRequestError] = useState(false);
  const [cartGone, setCartGone] = useState(false);

  useEffect(() => {
    if (view.items.length === 0) {
      return;
    }
    track("begin_checkout", {
      count: view.items.length,
      value: view.subtotal,
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

  const step = draft.step;

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
    setDraft(result.draft);
    setEmail(result.draft.email);
    setAddress(toAddressValue(result.draft));
    if (result.status === "expired") {
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

  async function submitContact() {
    setPending(true);
    setRequestError(false);
    await applyResult(await saveCheckoutContactAction({ email }));
    setPending(false);
  }

  async function submitAddress() {
    setPending(true);
    setRequestError(false);
    await applyResult(
      await saveCheckoutAddressAction({
        ...address,
        addressEntry: "manual",
      }),
    );
    setPending(false);
  }

  async function goTo(next: CheckoutStepId) {
    setPending(true);
    setRequestError(false);
    await applyResult(await setCheckoutStepAction({ step: next }));
    setPending(false);
  }

  function handleSelect(selected: PostalAddress) {
    setAddress((current) => mergeLookupPostalAddress(current, selected));
    setShowForm(true);
    setQuery(selected.postcode);
    track("address_autocomplete_used");
  }

  return (
    <div className={styles.page} data-checkout data-checkout-step={step}>
      <h1 className={`text-h2 ${styles.heading}`}>{CHECKOUT_TITLE}</h1>
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
      {cartGone ? (
        <p className="text-small" role="alert">
          {CHECKOUT_CART_UNAVAILABLE}
        </p>
      ) : null}
      {requestError ? <InlineError>{CHECKOUT_REQUEST_ERROR}</InlineError> : null}
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
            <CheckoutSummary cart={view} collapsible />
          </div>
          {step === "contact" ? (
            <CheckoutContact
              email={email}
              errors={errors}
              pending={pending}
              signedIn={Boolean(accountEmail)}
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
              search={(next) => searchCheckoutAddressAction({ query: next })}
              retrieve={(id) => retrieveCheckoutAddressAction({ id })}
            />
          ) : null}
          {step === "review" ? (
            <CheckoutReview
              cart={view}
              draft={draft}
              pending={pending}
              onBack={() => void goTo("address")}
            />
          ) : null}
        </div>
        <div className={styles.desktopSummary}>
          <CheckoutSummary cart={view} />
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
