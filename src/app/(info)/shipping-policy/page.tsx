import type { Metadata } from "next";
import { PolicyDocumentView } from "@/components/info/PolicyDocumentView";
import { SHIPPING_POLICY } from "@/lib/legal-copy";

export const metadata: Metadata = {
  title: SHIPPING_POLICY.title,
  description: SHIPPING_POLICY.description,
  robots: { index: true, follow: true },
};

export default function ShippingPolicyRoute() {
  return <PolicyDocumentView document={SHIPPING_POLICY} />;
}
