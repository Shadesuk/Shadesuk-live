import type { Metadata } from "next";
import { PolicyDocumentView } from "@/components/info/PolicyDocumentView";
import { TERMS } from "@/lib/legal-copy";
import { routes } from "@/lib/navigation";
import { storefrontMetadata } from "@/lib/seo";

export const metadata: Metadata = storefrontMetadata({
  title: TERMS.title,
  description: TERMS.description,
  path: routes.terms,
});

export default function TermsRoute() {
  return <PolicyDocumentView document={TERMS} />;
}
