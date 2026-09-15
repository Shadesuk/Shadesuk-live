import type { Metadata } from "next";
import { ProductPage } from "@/components/pdp/ProductPage";
import { JsonLd } from "@/components/seo/JsonLd";
import { productPath } from "@/lib/navigation";
import { getProductBrandName, getPrimaryImage } from "@/lib/product-display";
import {
  NOINDEX_NOFOLLOW,
  absoluteUrl,
  productJsonLd,
  storefrontMetadata,
} from "@/lib/seo";
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
    return { title: "Product", robots: NOINDEX_NOFOLLOW };
  }
  const brand = getProductBrandName(record.product);
  const image = getPrimaryImage(record.product);
  const description =
    record.product.description?.trim() ||
    `${record.product.name}${brand ? ` by ${brand}` : ""}.`;
  return storefrontMetadata({
    title: record.product.name,
    description,
    path: productPath(record.product.slug),
    image:
      image?.src
        ? {
            url: image.src,
            alt: image.alt,
            width: image.width,
            height: image.height,
          }
        : undefined,
  });
}

export default async function ProductSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const record = await getStorefrontProductPage(slug);
  if (!record) {
    notFound();
  }
  const url = absoluteUrl(productPath(record.product.slug));
  return (
    <>
      <JsonLd data={productJsonLd(record.product, url)} />
      <ProductPage record={record} />
    </>
  );
}
