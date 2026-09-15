import type { Metadata } from "next";
import { renderCollectionPage } from "@/components/discovery/renderCollectionPage";
import { routes } from "@/lib/navigation";
import { cataloguePathMetadata } from "@/lib/seo";
import { getCollectionById } from "@/services/collections";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const collection = getCollectionById("unisex");
  return cataloguePathMetadata({
    title: collection?.title ?? "Unisex",
    description: collection?.description ?? "Unisex sunglasses.",
    path: routes.unisex,
    searchParams: await searchParams,
  });
}

export default async function UnisexPage({ searchParams }: PageProps) {
  return renderCollectionPage("unisex", await searchParams);
}
