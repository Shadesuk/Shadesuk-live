import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRODUCT_DISCLOSURE_COPY } from "../src/components/pdp/ProductDisclosure";
import {
  COUNTRY_UNSUPPORTED,
  SHIPPING_BODY,
  SHIPPING_MINIMUM,
} from "../src/lib/checkout-copy";
import { CHECKOUT_DRAFT_COOKIE } from "../src/lib/checkout-draft";
import { DEMO_CART_LINES_COOKIE } from "../src/lib/demo-cart-cookie";
import {
  CONSUMER_RIGHTS_HELP_URL,
  ICO_HELP_URL,
  isAllowedHelpHref,
} from "../src/lib/help-url";
import {
  ABOUT_HEADING,
  collectLegalHrefs,
  CONTACT_CHANNEL,
  CONTACT_LEDE,
  COOKIE_POLICY,
  FAQ_GROUPS,
  INFO_PAGES,
  LEGAL_NOTICE,
  PRIVACY_POLICY,
  REFUND_POLICY,
  SHIPPING_POLICY,
  TERMS,
} from "../src/lib/legal-copy";
import { footerNav, primaryNav, routes } from "../src/lib/navigation";
import { TRACKING_LIMITER_COOKIE_NAME } from "../src/lib/tracking-limiter";
import { GUEST_CART_COOKIE_NAME, TRACKING_UNAVAILABLE_COPY } from "../src/contracts";

const root = resolve(process.cwd());

const expectedRoutes = [
  ["about", routes.about, "/about"],
  ["contact", routes.contact, "/contact"],
  ["faq", routes.faq, "/faq"],
  ["shipping", routes.shipping, "/shipping-policy"],
  ["refunds", routes.refunds, "/refund-policy"],
  ["terms", routes.terms, "/terms"],
  ["privacy", routes.privacy, "/privacy-policy"],
  ["cookies", routes.cookies, "/cookie-policy"],
] as const;

for (const [name, actual, expected] of expectedRoutes) {
  if (actual !== expected) {
    throw new Error(`${name} route must stay ${expected}.`);
  }
  const page = resolve(root, `src/app/(info)${expected}/page.tsx`);
  if (!existsSync(page)) {
    throw new Error(`Missing page for ${expected}.`);
  }
}

if (!primaryNav.some((item) => item.href === routes.about && item.label === "About")) {
  throw new Error("Header About must stay wired to /about.");
}

const footer = readFileSync(resolve(root, "src/lib/navigation.ts"), "utf8");
if (!footer.includes("routes.about") || !footer.includes('label: "About"')) {
  throw new Error("Footer About link must stay wired to /about.");
}

const requiredFooter = [
  [routes.faq, "FAQ"],
  [routes.contact, "Contact"],
  [routes.shipping, "Shipping"],
  [routes.refunds, "Returns / Refunds"],
  [routes.terms, "Terms"],
  [routes.privacy, "Privacy"],
  [routes.cookies, "Cookie"],
] as const;

for (const [href, label] of requiredFooter) {
  const found = [...footerNav.help, ...footerNav.company].some(
    (item) => item.href === href && item.label === label,
  );
  if (!found) {
    throw new Error(`Footer must keep ${label} → ${href}.`);
  }
}

if (INFO_PAGES.length !== 8) {
  throw new Error("INFO_PAGES must list the eight sitemap legal/help routes.");
}

if (ABOUT_HEADING !== "Built around the way you see the world.") {
  throw new Error("About heading must stay the locked editorial line.");
}

if (!CONTACT_LEDE.includes("has not been published yet")) {
  throw new Error("Contact must not invent a public email channel.");
}
if (/[A-Z0-9._%+-]+@shadesuk/i.test(CONTACT_LEDE + CONTACT_CHANNEL)) {
  throw new Error("Contact must not invent a SHADESUK email address.");
}

if (!LEGAL_NOTICE.includes("not legal advice")) {
  throw new Error("Policy pages must stay marked as not legal advice.");
}
if (!LEGAL_NOTICE.includes("Company number")) {
  throw new Error("Policy pages must not invent company registration details.");
}

const legalBundle = JSON.stringify({
  SHIPPING_POLICY,
  REFUND_POLICY,
  TERMS,
  PRIVACY_POLICY,
  COOKIE_POLICY,
  FAQ_GROUPS,
});

if (/\b(company number|registered office|VAT)\b[^.]{0,40}\d{6,}/i.test(legalBundle)) {
  throw new Error("Legal copy must not invent registration numbers.");
}
if (/Companies House/i.test(legalBundle) && /\d{8}/.test(legalBundle)) {
  throw new Error("Legal copy must not invent a Companies House number.");
}

