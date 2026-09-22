import type { Metadata } from "next";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { OrderConfirmation } from "@/components/checkout/OrderConfirmation";
import { ORDER_CONFIRMATION_TITLE } from "@/lib/checkout-copy";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";
import { loadCapturedCheckoutConfirmation } from "@/services/checkout-confirmation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = privatePathMetadata(
  ORDER_CONFIRMATION_TITLE,
  "Order confirmation for a captured SHADESUK payment.",
  routes.checkoutConfirmation,
);

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckoutConfirmationPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = params.ref;
  const reference = Array.isArray(raw) ? raw[0] : raw;
  const result = await loadCapturedCheckoutConfirmation(reference);

  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <OrderConfirmation order={result.status === "confirmed" ? result.order : undefined} />
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
