import { notFound } from "next/navigation";
import { CollectionTemplate } from "@/components/discovery/CollectionTemplate";
import {
  getBrandCollectionBySlug,
  getCollectionById,
  getCollectionBySlug,
  parseCollectionQuery,
  queryCollectionFromSnapshot,
} from "@/services/collections";
import { requireStorefrontCatalogue, type StorefrontCatalogue } from "@/services/storefront-catalogue";
import type { CollectionDefinition } from "@/types/collection";

type SearchParams = Record<string, string | string[] | undefined>;

export async function renderCollectionPage(
  collectionId: string,
  searchParams: SearchParams,
) {
  const collection = getCollectionById(collectionId);
  if (!collection) {
    notFound();
  }
  return renderResolvedCollection(collection, searchParams);
}

export async function renderCollectionBySlug(
  slug: string,
  searchParams: SearchParams,
) {
  const collection = getCollectionBySlug(slug);
  if (!collection) {
    notFound();
  }
  return renderResolvedCollection(collection, searchParams);
}

export async function renderBrandPage(
  slug: string,
  searchParams: SearchParams,
) {
  const snapshot = await requireStorefrontCatalogue();
  const collection = getBrandCollectionBySlug(slug, snapshot.brands);
  if (!collection) {
    notFound();
  }
  return renderResolvedCollection(collection, searchParams, snapshot);
}

async function renderResolvedCollection(
  collection: CollectionDefinition,
  searchParams: SearchParams,
  snapshot?: StorefrontCatalogue,
) {
  const catalogue = snapshot ?? (await requireStorefrontCatalogue());
  const query = parseCollectionQuery(searchParams);
  const result = queryCollectionFromSnapshot(collection, query, catalogue);

  return (
    <CollectionTemplate
      collection={collection}
      query={query}
      products={result.products}
      total={result.total}
      hasMore={result.hasMore}
      filterOptions={result.filterOptions}
      catalogueSource={catalogue.source}
    />
  );
}
