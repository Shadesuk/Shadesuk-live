import type { Metadata } from "next";
import { ProductPage } from "@/components/pdp/ProductPage";
import { getStorefrontCatalogue } from "@/services/storefront-catalogue";
import { getStorefrontProductPage } from "@/services/product";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateStaticParams() {
  const catalogue = await getStorefrontCatalogue();
  return catalogue.products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const record = await getStorefrontProductPage(slug);
  if (!record) {
    return { title: "Product" };
  }
  return {
    title: record.product.name,
    description: record.product.description,
  };
}

export default async function ProductSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const record = await getStorefrontProductPage(slug);
  if (!record) {
    notFound();
  }
  return <ProductPage record={record} />;
}
