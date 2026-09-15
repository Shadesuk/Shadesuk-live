import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { SiteChrome } from "@/components/navigation/SiteChrome";
import { getPublicCart } from "@/services/cart";
import { getSearchDiscoveryLinks } from "@/services/search";
import {
  getMenuBrandLinksFromCatalogue,
  getStorefrontCatalogue,
} from "@/services/storefront-catalogue";
import { site } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.name,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [initialCart, catalogue] = await Promise.all([
    getPublicCart(),
    getStorefrontCatalogue(),
  ]);
  const searchDiscovery = getSearchDiscoveryLinks(catalogue.brands);
  const brandLinks = getMenuBrandLinksFromCatalogue(catalogue.brands);

  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteChrome
          initialCart={initialCart}
          brandLinks={brandLinks}
          searchDiscovery={searchDiscovery}
        >
          {children}
        </SiteChrome>
      </body>
    </html>
  );
}
