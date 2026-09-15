import type { Metadata } from "next";
import { ContactPage } from "@/components/info/ContactPage";
import { CONTACT_DESCRIPTION, CONTACT_TITLE } from "@/lib/legal-copy";

export const metadata: Metadata = {
  title: CONTACT_TITLE,
  description: CONTACT_DESCRIPTION,
  robots: { index: true, follow: true },
};

export default function ContactRoute() {
  return <ContactPage />;
}
