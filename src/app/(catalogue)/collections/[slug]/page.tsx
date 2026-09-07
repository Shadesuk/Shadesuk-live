import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionTemplate } from "@/components/discovery/CollectionTemplate";
import {
  getCollectionBySlug,
  parseCollectionQuery,
  queryCollection,
} from "@/services/collections";
import { SHAPES } from "@/types/catalogue";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return SHAPES.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = getCollectionBySlug(slug);
  if (!collection) {
    return { title: "Collection" };
  }
  return { title: collection.title };
}

export default async function CollectionSlugPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  const collection = getCollectionBySlug(slug);
  if (!collection) {
    notFound();
  }
  const query = parseCollectionQuery(await searchParams);
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
