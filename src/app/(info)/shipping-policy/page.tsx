import type { Metadata } from "next";
import { PolicyDocumentView } from "@/components/info/PolicyDocumentView";
import { SHIPPING_POLICY } from "@/lib/legal-copy";
import { routes } from "@/lib/navigation";
import { storefrontMetadata } from "@/lib/seo";

export const metadata: Metadata = storefrontMetadata({
  title: SHIPPING_POLICY.title,
  description: SHIPPING_POLICY.description,
  path: routes.shipping,
});

export default function ShippingPolicyRoute() {
  return <PolicyDocumentView document={SHIPPING_POLICY} />;
}
