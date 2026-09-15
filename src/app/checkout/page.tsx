import type { Metadata } from "next";
import { CheckoutPlaceholder } from "@/components/cart/CheckoutPlaceholder";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";

export const metadata: Metadata = {
  title: "Checkout",
};

export default function CheckoutRoute() {
  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <CheckoutPlaceholder />
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
