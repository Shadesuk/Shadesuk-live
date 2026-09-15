import type { Metadata } from "next";
import { Homepage } from "@/components/home/Homepage";
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

export const metadata: Metadata = {
  title: {
    absolute: site.name,
  },
  description: site.description,
  robots: {
    index: true,
    follow: true,
  },
};

export const revalidate = 60;

export default async function HomePage() {
  const catalogue = await getStorefrontCatalogue();
  if (catalogue.source === "demo") {
    assertDemoCatalogueIntegrity(catalogue.products);
  }

  return (
    <Homepage
      featured={getHomepageFeaturedFrom(catalogue.products, 4)}
      bestSellers={getBestSellersFrom(catalogue.products)}
      newArrivals={getNewArrivalsFrom(catalogue.products).slice(0, 4)}
      storyProduct={getEditorialProductFrom(catalogue.products)}
      shapes={getPopulatedShapesFrom(catalogue.products)}
    />
  );
}
