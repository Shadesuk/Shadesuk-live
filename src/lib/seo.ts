import type { Metadata } from "next";
import { site } from "@/lib/site";
import { getProductBrandName } from "@/lib/product-display";
import type { Product } from "@/types/catalogue";

export const INDEX_FOLLOW = { index: true, follow: true } as const;
export const NOINDEX_NOFOLLOW = { index: false, follow: false } as const;

const ROBOTS_PRIVATE = [
  "/search",
  "/account",
  "/checkout",
  "/cart",
  "/track-order",
  "/api/",
  "/auth/",
] as const;

export const ROBOTS_DISALLOW = [...ROBOTS_PRIVATE];

export type StorefrontOgType = "website" | "article";

export type StorefrontMetadataInput = {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  follow?: boolean;
  ogType?: StorefrontOgType;
  image?: {
    url: string;
    alt: string;
    width?: number;
    height?: number;
  };
  canonicalPath?: string;
  absoluteTitle?: boolean;
};

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalized, `${site.url}/`).toString();
}

export function hasCatalogueQueryParams(
  searchParams: Record<string, string | string[] | undefined>,
): boolean {
  return Object.values(searchParams).some((value) => {
    if (value == null) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.some((entry) => Boolean(entry?.trim()));
    }
    return Boolean(value.trim());
  });
}

export function storefrontMetadata({
  title,
  description,
  path,
  index = true,
  follow = true,
  ogType = "website",
  image,
  canonicalPath,
  absoluteTitle = false,
}: StorefrontMetadataInput): Metadata {
  const canonical = absoluteUrl(canonicalPath ?? path);
  const robots = { index, follow };
  const ogImages = image
    ? [
        {
          url: image.url,
          alt: image.alt,
          width: image.width,
          height: image.height,
        },
      ]
    : undefined;

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical },
    robots,
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: site.name,
      locale: "en_GB",
      type: ogType,
      images: ogImages,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image.url] : undefined,
    },
  };
}

export function cataloguePathMetadata({
  title,
  description,
  path,
  searchParams,
}: {
  title: string;
  description: string;
  path: string;
  searchParams?: Record<string, string | string[] | undefined>;
}): Metadata {
  const filtered = searchParams ? hasCatalogueQueryParams(searchParams) : false;
  return storefrontMetadata({
    title,
    description,
    path,
    canonicalPath: path,
    index: !filtered,
    follow: true,
  });
}

export function privatePathMetadata(
  title: string,
  description: string,
  path: string,
): Metadata {
  return storefrontMetadata({
    title,
    description,
    path,
    index: false,
    follow: false,
  });
}

export function productOfferAvailability(
  availability: Product["availability"],
): string {
  if (availability === "in_stock") {
    return "https://schema.org/InStock";
  }
  if (availability === "sold_out") {
    return "https://schema.org/SoldOut";
  }
  return "https://schema.org/OutOfStock";
}

export function productJsonLd(product: Product, url: string): Record<string, unknown> {
  const brandName = getProductBrandName(product);
  const images = product.images
    .map((item) => item.src)
    .filter((src): src is string => Boolean(src));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    brand: brandName
      ? {
          "@type": "Brand",
          name: brandName,
        }
      : undefined,
    description: product.description || undefined,
    sku: product.variants?.find((variant) => variant.sku)?.sku || undefined,
    image: images.length > 0 ? images : undefined,
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: product.currency,
      price: product.price,
      availability: productOfferAvailability(product.availability),
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}
