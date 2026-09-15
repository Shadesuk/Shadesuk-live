import type { Metadata } from "next";
import { FaqPage } from "@/components/info/FaqPage";
import { FAQ_DESCRIPTION, FAQ_TITLE } from "@/lib/legal-copy";

export const metadata: Metadata = {
  title: FAQ_TITLE,
  description: FAQ_DESCRIPTION,
  robots: { index: true, follow: true },
};

export default function FaqRoute() {
  return <FaqPage />;
}
