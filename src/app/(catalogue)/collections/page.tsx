import type { Metadata } from "next";
import { CollectionsHub } from "@/components/discovery/CollectionsHub";
import { requireStorefrontCatalogue } from "@/services/storefront-catalogue";

export const metadata: Metadata = {
  title: "Collections",
};

export default async function CollectionsIndexPage() {
  const catalogue = await requireStorefrontCatalogue();
  return (
    <CollectionsHub products={catalogue.products} brands={catalogue.brands} />
  );
}
