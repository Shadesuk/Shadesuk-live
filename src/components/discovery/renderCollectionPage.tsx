import { notFound } from "next/navigation";
import { CollectionTemplate } from "@/components/discovery/CollectionTemplate";
import {
  getCollectionById,
  getCollectionBySlug,
  parseCollectionQuery,
  queryCollection,
} from "@/services/collections";

type SearchParams = Record<string, string | string[] | undefined>;

export function renderCollectionPage(
  collectionId: string,
  searchParams: SearchParams,
) {
  const collection = getCollectionById(collectionId);
  if (!collection) {
    notFound();
  }
  return renderResolvedCollection(collection, searchParams);
}

export function renderCollectionBySlug(
  slug: string,
  searchParams: SearchParams,
) {
  const collection = getCollectionBySlug(slug);
  if (!collection) {
    notFound();
  }
  return renderResolvedCollection(collection, searchParams);
}

function renderResolvedCollection(
  collection: NonNullable<ReturnType<typeof getCollectionById>>,
  searchParams: SearchParams,
) {
  const query = parseCollectionQuery(searchParams);
  const result = queryCollection(collection, query);

  return (
    <CollectionTemplate
      collection={collection}
      query={query}
      products={result.products}
      total={result.total}
      hasMore={result.hasMore}
      filterOptions={result.filterOptions}
    />
  );
}
