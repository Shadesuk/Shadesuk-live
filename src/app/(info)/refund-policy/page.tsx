import type { Metadata } from "next";
import { PolicyDocumentView } from "@/components/info/PolicyDocumentView";
import { REFUND_POLICY } from "@/lib/legal-copy";

export const metadata: Metadata = {
  title: REFUND_POLICY.title,
  description: REFUND_POLICY.description,
  robots: { index: true, follow: true },
};

export default function RefundPolicyRoute() {
  return <PolicyDocumentView document={REFUND_POLICY} />;
}
