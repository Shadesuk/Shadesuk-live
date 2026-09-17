import type { Metadata } from "next";
import { renderCollectionBySlug } from "@/components/discovery/renderCollectionPage";
import { getCollectionBySlug } from "@/services/collections";
import { loadPublishedAssignedCollection } from "@/services/storefront-collections";
import { NOINDEX_NOFOLLOW, cataloguePathMetadata } from "@/lib/seo";
import { SHAPES } from "@/types/catalogue";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return SHAPES.map((slug) => ({ slug }));
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection =
    getCollectionBySlug(slug) ?? (await loadPublishedAssignedCollection(slug));
  if (!collection) {
    return { title: "Collection", robots: NOINDEX_NOFOLLOW };
  }
  return cataloguePathMetadata({
    title: collection.title,
    description: collection.description ?? `${collection.title} sunglasses from SHADESUK.`,
    path: collection.href,
    searchParams: await searchParams,
  });
}

export default async function CollectionSlugPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  return renderCollectionBySlug(slug, await searchParams);
}
