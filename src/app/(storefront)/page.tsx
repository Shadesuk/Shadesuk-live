import type { Metadata } from "next";
import { Homepage } from "@/components/home/Homepage";
import { JsonLd } from "@/components/seo/JsonLd";
import { INDEX_FOLLOW, organizationJsonLd, storefrontMetadata } from "@/lib/seo";
import { site } from "@/lib/site";
import { assertDemoCatalogueIntegrity } from "@/services/catalogue";
import {
  getBestSellersFrom,
  getEditorialProductFrom,
  getHomepageFeaturedFrom,
  getNewArrivalsFrom,
  getPopulatedShapesFrom,
  getStorefrontCatalogue,
} from "@/services/storefront-catalogue";
import {
  getAutomaticNewArrivals,
  getFlagshipProduct,
  loadStorefrontMerchandisingConfig,
  productsInOrder,
} from "@/services/storefront-merchandising";

export const metadata: Metadata = {
  ...storefrontMetadata({
    title: site.name,
    description: site.description,
    path: "/",
    index: true,
    follow: true,
    absoluteTitle: true,
  }),
  robots: INDEX_FOLLOW,
};

export const revalidate = 60;

export default async function HomePage() {
  const catalogue = await getStorefrontCatalogue();
  if (catalogue.source === "demo") {
    assertDemoCatalogueIntegrity(catalogue.products);
  }

  const live = catalogue.source === "live";
  const merchandising = live ? await loadStorefrontMerchandisingConfig() : null;
  const featured = (
    merchandising?.featuredEnabled
      ? productsInOrder(catalogue.products, merchandising.featuredIds)
      : live
        ? []
        : getHomepageFeaturedFrom(catalogue.products, 4)
  ).slice(0, 4);
  const bestSellers = (
    merchandising?.bestSellersEnabled
      ? productsInOrder(catalogue.products, merchandising.bestSellerIds)
      : live
        ? []
        : getBestSellersFrom(catalogue.products)
  ).slice(0, 6);
  const newArrivals = live
    ? getAutomaticNewArrivals(catalogue.products, 4)
    : getNewArrivalsFrom(catalogue.products).slice(0, 4);
  const storyProduct = live
    ? getFlagshipProduct(catalogue.products, merchandising?.flagshipId ?? null)
    : getEditorialProductFrom(catalogue.products);

  return (
    <>
    <JsonLd data={organizationJsonLd()} />
    <Homepage
      featured={featured}
      bestSellers={bestSellers}
      newArrivals={newArrivals}
      storyProduct={storyProduct}
      shapes={getPopulatedShapesFrom(catalogue.products)}
      catalogueSource={catalogue.source}
      catalogueUnavailable={catalogue.unavailable}
    />
    </>
  );
}
