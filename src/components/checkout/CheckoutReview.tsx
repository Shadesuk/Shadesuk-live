"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  cancelCheckoutPaymentAction,
  declineCheckoutPaymentAction,
  initiateCheckoutPaymentAction,
  loadPayPalCheckoutConfigAction,
  verifyCheckoutPaymentAction,
} from "@/app/(storefront)/checkout/payment-actions";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { InlineError } from "@/components/ui/InlineError";
import { PaymentMethods } from "@/components/payment/PaymentMethods";
import { IndiaCardPaymentNotice } from "@/components/checkout/IndiaCardPaymentNotice";
import { IndiaPayment } from "@/components/checkout/IndiaPayment";
import { supportedCountry } from "@/contracts/countries";
import {
  BACK,
  EDIT,
  ESTIMATED_DELIVERY_LABEL,
  ESTIMATED_DELIVERY_WINDOW,
  PAYMENT_CANCELLED,
  PAYMENT_CONFIRM_ERROR,
  PAYMENT_DECLINED,
  PAYMENT_HEADING,
  PAYMENT_NETWORK,
  PAYMENT_NEXT_BODY,
  PAYMENT_START_ERROR,
  PAYMENT_UNAVAILABLE,
  PAYMENT_VERIFIED_NEXT,
  REVIEW_HEADING,
  SHIPPING_HEADING,
  CHECKOUT_TOTAL_UPDATED,
  SHIPPING_UNAVAILABLE,
  UPDATE_TOTAL,
  UK_STANDARD_DELIVERY,
} from "@/lib/checkout-copy";
import { useMarket } from "@/components/market/MarketProvider";
import { chargeDisclosure, presentCheckoutAmount } from "@/lib/market/prices";
import { isPayPalChargeCurrency, resolvePaymentRoute } from "@/lib/payment/payment-route";
import { mountPayPalCheckout } from "@/lib/paypal/open-buttons";
import { displayLineTotal, displayLockedChargeMinor, type CheckoutQuoteLock } from "@/lib/checkout-quote-lock";
import type { CheckoutQuote } from "@/lib/checkout-quote";
import { orderConfirmationPath, routes } from "@/lib/navigation";
import type { PublicCheckoutDraft } from "@/types/checkout";
import type { PublicCart } from "@/types/cart";
import styles from "./CheckoutReview.module.css";

type FrozenCharge = {
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
};

type CheckoutReviewProps = {
  cart: PublicCart;
  draft: PublicCheckoutDraft;
  quote: CheckoutQuote;
  lineLock?: CheckoutQuoteLock | null;
  chargeReady?: boolean;
  hideQuoteStale?: boolean;
  paymentRail?: "paypal" | "india" | "unavailable";
  indiaCardPaymentReady?: boolean;
  frozenCharge?: FrozenCharge | null;
  pending?: boolean;
  onBack: () => void;
  onUpdateTotal?: () => void;
};

type PaymentUiState = "idle" | "starting" | "checkout" | "verifying" | "verified" | "cancelled" | "error";

