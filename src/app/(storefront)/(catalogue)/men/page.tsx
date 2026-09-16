import type { Metadata } from "next";
import { renderCollectionPage } from "@/components/discovery/renderCollectionPage";
import { routes } from "@/lib/navigation";
import { cataloguePathMetadata } from "@/lib/seo";
import { getCollectionById } from "@/services/collections";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const collection = getCollectionById("men");
  return cataloguePathMetadata({
    title: collection?.title ?? "Men",
    description: collection?.description ?? "Men's sunglasses.",
    path: routes.men,
    searchParams: await searchParams,
  });
}

export default async function MenPage({ searchParams }: PageProps) {
  return renderCollectionPage("men", await searchParams);
}
