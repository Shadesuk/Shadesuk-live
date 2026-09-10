import type { Metadata } from "next";
import { renderBrandPage } from "@/components/discovery/renderCollectionPage";
import { getBrandBySlug, getPublishedBrands } from "@/services/catalogue";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return getPublishedBrands().map((brand) => ({ slug: brand.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const brand = getBrandBySlug(slug);
  if (!brand || brand.status !== "active") {
    return { title: "Brand" };
  }
  return { title: brand.name };
}

export default async function BrandPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  return renderBrandPage(slug, await searchParams);
}
