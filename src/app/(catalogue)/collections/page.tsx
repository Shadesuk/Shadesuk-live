import type { Metadata } from "next";
import { CollectionsHub } from "@/components/discovery/CollectionsHub";

export const metadata: Metadata = {
  title: "Collections",
};

export default function CollectionsIndexPage() {
  return <CollectionsHub />;
}
