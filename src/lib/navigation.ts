export const routes = {
  home: "/",
  shop: "/shop",
  men: "/men",
  women: "/women",
  unisex: "/unisex",
  newArrivals: "/new-arrivals",
  bestSellers: "/best-sellers",
  collections: "/collections",
  search: "/search",
  brands: "/brands",
  about: "/about",
  account: "/account",
  cart: "/cart",
  checkout: "/checkout",
  faq: "/faq",
  contact: "/contact",
  shipping: "/shipping-policy",
  refunds: "/refund-policy",
  trackOrder: "/track-order",
  terms: "/terms",
  privacy: "/privacy-policy",
  cookies: "/cookie-policy",
} as const;

export const primaryNav = [
  { href: routes.shop, label: "Shop", menu: "shop" as const },
  { href: routes.newArrivals, label: "New Arrivals" },
  { href: routes.bestSellers, label: "Best Sellers" },
  { href: routes.collections, label: "Collections" },
  { href: routes.about, label: "About" },
] as const;

export const genderLinks = [
  { href: routes.men, label: "Men" },
  { href: routes.women, label: "Women" },
  { href: routes.unisex, label: "Unisex" },
] as const;

/** Locked core shapes from the SHADESUK collections / global-components specs. */
export const shapeLinks = [
  { href: "/collections/aviator", label: "Aviator" },
  { href: "/collections/rectangle", label: "Rectangle" },
  { href: "/collections/square", label: "Square" },
  { href: "/collections/round", label: "Round" },
  { href: "/collections/cat-eye", label: "Cat-Eye" },
] as const;

export const footerNav = {
  shop: [
    { href: routes.shop, label: "All Shades" },
    { href: routes.men, label: "Men" },
    { href: routes.women, label: "Women" },
    { href: routes.unisex, label: "Unisex" },
    { href: routes.newArrivals, label: "New Arrivals" },
    { href: routes.bestSellers, label: "Best Sellers" },
    { href: routes.collections, label: "Collections" },
    { href: routes.brands, label: "Brands" },
  ],
  help: [
    { href: routes.faq, label: "FAQ" },
    { href: routes.contact, label: "Contact" },
    { href: routes.shipping, label: "Shipping" },
    { href: routes.refunds, label: "Returns / Refunds" },
    { href: routes.trackOrder, label: "Track Order" },
  ],
  company: [
    { href: routes.about, label: "About" },
    { href: routes.terms, label: "Terms" },
    { href: routes.privacy, label: "Privacy" },
    { href: routes.cookies, label: "Cookie" },
  ],
} as const;

export function productPath(slug: string): string {
  return `/product/${slug}`;
}

export function brandPath(slug: string): string {
  return `/brands/${slug}`;
}

export function isCurrentPath(pathname: string, href: string): boolean {
  if (href === routes.home) {
    return pathname === routes.home;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
