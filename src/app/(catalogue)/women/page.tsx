import type { Metadata } from "next";
import { renderCollectionPage } from "@/components/discovery/renderCollectionPage";
import { getCollectionById } from "@/services/collections";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateMetadata(): Metadata {
  return { title: getCollectionById("women")?.title ?? "Women" };
}

export default async function WomenPage({ searchParams }: PageProps) {
  return renderCollectionPage("women", await searchParams);
}