if (!SHIPPING_POLICY.lede.includes("2-week") && !SHIPPING_POLICY.lede.includes(SHIPPING_MINIMUM)) {
  throw new Error("Shipping policy must keep the minimum 2-week timeframe.");
}
if (!SHIPPING_POLICY.sections.some((section) => section.paragraphs.includes(SHIPPING_BODY))) {
  throw new Error("Shipping policy must keep the international shipping body copy.");
}
if (!SHIPPING_POLICY.sections.some((section) => section.paragraphs.includes(COUNTRY_UNSUPPORTED))) {
  throw new Error("Shipping policy must keep UK delivery only.");
}

if (!REFUND_POLICY.lede.toLowerCase().includes("statutory")) {
  throw new Error("Refund policy must lead with statutory rights.");
}
if (!legalBundle.includes("Consumer Rights Act 2015")) {
  throw new Error("Refund policy must name the Consumer Rights Act 2015.");
}
if (!legalBundle.includes("cannot take those rights away") && !legalBundle.includes("not removed")) {
  throw new Error("Refund policy must not imply statutory rights can be waived.");
}

if (!TERMS.sections.some((section) => section.paragraphs.some((p) => p.includes(PRODUCT_DISCLOSURE_COPY)))) {
  throw new Error("Terms must keep the locked product disclosure.");
}
if (!FAQ_GROUPS.some((group) => group.items.some((item) => item.paragraphs.some((p) => p.includes(PRODUCT_DISCLOSURE_COPY))))) {
  throw new Error("FAQ must keep the locked product disclosure.");
}
if (!FAQ_GROUPS.some((group) => group.items.some((item) => item.paragraphs.includes(TRACKING_UNAVAILABLE_COPY.heading)))) {
  throw new Error("FAQ must keep TRACKING NOT AVAILABLE YET as a normal state.");
}

for (const cookieName of [
  GUEST_CART_COOKIE_NAME,
  DEMO_CART_LINES_COOKIE,
  CHECKOUT_DRAFT_COOKIE,
  TRACKING_LIMITER_COOKIE_NAME,
]) {
  if (!COOKIE_POLICY.sections.some((section) => section.items?.some((item) => item.includes(cookieName)))) {
    throw new Error(`Cookie policy must name ${cookieName}.`);
  }
}

if (/advertising cookie/i.test(JSON.stringify(COOKIE_POLICY)) === false) {
  throw new Error("Cookie policy must state advertising cookies are not set.");
}

const sitemapSource = readFileSync(resolve(root, "src/app/sitemap.ts"), "utf8");
if (!sitemapSource.includes("INFO_PAGES")) {
  throw new Error("XML sitemap must include the legal/help pages.");
}

const checkoutPage = readFileSync(resolve(root, "src/app/checkout/page.tsx"), "utf8");
if (!checkoutPage.includes("CheckoutPage")) {
  throw new Error("Checkout payment stub route must remain in place.");
}

if (ICO_HELP_URL !== "https://ico.org.uk") {
  throw new Error("ICO help URL must stay the official https address.");
}
if (CONSUMER_RIGHTS_HELP_URL !== "https://www.gov.uk/consumer-protection-rights") {
  throw new Error("Consumer-rights help URL must stay the official https GOV.UK address.");
}
if (isAllowedHelpHref("http://ico.org.uk") || isAllowedHelpHref("http://example.com")) {
  throw new Error("Help hrefs must not allow http.");
}
if (isAllowedHelpHref("//ico.org.uk") || isAllowedHelpHref("javascript:alert(1)")) {
  throw new Error("Help hrefs must reject protocol-relative and non-https schemes.");
}
if (!isAllowedHelpHref(ICO_HELP_URL) || !isAllowedHelpHref(CONSUMER_RIGHTS_HELP_URL) || !isAllowedHelpHref(routes.faq)) {
  throw new Error("https and in-site help hrefs must remain allowed.");
}

const hrefs = collectLegalHrefs();
if (!hrefs.includes(ICO_HELP_URL) || !hrefs.includes(CONSUMER_RIGHTS_HELP_URL)) {
  throw new Error("Privacy and refunds must surface the official https help URLs.");
}
for (const href of hrefs) {
  if (!isAllowedHelpHref(href)) {
    throw new Error(`Legal/help href must be an in-site path or https: ${href}`);
  }
  if (href.startsWith("http://")) {
    throw new Error(`Legal/help pages must not surface http URLs: ${href}`);
  }
}
if (/https?:\/\//i.test(legalBundle)) {
  const found = legalBundle.match(/https?:\/\/[^"\\]+/g) ?? [];
  for (const url of found) {
    if (!url.startsWith("https://")) {
      throw new Error(`Legal copy must not include a non-https URL: ${url}`);
    }
  }
}

console.log("verify-legal: ok");
