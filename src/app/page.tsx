import type { Metadata } from "next";
import { Homepage } from "@/components/home/Homepage";
import { site } from "@/lib/site";
import {
  assertDemoCatalogueIntegrity,
  getBestSellers,
  getEditorialProduct,
  getHomepageFeatured,
  getNewArrivals,
  getPopulatedShapes,
} from "@/services/catalogue";

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

export default function HomePage() {
  assertDemoCatalogueIntegrity();

  return (
    <Homepage
      featured={getHomepageFeatured(4)}
      bestSellers={getBestSellers()}
      newArrivals={getNewArrivals().slice(0, 4)}
      storyProduct={getEditorialProduct()}
      shapes={getPopulatedShapes()}
    />
  );
}
