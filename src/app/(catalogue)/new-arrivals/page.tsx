import type { Metadata } from "next";
import { renderCollectionPage } from "@/components/discovery/renderCollectionPage";
import { routes } from "@/lib/navigation";
import { cataloguePathMetadata } from "@/lib/seo";
import { getCollectionById } from "@/services/collections";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const collection = getCollectionById("new-arrivals");
  return cataloguePathMetadata({
    title: collection?.title ?? "New arrivals",
    description: collection?.description ?? "Recently added shades.",
    path: routes.newArrivals,
    searchParams: await searchParams,
  });
}

export default async function NewArrivalsPage({ searchParams }: PageProps) {
  return renderCollectionPage("new-arrivals", await searchParams);
}
