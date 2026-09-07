import type { Metadata } from "next";
import { renderCollectionPage } from "@/components/discovery/renderCollectionPage";
import { getCollectionById } from "@/services/collections";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata(): Metadata {
  return { title: getCollectionById("best-sellers")?.title ?? "Best sellers" };
}

export default async function BestSellersPage({ searchParams }: PageProps) {
  return renderCollectionPage("best-sellers", await searchParams);
}
