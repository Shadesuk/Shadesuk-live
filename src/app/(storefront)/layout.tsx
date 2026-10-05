import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { getOptionalAccountUser } from "@/lib/account-session";
import { SiteChrome } from "@/components/navigation/SiteChrome";
import { COUNTRY_COOKIE, countryFromCookie } from "@/lib/market/country-cookie";
import type { PublicFxRate } from "@/lib/market/prices";
import { loadLatestFxRates } from "@/lib/fx/store";
import { getSearchDiscoveryLinks } from "@/services/search";
import { getPublicCart } from "@/services/cart";
import {
  getMenuBrandLinksFromCatalogue,
  getStorefrontCatalogue,
} from "@/services/storefront-catalogue";
import { CHECKOUT_COUNTRY_GB } from "@/types/checkout";

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const [initialCart, catalogue, accountUser] = await Promise.all([
    getPublicCart(),
    getStorefrontCatalogue(),
    getOptionalAccountUser(),
  ]);
  const searchDiscovery = getSearchDiscoveryLinks(catalogue.brands);
  const brandLinks = getMenuBrandLinksFromCatalogue(catalogue.brands);
  const jar = await cookies();
  const chosen = countryFromCookie(jar.get(COUNTRY_COOKIE)?.value);
  const rates = await readDisplayRates();

  return (
    <SiteChrome
      initialCart={initialCart}
      brandLinks={brandLinks}
      searchDiscovery={searchDiscovery}
      signedIn={Boolean(accountUser)}
      initialCountry={chosen ?? CHECKOUT_COUNTRY_GB}
      countryChosen={chosen != null}
      fxRates={rates}
    >
      {children}
    </SiteChrome>
  );
}

async function readDisplayRates(): Promise<PublicFxRate[]> {
  try {
    const rows = await loadLatestFxRates();
    return rows.map((row) => ({ currency: row.quoteCurrency, rate: row.rate }));
  } catch {
    return [];
  }
}
