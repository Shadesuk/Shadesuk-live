import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductPage } from "@/components/pdp/ProductPage";
import { getProducts } from "@/services/catalogue";
import { getStorefrontProductPage } from "@/services/product";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = true;

export function generateStaticParams() {
  return getProducts().map((product) => ({ slug: product.slug }));
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
