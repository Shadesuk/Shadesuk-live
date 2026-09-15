import type { Metadata } from "next";
import { AboutPage } from "@/components/info/AboutPage";
import { ABOUT_DESCRIPTION, ABOUT_TITLE } from "@/lib/legal-copy";

export const metadata: Metadata = {
  title: ABOUT_TITLE,
  description: ABOUT_DESCRIPTION,
  robots: { index: true, follow: true },
};

export default function AboutRoute() {
  return <AboutPage />;
}
