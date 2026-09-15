import type { Metadata } from "next";
import { renderCollectionPage } from "@/components/discovery/renderCollectionPage";
import { routes } from "@/lib/navigation";
import { cataloguePathMetadata } from "@/lib/seo";
import { getCollectionById } from "@/services/collections";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const collection = getCollectionById("best-sellers");
  return cataloguePathMetadata({
    title: collection?.title ?? "Best sellers",
    description: collection?.description ?? "Shades with established demand.",
    path: routes.bestSellers,
    searchParams: await searchParams,
  });
}

export default async function BestSellersPage({ searchParams }: PageProps) {
  return renderCollectionPage("best-sellers", await searchParams);
}