export function CheckoutReview({
  cart,
  draft,
  quote,
  lineLock = null,
  chargeReady = true,
  paymentRail = "paypal",
  indiaCardPaymentReady = true,
  frozenCharge = null,
  pending = false,
  onBack,
  onUpdateTotal,
}: CheckoutReviewProps) {
  const router = useRouter();
  const { rates } = useMarket();
  const route = resolvePaymentRoute(draft.country);
  const paypalSlotRef = useRef<HTMLDivElement>(null);
  const paymentIdRef = useRef<string>("");
  const [paymentUi, setPaymentUi] = useState<PaymentUiState>("idle");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState<string>("");
  const [paypalReady, setPaypalReady] = useState(false);
  const india = paymentRail === "india";
  const paypalCurrency =
    route?.provider === "paypal" && isPayPalChargeCurrency(route.paymentCurrency)
      ? route.paymentCurrency
      : null;
  const payable =
    paymentRail !== "india" &&
    paypalCurrency != null &&
    chargeReady &&
    quote.shippingStatus === "priced" &&
    (paypalCurrency === "GBP" ||
      Boolean(lineLock && lineLock.chargeCurrency === paypalCurrency && lineLock.fxRateId));
  const disclosure =
    route && lineLock
      ? chargeDisclosure({
          displayCurrency: route.displayCurrency,
          chargeCurrency: lineLock.chargeCurrency,
          chargeMinor: lineLock.chargeTotalMinor,
          provider: route.provider,
        })
      : null;
  const indiaReady = india && chargeReady && frozenCharge != null && quote.shippingStatus === "priced";
  const addressLines = [
    `${draft.firstName} ${draft.lastName}`.trim(),
    draft.line1,
    draft.line2,
    [draft.city, draft.county].filter(Boolean).join(", "),
    draft.postcode,
    supportedCountry(draft.country)?.name ?? draft.country,
  ].filter(Boolean);

  useEffect(() => {
    const slot = paypalSlotRef.current;
    if (!slot || pending || !payable) {
      return;
    }
    let cancelled = false;
    let unmount: () => void = () => undefined;
    void (async () => {
      const config = await loadPayPalCheckoutConfigAction();
      if (cancelled) {
        return;
      }
      if (config.status !== "ok") {
        setPaymentError(PAYMENT_UNAVAILABLE);
        setPaymentUi("error");
        return;
      }
      unmount = await mountPayPalCheckout({
        container: slot,
        clientId: config.clientId,
        mode: config.mode,
        currencyCode: paypalCurrency ?? "GBP",
        createOrder: async () => {
          setPaymentBusy(true);
          setPaymentError("");
          setPaymentUi("starting");
          const started = await initiateCheckoutPaymentAction();
          if (started.status !== "ok") {
            setPaymentError(
              started.status === "unavailable" ? PAYMENT_UNAVAILABLE : PAYMENT_START_ERROR,
            );
            setPaymentUi("error");
            setPaymentBusy(false);
            return null;
          }
          paymentIdRef.current = started.paymentId;
          setPaymentUi("checkout");
          return { orderId: started.providerOrderId };
        },
        onApprove: async (paypalOrderId) => {
          setPaymentBusy(true);
          setPaymentUi("verifying");
          const verified = await verifyCheckoutPaymentAction({
            paymentId: paymentIdRef.current,
            paypalOrderId,
          });
          if (
            (verified.status === "verified" || verified.status === "already_processed") &&
            verified.orderReference
          ) {
            setPaymentUi("verified");
            router.replace(orderConfirmationPath(verified.orderReference), { scroll: true });
            return;
          }
          setPaymentError(PAYMENT_CONFIRM_ERROR);
          setPaymentUi("error");
          setPaymentBusy(false);
        },
        onCancel: () => {
          const paymentId = paymentIdRef.current;
          if (paymentId) {
            void cancelCheckoutPaymentAction({ paymentId });
          }
          paymentIdRef.current = "";
          setPaymentUi("cancelled");
          setPaymentBusy(false);
        },
        onError: (kind) => {
          const paymentId = paymentIdRef.current;
          if (kind === "declined" && paymentId) {
            void declineCheckoutPaymentAction({ paymentId });
            paymentIdRef.current = "";
            setPaymentError(PAYMENT_DECLINED);
          } else if (kind === "network") {
            setPaymentError(PAYMENT_NETWORK);
          } else {
            setPaymentError(PAYMENT_START_ERROR);
          }
          setPaymentUi("error");
          setPaymentBusy(false);
        },
      });
      if (cancelled) {
        unmount();
        return;
      }
      setPaypalReady(true);
    })();
    return () => {
      cancelled = true;
      unmount();
    };
  }, [payable, paypalCurrency, pending, router]);

  return (
    <div className={styles.review} data-checkout-review>
      <section className={styles.block} aria-labelledby="checkout-review-heading">
        <h2 id="checkout-review-heading" className="text-h3">
          {REVIEW_HEADING}
        </h2>
        <ul className={styles.items}>
          {cart.items.map((item) => {
            const variant = [item.colourName, item.sizeName].filter(Boolean).join(" · ");
            const hasImage = Boolean(item.image?.src);
            return (
              <li key={item.id} className={hasImage ? styles.item : styles.itemPlain}>
                {hasImage && item.image?.src ? (
                  <div className={styles.media}>
                    <Image
                      src={item.image.src}
                      alt={item.image.alt}
                      width={item.image.width}
                      height={item.image.height}
                      className={styles.image}
                    />
                  </div>
                ) : null}
                <div className={styles.details}>
                  <div className={styles.headingRow}>
                    <p className="text-small">{item.name}</p>
                    <ButtonLink
                      href={routes.cart}
                      variant="tertiary"
                      className={styles.edit}
                    >
                      {EDIT}
                      <span className="visually-hidden">{` ${item.name} in your bag`}</span>
                    </ButtonLink>
                  </div>
                  {variant ? <p className="text-micro">{variant}</p> : null}
                  <p className="text-small">Qty {item.quantity}</p>
                  <p className="text-small">{formatReviewLine(lineLock, item, Boolean(frozenCharge), route, rates)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.block} aria-labelledby="checkout-review-delivery">
        <div className={styles.headingRow}>
          <h3 id="checkout-review-delivery" className="text-micro">
            {SHIPPING_HEADING}
          </h3>
          <Button
            type="button"
            variant="tertiary"
            className={styles.edit}
            onClick={onBack}
            disabled={pending}
            aria-label="Edit delivery address"
          >
            {EDIT}
          </Button>
        </div>
        <p className="text-small">{quote.shippingStatus === "priced" ? (quote.shippingLabel ?? UK_STANDARD_DELIVERY) : "Shipping"}</p>
        <p className="text-small">
          {quote.shippingStatus === "priced"
            ? presentCheckoutAmount({
                gbpMinor: quote.shippingMinor,
                chargeMinor: frozenCharge?.shippingMinor ?? lineLock?.chargeShippingMinor,
                displayCurrency: route?.displayCurrency ?? "GBP",
                chargeCurrency: frozenCharge ? "INR" : (lineLock?.chargeCurrency ?? route?.paymentCurrency ?? "GBP"),
                rates,
                cents: true,
              })
            : SHIPPING_UNAVAILABLE}
        </p>
        <p className="text-micro">{ESTIMATED_DELIVERY_LABEL}</p>
        <p className="text-small">{quote.estimatedDelivery ?? ESTIMATED_DELIVERY_WINDOW}</p>
        <p className="text-small">{draft.email}</p>
        {addressLines.map((line) => (
          <p key={line} className="text-small">
            {line}
          </p>
        ))}
      </section>

      <section className={styles.payment} aria-labelledby="checkout-review-payment">
        <h3 id="checkout-review-payment" className="text-micro">
          {PAYMENT_HEADING}
        </h3>
        {india ? null : <PaymentMethods />}
        {india ? (
          !indiaCardPaymentReady ? (
            <IndiaCardPaymentNotice returnToBag />
          ) : indiaReady && frozenCharge ? (
            <>
              {disclosure ? <p className="text-small">{disclosure}</p> : null}
              <IndiaPayment
                key={lineLock?.frozenAt}
                amountMinor={frozenCharge.totalMinor}
                disabled={pending}
                onUpdateTotal={onUpdateTotal}
              />
            </>
          ) : (
            <QuoteHold
              message={quote.shippingStatus === "priced" ? CHECKOUT_TOTAL_UPDATED : SHIPPING_UNAVAILABLE}
              canRefresh={quote.shippingStatus === "priced"}
              pending={pending}
              onUpdateTotal={onUpdateTotal}
            />
          )
        ) : payable ? null : (
          <QuoteHold
            message={quote.shippingStatus === "priced" ? CHECKOUT_TOTAL_UPDATED : SHIPPING_UNAVAILABLE}
            canRefresh={quote.shippingStatus === "priced"}
            pending={pending}
            onUpdateTotal={onUpdateTotal}
          />
        )}
        {payable ? (
          <>
            {disclosure ? <p className="text-small">{disclosure}</p> : null}
            <div
              ref={paypalSlotRef}
              className={styles.paypalSlot}
              data-paypal-button
              data-paypal-ready={paypalReady ? "true" : "false"}
              aria-busy={paymentBusy}
            />
            <p id="checkout-payment-next" className="text-small">
              {paymentUi === "verified" ? PAYMENT_VERIFIED_NEXT : PAYMENT_NEXT_BODY}
            </p>
            {paymentUi === "cancelled" ? (
              <p className="text-small" role="status">
                {PAYMENT_CANCELLED}
              </p>
            ) : null}
            {paymentUi === "error" && paymentError ? <InlineError>{paymentError}</InlineError> : null}
          </>
        ) : null}
      </section>

      <div className={styles.actions}>
        <Button type="button" variant="tertiary" onClick={onBack} disabled={pending || paymentBusy}>
          {BACK}
        </Button>
        <ButtonLink href={routes.cart} variant="tertiary">
          Return to bag
        </ButtonLink>
      </div>
    </div>
  );
}

function QuoteHold({
  message,
  canRefresh,
  pending,
  onUpdateTotal,
}: {
  message: string;
  canRefresh: boolean;
  pending: boolean;
  onUpdateTotal?: () => void;
}) {
  return (
    <div>
      <p className="text-small" role="status">
        {message}
      </p>
      {canRefresh && onUpdateTotal ? (
        <Button type="button" variant="primary" onClick={onUpdateTotal} disabled={pending}>
          {UPDATE_TOTAL}
        </Button>
      ) : null}
    </div>
  );
}

function formatReviewLine(
  lock: CheckoutQuoteLock | null,
  item: { variantId?: string; quantity: number; lineTotal: number },
  indiaCharge: boolean,
  route: ReturnType<typeof resolvePaymentRoute>,
  rates: readonly { currency: string; rate: string }[],
): string {
  const gbpMajor = displayLineTotal(lock, item);
  const gbpMinor = Math.round(gbpMajor * 100);
  const chargeCurrency = indiaCharge ? "INR" : (route?.paymentCurrency ?? "GBP");
  const displayCurrency = indiaCharge ? "INR" : (route?.displayCurrency ?? "GBP");
  const lockMatchesRoute = lock != null && lock.chargeCurrency === chargeCurrency;
  return presentCheckoutAmount({
    gbpMinor,
    chargeMinor: lockMatchesRoute ? displayLockedChargeMinor(lock, item) : null,
    displayCurrency,
    chargeCurrency,
    rates,
    cents: displayCurrency === chargeCurrency,
  });
}
