import type { Metadata } from "next";
import { renderCollectionBySlug } from "@/components/discovery/renderCollectionPage";
import { getCollectionBySlug } from "@/services/collections";
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
  return { title: collection?.title ?? "Collection" };
}

export default async function CollectionSlugPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  return renderCollectionBySlug(slug, await searchParams);
}
