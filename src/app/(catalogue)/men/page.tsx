import type { Metadata } from "next";
import { renderCollectionPage } from "@/components/discovery/renderCollectionPage";
import { getCollectionById } from "@/services/collections";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata(): Metadata {
  return { title: getCollectionById("men")?.title ?? "Men" };
}

export default async function MenPage({ searchParams }: PageProps) {
  return renderCollectionPage("men", await searchParams);
}
