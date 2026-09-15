import type { Metadata } from "next";
import { BrandIndex } from "@/components/discovery/BrandIndex";
import { requireStorefrontCatalogue } from "@/services/storefront-catalogue";

export const metadata: Metadata = {
  title: "Brands",
};

export default async function BrandsPage() {
  const catalogue = await requireStorefrontCatalogue();
  return <BrandIndex brands={catalogue.brands} />;
}
