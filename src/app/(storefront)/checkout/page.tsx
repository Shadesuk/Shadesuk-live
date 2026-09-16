import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutPage } from "@/components/checkout/CheckoutPage";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";
import { getCheckoutSnapshot } from "@/services/checkout";

export const metadata: Metadata = privatePathMetadata(
  "Checkout",
  "Guest checkout for SHADESUK.",
  routes.checkout,
);

export default async function CheckoutRoute() {
  const { cart, draft } = await getCheckoutSnapshot();
  if (cart.items.length === 0) {
    redirect(routes.cart);
  }

  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <CheckoutPage initialCart={cart} initialDraft={draft} />
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
