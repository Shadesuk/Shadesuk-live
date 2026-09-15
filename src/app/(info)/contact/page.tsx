import type { Metadata } from "next";
import { ContactPage } from "@/components/info/ContactPage";
import { CONTACT_DESCRIPTION, CONTACT_TITLE } from "@/lib/legal-copy";
import { routes } from "@/lib/navigation";
import { storefrontMetadata } from "@/lib/seo";

export const metadata: Metadata = storefrontMetadata({
  title: CONTACT_TITLE,
  description: CONTACT_DESCRIPTION,
  path: routes.contact,
});

export default function ContactRoute() {
  return <ContactPage />;
}
