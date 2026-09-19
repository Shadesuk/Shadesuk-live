import type { ReactNode } from "react";
import { getOptionalAccountUser } from "@/lib/account-session";
import { SiteChrome } from "@/components/navigation/SiteChrome";
import { getSearchDiscoveryLinks } from "@/services/search";
import { getPublicCart } from "@/services/cart";
import {
  getMenuBrandLinksFromCatalogue,
  getStorefrontCatalogue,
} from "@/services/storefront-catalogue";

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const [initialCart, catalogue, accountUser] = await Promise.all([
    getPublicCart(),
    getStorefrontCatalogue(),
    getOptionalAccountUser(),
  ]);
  const searchDiscovery = getSearchDiscoveryLinks(catalogue.brands);
  const brandLinks = getMenuBrandLinksFromCatalogue(catalogue.brands);

  return (
    <SiteChrome
      initialCart={initialCart}
      brandLinks={brandLinks}
      searchDiscovery={searchDiscovery}
      signedIn={Boolean(accountUser)}
    >
      {children}
    </SiteChrome>
  );
}
