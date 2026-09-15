import type { Metadata } from "next";
import { PolicyDocumentView } from "@/components/info/PolicyDocumentView";
import { TERMS } from "@/lib/legal-copy";

export const metadata: Metadata = {
  title: TERMS.title,
  description: TERMS.description,
  robots: { index: true, follow: true },
};

export default function TermsRoute() {
  return <PolicyDocumentView document={TERMS} />;
}
