import type { Metadata } from "next";
import { FaqPage } from "@/components/info/FaqPage";
import { FAQ_DESCRIPTION, FAQ_TITLE } from "@/lib/legal-copy";
import { routes } from "@/lib/navigation";
import { storefrontMetadata } from "@/lib/seo";

export const metadata: Metadata = storefrontMetadata({
  title: FAQ_TITLE,
  description: FAQ_DESCRIPTION,
  path: routes.faq,
});

export default function FaqRoute() {
  return <FaqPage />;
}
