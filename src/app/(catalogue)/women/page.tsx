import type { Metadata } from "next";
import { renderCollectionPage } from "@/components/discovery/renderCollectionPage";
import { routes } from "@/lib/navigation";
import { cataloguePathMetadata } from "@/lib/seo";
import { getCollectionById } from "@/services/collections";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const collection = getCollectionById("women");
  return cataloguePathMetadata({
    title: collection?.title ?? "Women",
    description: collection?.description ?? "Women's sunglasses.",
    path: routes.women,
    searchParams: await searchParams,
  });
}

export default async function WomenPage({ searchParams }: PageProps) {
  return renderCollectionPage("women", await searchParams);
}
