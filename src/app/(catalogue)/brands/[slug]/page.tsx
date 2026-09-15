import type { Metadata } from "next";
import { renderBrandPage } from "@/components/discovery/renderCollectionPage";
import { getStorefrontCatalogue } from "@/services/storefront-catalogue";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamicParams = true;

export async function generateStaticParams() {
  const catalogue = await getStorefrontCatalogue();
  return catalogue.brands
    .filter((brand) => brand.status === "active")
    .map((brand) => ({ slug: brand.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const catalogue = await getStorefrontCatalogue();
  const brand = catalogue.brands.find(
    (item) => item.slug === slug && item.status === "active",
  );
  if (!brand) {
    return { title: "Brand" };
  }
  return { title: brand.name };
}

export default async function BrandPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  return renderBrandPage(slug, await searchParams);
}
