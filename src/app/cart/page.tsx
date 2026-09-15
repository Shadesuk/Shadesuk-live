import type { Metadata } from "next";
import { CartPage } from "@/components/cart/CartPage";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { getCartSuggestions, getPublicCart } from "@/services/cart";
import { getStorefrontCatalogue } from "@/services/storefront-catalogue";

export const metadata: Metadata = {
  title: "Bag",
};

export default async function CartRoute() {
  const [cart, catalogue] = await Promise.all([
    getPublicCart(),
    getStorefrontCatalogue(),
  ]);
  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <CartPage
            initialCart={cart}
            suggestions={getCartSuggestions(cart, catalogue.products)}
          />
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
