import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutPage } from "@/components/checkout/CheckoutPage";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { GOOGLE_CANCELLED, GOOGLE_FAILED } from "@/lib/account-copy";
import { routes } from "@/lib/navigation";
import { getOptionalAccountUser } from "@/lib/account-session";
import { privatePathMetadata } from "@/lib/seo";
import { checkoutPaymentRail } from "@/lib/payment/resolve-provider";
import { getCheckoutSnapshot } from "@/services/checkout";

export const metadata: Metadata = privatePathMetadata(
  "Checkout",
  "Guest checkout for SHADESUK.",
  routes.checkout,
);

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckoutRoute({ searchParams }: PageProps) {
  const params = await searchParams;
  const [{ cart, draft, quote }, accountUser] = await Promise.all([
    getCheckoutSnapshot(),
    getOptionalAccountUser(),
  ]);
  if (cart.items.length === 0) {
    redirect(routes.cart);
  }

  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <CheckoutPage
            initialCart={cart}
            initialDraft={draft}
            initialQuote={quote}
            accountEmail={accountUser?.email ?? ""}
            authNotice={oauthNotice(params)}
            paymentRail={checkoutPaymentRail({
              country: draft.country,
              currency: draft.quoteLock?.chargeCurrency,
            })}
          />
        </ContentWidth>
      </main>
    </PageContainer>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oauthNotice(params: Record<string, string | string[] | undefined>): string {
  const error = first(params.error);
  if (error === "oauth") {
    return GOOGLE_FAILED;
  }
  if (error === "google_cancelled") {
    return GOOGLE_CANCELLED;
  }
  return "";
}
