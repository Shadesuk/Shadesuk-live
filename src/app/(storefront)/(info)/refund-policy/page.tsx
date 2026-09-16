import type { Metadata } from "next";
import { PolicyDocumentView } from "@/components/info/PolicyDocumentView";
import { REFUND_POLICY } from "@/lib/legal-copy";
import { routes } from "@/lib/navigation";
import { storefrontMetadata } from "@/lib/seo";

export const metadata: Metadata = storefrontMetadata({
  title: REFUND_POLICY.title,
  description: REFUND_POLICY.description,
  path: routes.refunds,
});

export default function RefundPolicyRoute() {
  return <PolicyDocumentView document={REFUND_POLICY} />;
}
