import type { Metadata } from "next";
import { PolicyDocumentView } from "@/components/info/PolicyDocumentView";
import { PRIVACY_POLICY } from "@/lib/legal-copy";

export const metadata: Metadata = {
  title: PRIVACY_POLICY.title,
  description: PRIVACY_POLICY.description,
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyRoute() {
  return <PolicyDocumentView document={PRIVACY_POLICY} />;
}
