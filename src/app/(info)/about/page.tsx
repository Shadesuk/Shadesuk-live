import type { Metadata } from "next";
import { AboutPage } from "@/components/info/AboutPage";
import { ABOUT_DESCRIPTION, ABOUT_TITLE } from "@/lib/legal-copy";
import { routes } from "@/lib/navigation";
import { storefrontMetadata } from "@/lib/seo";

export const metadata: Metadata = storefrontMetadata({
  title: ABOUT_TITLE,
  description: ABOUT_DESCRIPTION,
  path: routes.about,
});

export default function AboutRoute() {
  return <AboutPage />;
}
