import type { Metadata } from "next";
import { BrandIndex } from "@/components/discovery/BrandIndex";
import { routes } from "@/lib/navigation";
import { storefrontMetadata } from "@/lib/seo";
import { requireStorefrontCatalogue } from "@/services/storefront-catalogue";

export const metadata: Metadata = storefrontMetadata({
  title: "Brands",
  description: "Shop SHADESUK sunglasses by brand.",
  path: routes.brands,
});

export default async function BrandsPage() {
  const catalogue = await requireStorefrontCatalogue();
  return <BrandIndex brands={catalogue.brands} />;
}
