import type { Metadata } from "next";
import { PolicyDocumentView } from "@/components/info/PolicyDocumentView";
import { PRIVACY_POLICY } from "@/lib/legal-copy";
import { routes } from "@/lib/navigation";
import { storefrontMetadata } from "@/lib/seo";

export const metadata: Metadata = storefrontMetadata({
  title: PRIVACY_POLICY.title,
  description: PRIVACY_POLICY.description,
  path: routes.privacy,
});

export default function PrivacyPolicyRoute() {
  return <PolicyDocumentView document={PRIVACY_POLICY} />;
}
