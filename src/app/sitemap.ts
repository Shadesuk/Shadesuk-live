import type { MetadataRoute } from "next";
import { INFO_PAGES } from "@/lib/legal-copy";
import { brandPath, productPath, routes } from "@/lib/navigation";
import { absoluteUrl } from "@/lib/seo";
import { site } from "@/lib/site";
import { getCollections } from "@/services/collections";
import { listPublishedAssignedCollections } from "@/services/storefront-collections";
import { getStorefrontCatalogue } from "@/services/storefront-catalogue";

type SitemapEntry = MetadataRoute.Sitemap[number];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const catalogue = await getStorefrontCatalogue();

  const assignedCollections =
    catalogue.source === "live"
      ? await listPublishedAssignedCollections(catalogue.products)
      : [];

  const staticRoutes: MetadataRoute.Sitemap = [
    entry({
      url: site.url,
      changeFrequency: "weekly",
      priority: 1,
    }),
    ...[
      routes.shop,
      routes.men,
      routes.women,
      routes.unisex,
      routes.newArrivals,
      routes.bestSellers,
      routes.collections,
      routes.brands,
    ].map((path) =>
      entry({
        url: absoluteUrl(path),
        changeFrequency: "daily",
        priority: 0.8,
      }),
    ),
    ...getCollections()
      .filter((collection) => collection.kind === "shape")
      .map((collection) =>
        entry({
          url: absoluteUrl(collection.href),
          changeFrequency: "weekly",
          priority: 0.7,
        }),
      ),
    ...assignedCollections.map((collection) =>
      entry(
        {
          url: absoluteUrl(collection.href),
          changeFrequency: "weekly",
          priority: 0.7,
        },
        collection.updatedAt,
      ),
    ),
    ...INFO_PAGES.map((page) =>
      entry({
        url: absoluteUrl(page.href),
        changeFrequency: "monthly",
        priority: 0.4,
      }),
    ),
  ];

  if (catalogue.source !== "live") {
    return staticRoutes;
  }

  const brands = catalogue.brands
    .filter((brand) => brand.status === "active")
    .map((brand) =>
      entry({
        url: absoluteUrl(brandPath(brand.slug)),
        changeFrequency: "weekly",
        priority: 0.6,
      }),
    );

  const products = catalogue.products
    .filter((product) => !isSitemapTestProduct(product))
    .map((product) =>
      entry(
        {
          url: absoluteUrl(productPath(product.slug)),
          changeFrequency: "daily",
          priority: 0.9,
        },
        product.updatedAt,
      ),
    );

  return [...staticRoutes, ...brands, ...products];
}

function isSitemapTestProduct(product: { slug: string; isDemo: boolean }): boolean {
  if (product.isDemo) {
    return true;
  }
  return /^test\d*$/i.test(product.slug.trim());
}

function entry(item: Omit<SitemapEntry, "lastModified">, updatedAt?: string): SitemapEntry {
  const lastModified = updatedAt ? parseTimestamp(updatedAt) : undefined;
  return lastModified ? { ...item, lastModified } : item;
}

function parseTimestamp(value: string): Date | undefined {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
