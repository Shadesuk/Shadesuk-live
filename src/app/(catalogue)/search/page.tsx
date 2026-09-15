import type { Metadata } from "next";
import { CollectionTemplate } from "@/components/discovery/CollectionTemplate";
import { SearchEmptyState } from "@/components/search/SearchEmptyState";
import { SearchLanding } from "@/components/search/SearchLanding";
import { parseCollectionQuery, queryCollection } from "@/services/collections";
import { getSearchCollection, getSearchDiscoveryLinks, searchProducts } from "@/services/search";
import { requireStorefrontCatalogue } from "@/services/storefront-catalogue";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the SHADESUK catalogue.",
  robots: { index: false, follow: false },
};

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = parseCollectionQuery(params);
  const q = query.q?.trim() ?? "";
  const catalogue = await requireStorefrontCatalogue();

  if (!q) {
    return <SearchLanding discovery={getSearchDiscoveryLinks(catalogue.brands)} />;
  }

  const found = searchProducts(q, {
    products: catalogue.products,
    brands: catalogue.brands,
  });
  const collection = getSearchCollection(q, found.correctedTo);
  const result = queryCollection(
    collection,
    query,
    found.products,
    catalogue.brands,
  );
  const noHits = found.products.length === 0;

  return (
    <CollectionTemplate
      collection={collection}
      query={query}
      products={result.products}
      total={result.total}
      hasMore={result.hasMore}
      filterOptions={result.filterOptions}
      catalogueSource={catalogue.source}
      emptyContent={
        noHits ? <SearchEmptyState query={found.correctedTo ?? q} /> : undefined
      }
    />
  );
}
