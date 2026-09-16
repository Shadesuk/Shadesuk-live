import type { Metadata } from "next";
import { renderCollectionPage } from "@/components/discovery/renderCollectionPage";
import { routes } from "@/lib/navigation";
import { cataloguePathMetadata } from "@/lib/seo";
import { getCollectionById } from "@/services/collections";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const collection = getCollectionById("shop");
  return cataloguePathMetadata({
    title: collection?.title ?? "All shades",
    description: collection?.description ?? "The full SHADESUK catalogue.",
    path: routes.shop,
    searchParams: await searchParams,
  });
}

export default async function ShopPage({ searchParams }: PageProps) {
  return renderCollectionPage("shop", await searchParams);
}
