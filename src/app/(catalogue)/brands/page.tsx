import type { Metadata } from "next";
import { BrandIndex } from "@/components/discovery/BrandIndex";

export const metadata: Metadata = {
  title: "Brands",
};

export default function BrandsPage() {
  return <BrandIndex />;
}
