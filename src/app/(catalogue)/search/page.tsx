import type { Metadata } from "next";
import { CollectionTemplate } from "@/components/discovery/CollectionTemplate";
import { SearchEmptyState } from "@/components/search/SearchEmptyState";
import { SearchLanding } from "@/components/search/SearchLanding";
import { parseCollectionQuery, queryCollection } from "@/services/collections";
import { getSearchCollection, searchProducts } from "@/services/search";

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

  if (!q) {
    return <SearchLanding />;
  }

  const found = searchProducts(q);
  const collection = getSearchCollection(q, found.correctedTo);
  const result = queryCollection(collection, query, found.products);
  const noHits = found.products.length === 0;

  return (
    <CollectionTemplate
      collection={collection}
      query={query}
      products={result.products}
      total={result.total}
      hasMore={result.hasMore}
      filterOptions={result.filterOptions}
      emptyContent={
        noHits ? <SearchEmptyState query={found.correctedTo ?? q} /> : undefined
      }
    />
  );
}
