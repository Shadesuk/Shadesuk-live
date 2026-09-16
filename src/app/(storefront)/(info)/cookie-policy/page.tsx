import type { Metadata } from "next";
import { PolicyDocumentView } from "@/components/info/PolicyDocumentView";
import { COOKIE_POLICY } from "@/lib/legal-copy";
import { routes } from "@/lib/navigation";
import { storefrontMetadata } from "@/lib/seo";

export const metadata: Metadata = storefrontMetadata({
  title: COOKIE_POLICY.title,
  description: COOKIE_POLICY.description,
  path: routes.cookies,
});

export default function CookiePolicyRoute() {
  return <PolicyDocumentView document={COOKIE_POLICY} />;
}
