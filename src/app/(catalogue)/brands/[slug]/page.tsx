import type { Metadata } from "next";
import { renderBrandPage } from "@/components/discovery/renderCollectionPage";
import { brandPath } from "@/lib/navigation";
import { NOINDEX_NOFOLLOW, cataloguePathMetadata } from "@/lib/seo";
import { getStorefrontCatalogue } from "@/services/storefront-catalogue";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateStaticParams() {
  const catalogue = await getStorefrontCatalogue();
  return catalogue.brands
    .filter((brand) => brand.status === "active")
    .map((brand) => ({ slug: brand.slug }));
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const catalogue = await getStorefrontCatalogue();
  const brand = catalogue.brands.find(
    (item) => item.slug === slug && item.status === "active",
  );
  if (!brand) {
    return { title: "Brand", robots: NOINDEX_NOFOLLOW };
  }
  return cataloguePathMetadata({
    title: brand.name,
    description: brand.description?.trim() || `${brand.name} sunglasses from SHADESUK.`,
    path: brandPath(brand.slug),
    searchParams: await searchParams,
  });
}

export default async function BrandPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  return renderBrandPage(slug, await searchParams);
}
