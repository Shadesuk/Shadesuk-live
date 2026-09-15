import type { Metadata } from "next";
import { CollectionsHub } from "@/components/discovery/CollectionsHub";
import { routes } from "@/lib/navigation";
import { storefrontMetadata } from "@/lib/seo";
import { requireStorefrontCatalogue } from "@/services/storefront-catalogue";

export const metadata: Metadata = storefrontMetadata({
  title: "Collections",
  description: "Shop SHADESUK sunglasses by shape collection.",
  path: routes.collections,
});

export default async function CollectionsIndexPage() {
  const catalogue = await requireStorefrontCatalogue();
  return (
    <CollectionsHub products={catalogue.products} brands={catalogue.brands} />
  );
}
