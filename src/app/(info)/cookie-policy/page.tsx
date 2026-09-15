import type { Metadata } from "next";
import { PolicyDocumentView } from "@/components/info/PolicyDocumentView";
import { COOKIE_POLICY } from "@/lib/legal-copy";

export const metadata: Metadata = {
  title: COOKIE_POLICY.title,
  description: COOKIE_POLICY.description,
  robots: { index: true, follow: true },
};

export default function CookiePolicyRoute() {
  return <PolicyDocumentView document={COOKIE_POLICY} />;
}
