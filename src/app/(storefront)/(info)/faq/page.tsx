import type { Metadata } from "next";
import { FaqPage } from "@/components/info/FaqPage";
import { JsonLd } from "@/components/seo/JsonLd";
import { FAQ_DESCRIPTION, FAQ_GROUPS, FAQ_TITLE } from "@/lib/legal-copy";
import { routes } from "@/lib/navigation";
import { faqJsonLd, storefrontMetadata } from "@/lib/seo";

export const metadata: Metadata = storefrontMetadata({
  title: FAQ_TITLE,
  description: FAQ_DESCRIPTION,
  path: routes.faq,
});

export default function FaqRoute() {
  return (
    <>
      <JsonLd data={faqJsonLd(FAQ_GROUPS)} />
      <FaqPage />
    </>
  );
}
