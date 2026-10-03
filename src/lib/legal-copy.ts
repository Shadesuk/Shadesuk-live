import { PRODUCT_DISCLOSURE_COPY } from "@/components/pdp/ProductDisclosure";
import {
  COUNTRY_UNSUPPORTED,
  SHIPPING_BODY,
  SHIPPING_MANUAL_NOTE,
  SHIPPING_MINIMUM,
} from "@/lib/checkout-copy";
import {
  CONSUMER_RIGHTS_HELP_URL,
  ICO_HELP_URL,
} from "@/lib/help-url";
import { routes } from "@/lib/navigation";
import { TRACKING_UNAVAILABLE_COPY } from "@/contracts";

export const LEGAL_AS_OF = "15 September 2026";

export const LEGAL_NOTICE = `This page describes current storefront practice as of ${LEGAL_AS_OF}. It is not legal advice. Company number, VAT number, and registered office will be published here when they are confirmed.`;

export type InfoLink = {
  href: string;
  label: string;
};

export type PolicySection = {
  id: string;
  title: string;
  paragraphs: string[];
  items?: string[];
  link?: InfoLink;
};

export type PolicyDocument = {
  title: string;
  description: string;
  lede: string;
  notice: string;
  sections: PolicySection[];
  related: InfoLink[];
};

export type FaqItem = {
  question: string;
  paragraphs: string[];
  link?: InfoLink;
};

export type FaqGroup = {
  id: string;
  title: string;
  items: FaqItem[];
};

export const ABOUT_TITLE = "About";
export const ABOUT_HEADING = "Built around the way you see the world.";
export const ABOUT_LEDE = "Modern eyewear. Quiet, confident, product-led.";
export const ABOUT_DESCRIPTION =
  "SHADESUK is a UK eyewear storefront. The catalogue is curated. Delivery into the United Kingdom is expected to take a minimum of two weeks.";

export const ABOUT_POINTS = [
  {
    id: "catalogue",
    title: "The catalogue",
    body: "Sunglasses, organised by shape, colour, and silhouette. Product facts come from the catalogue. Missing measurements are omitted, not invented.",
  },
  {
    id: "delivery",
    title: "Delivery",
    body: "Orders travel internationally into the United Kingdom. Delivery is expected to take a minimum of two weeks. Tracking appears after dispatch.",
  },
  {
    id: "disclosure",
    title: "Disclosure",
    body: `Every product page carries the same line: ${PRODUCT_DISCLOSURE_COPY}. It sits on the product, not in a review or a campaign statistic.`,
  },
] as const;

export const ABOUT_CTA = "Shop all shades";

export const CONTACT_TITLE = "Contact";
export const CONTACT_LEDE =
  "Help for orders, delivery, and the catalogue. A public email address has not been published yet.";
export const CONTACT_DESCRIPTION =
  "SHADESUK contact and order help. Track an order, read the FAQ, or review shipping and returns.";
export const CONTACT_CHANNEL =
  "Do not send order or payment details to unofficial addresses. When a public channel is published, it will be listed here with a response expectation.";

export const CONTACT_PATHWAYS: Array<InfoLink & { body: string }> = [
  {
    href: routes.trackOrder,
    label: "Track order",
    body: "Use your order reference and the email used at checkout. An account is not required.",
  },
  {
    href: routes.faq,
    label: "FAQ",
    body: "Orders, shipping, products, payment, returns, and tracking.",
  },
  {
    href: routes.shipping,
    label: "Shipping",
    body: SHIPPING_MINIMUM,
  },
  {
    href: routes.refunds,
    label: "Returns / Refunds",
    body: "Statutory UK consumer rights are not removed by store policy.",
  },
  {
    href: routes.account,
    label: "Account",
    body: "Optional. Sign in only if you already have an account, or create one when you want to.",
  },
];

export const FAQ_TITLE = "FAQ";
export const FAQ_LEDE = "Straight answers to the questions the store actually raises.";
export const FAQ_DESCRIPTION =
  "SHADESUK help: guest checkout, UK delivery, product disclosure, returns, and order tracking.";

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "orders",
    title: "Orders",
    items: [
      {
        question: "Do I need an account to order?",
        paragraphs: [
          "No. Guest checkout is available. An account is optional, for repeat shopping.",
        ],
        link: { href: routes.account, label: "Account" },
      },
      {
        question: "How do I find an existing order?",
        paragraphs: [
          "Use Track order with the four-digit order reference and the email used at checkout. The reference on its own will not open an order.",
        ],
        link: { href: routes.trackOrder, label: "Track order" },
      },
      {
        question: "Can I cancel an order?",
        paragraphs: [
          "You can request cancellation from your account order, or from Track order after your email is verified, within 12 hours of placing the order and only before we confirm dispatch. Whichever of those happens first closes the request.",
          "That operational window does not remove the 14-day cancellation right under the Consumer Contracts Regulations 2013, or other statutory UK consumer rights.",
        ],
        link: { href: routes.refunds, label: "Returns / Refunds" },
      },
    ],
  },
  {
    id: "account",
    title: "Account",
    items: [
      {
        question: "Do I need an account to track an order?",
        paragraphs: [
          "No. Track order asks for the order reference and the email used at checkout. An account shows the same orders when you were signed in at checkout.",
        ],
        link: { href: routes.trackOrder, label: "Track order" },
      },
    ],
  },
  {
    id: "shipping",
    title: "Shipping",
    items: [
      {
        question: "How long does delivery take?",
        paragraphs: [SHIPPING_MINIMUM, SHIPPING_BODY, "We do not promise an exact delivery date."],
        link: { href: routes.shipping, label: "Shipping policy" },
      },
      {
        question: "Do you deliver outside the United Kingdom?",
        paragraphs: [COUNTRY_UNSUPPORTED],
      },
      {
        question: "Why is shipping international?",
        paragraphs: [SHIPPING_MANUAL_NOTE],
      },
    ],
  },
  {
    id: "products",
    title: "Products",
    items: [
      {
        question: "How do I check fit?",
        paragraphs: [
          "Use Size & Face Guide on the product page. Measurements are shown only when they exist for that product.",
        ],
      },
      {
        question: "What does the product disclosure mean?",
        paragraphs: [
          `Every product page displays the same disclosure: ${PRODUCT_DISCLOSURE_COPY}.`,
          "It is not a review, a designer-house affiliation, or a fabricated origin story.",
        ],
      },
    ],
  },
  {
    id: "payments",
    title: "Payments",
    items: [
      {
        question: "How do I pay?",
        paragraphs: [
          "Checkout takes payment with PayPal. SHADESUK does not store raw card numbers. PayPal handles the payment.",
          "An order is confirmed only after our server verifies the payment. A browser message on its own is not proof that the order is paid.",
        ],
      },
    ],
  },
  {
    id: "returns",
    title: "Returns / Refunds",
    items: [
      {
        question: "Can I return an item?",
        paragraphs: [
          "UK consumer rights apply to these purchases. A commercial returns process does not remove those rights.",
          "Return postage is not prepaid. Where the law requires us to cover the cost, including faulty or not-as-described goods, we will. This page does not invent a restocking fee.",
        ],
        link: { href: routes.refunds, label: "Returns / Refunds policy" },
      },
      {
        question: "What if the parcel arrives damaged?",
        paragraphs: [
          "Tell us promptly, with photographs of the product and packaging where you have them. An unboxing video is useful evidence. It is not the only proof we will look at.",
          "We aim to review that evidence within 2–3 business days. The outcome is recorded against the order. This does not remove statutory UK consumer rights.",
        ],
        link: { href: routes.contact, label: "Contact" },
      },
    ],
  },
  {
    id: "tracking",
    title: "Order tracking",
    items: [
      {
        question: "Can I track without an account?",
        paragraphs: [
          "Yes. Track order with the order reference and the email used at checkout.",
        ],
        link: { href: routes.trackOrder, label: "Track order" },
      },
      {
        question: "There is no tracking yet.",
        paragraphs: [TRACKING_UNAVAILABLE_COPY.heading, TRACKING_UNAVAILABLE_COPY.body],
      },
    ],
  },
];

const COMPANY_PLACEHOLDER =
  "SHADESUK is the name of this UK eyewear storefront. Company number, VAT number, and registered office are not published here yet. Do not treat any other number or address as ours.";

export const SHIPPING_POLICY: PolicyDocument = {
  title: "Shipping policy",
  description:
    "SHADESUK shipping: United Kingdom delivery, a minimum 2-week timeframe, and tracking after dispatch.",
  lede: SHIPPING_MINIMUM,
  notice: LEGAL_NOTICE,
  related: [
    { href: routes.refunds, label: "Returns / Refunds" },
    { href: routes.faq, label: "FAQ" },
    { href: routes.trackOrder, label: "Track order" },
  ],
  sections: [
    {
      id: "destination",
      title: "Where we deliver",
      paragraphs: [COUNTRY_UNSUPPORTED],
    },
    {
      id: "timeframe",
      title: "Timeframe",
      paragraphs: [
        SHIPPING_BODY,
        "Transit times vary. An estimated week range is not a guaranteed arrival date.",
      ],
    },
    {
      id: "origin",
      title: "How orders travel",
      paragraphs: [
        SHIPPING_MANUAL_NOTE,
        "Parcels may originate outside the United Kingdom. The site does not assume a single carrier for the whole journey.",
      ],
    },
    {
      id: "charges",
      title: "Import charges",
      paragraphs: [
        "International parcels can attract import charges. This page does not claim that every shipment arrives duty-paid.",
        "If a charge applies to a specific order, it will be stated against that order — not invented here.",
      ],
    },
    {
      id: "tracking",
      title: "Tracking",
      paragraphs: [
        "Tracking appears after dispatch. Until then, tracking not available yet is expected.",
        "When a tracking URL is available, it is shown on Track order.",
      ],
    },
  ],
};

export const REFUND_POLICY: PolicyDocument = {
  title: "Returns / Refunds",
  description:
    "SHADESUK returns and refunds. UK statutory consumer rights remain. Commercial timeframes are marked where legal review is still required.",
  lede: "Statutory UK consumer rights are not removed by this page.",
  notice: LEGAL_NOTICE,
  related: [
    { href: routes.shipping, label: "Shipping" },
    { href: routes.terms, label: "Terms" },
    { href: routes.contact, label: "Contact" },
  ],
  sections: [
    {
      id: "statutory",
      title: "Your legal rights",
      paragraphs: [
        "If you buy as a consumer in the United Kingdom, the Consumer Rights Act 2015 applies. Goods must be as described, of satisfactory quality, and fit for purpose.",
        "A short commercial returns window, if one is later confirmed, cannot take those rights away.",
      ],
      link: {
        href: CONSUMER_RIGHTS_HELP_URL,
        label: "GOV.UK consumer protection",
      },
    },
    {
      id: "cancellation",
      title: "Cancelling a distance contract",
      paragraphs: [
        "Most online purchases also carry a 14-day cancellation right under the Consumer Contracts Regulations 2013, unless an exemption applies.",
        "Whether a particular item is exempt is a legal question. This page does not invent an exemption to avoid returns.",
      ],
    },
    {
      id: "faulty",
      title: "If something is wrong",
      paragraphs: [
        "If an item is faulty, not as described, or not fit for purpose, tell us using Track order with the email used at checkout.",
        "A worn pair may still be returnable where the law requires it. We will not treat a hygiene preference as a waiver of statutory rights.",
      ],
    },
    {
      id: "cancel-window",
      title: "Requesting cancellation before dispatch",
      paragraphs: [
        "You can ask us to cancel an order within 12 hours of placing it, and only before we confirm dispatch, whichever comes first. The request is decided on the server, from Account or from Track order after your email is verified.",
        "That operational window does not remove the 14-day cancellation right or any other statutory UK consumer right. Final legal wording is still subject to review.",
      ],
    },
    {
      id: "damage",
      title: "If a delivery arrives damaged",
      paragraphs: [
        "Report delivery damage promptly. Photographs of the product, the packaging, and any unboxing evidence you already have help us verify what happened. A video can be useful. It is not presented here as the only valid proof.",
        "We aim to review that report within 2–3 business days and record the outcome. Damage is checked against the evidence. It is not treated as automatically the customer's fault.",
      ],
      link: { href: routes.contact, label: "Contact" },
    },
    {
      id: "return-postage",
      title: "Return postage",
      paragraphs: [
        "Return postage is not prepaid. Where UK law requires us to cover return costs, including goods that are faulty or not as described, those costs are ours.",
        "A change-of-mind return, if one is later offered, may require you to pay return postage. This page does not invent a restocking fee.",
      ],
    },
    {
      id: "commercial",
      title: "Optional commercial returns",
      paragraphs: [
        "A change-of-mind returns window, restocking rules, and exact refund timings beyond the statutory position need legal review before they are stated as store policy.",
        "Until that review is complete, do not assume a paid returns label, a restocking fee, or a fixed number of refund days.",
      ],
    },
    {
      id: "refunds",
      title: "How refunds are paid",
      paragraphs: [
        "Where a refund is due, it should return to the original payment method once payment is in use on the storefront.",
        "This page does not treat a checkout screen as proof that a payment has been taken or refunded.",
      ],
    },
  ],
};

export const TERMS: PolicyDocument = {
  title: "Terms",
  description:
    "SHADESUK terms of use and sale for the UK storefront. Company registration details are unpublished until confirmed.",
  lede: "These terms cover use of the SHADESUK storefront and orders placed through it.",
  notice: LEGAL_NOTICE,
  related: [
    { href: routes.privacy, label: "Privacy" },
    { href: routes.cookies, label: "Cookie" },
    { href: routes.refunds, label: "Returns / Refunds" },
  ],
  sections: [
    {
      id: "who",
      title: "Who we are",
      paragraphs: [COMPANY_PLACEHOLDER],
    },
    {
      id: "site",
      title: "Using the site",
      paragraphs: [
        "The site is for browsing and purchasing sunglasses for delivery in the United Kingdom.",
        "Do not misuse the storefront, attempt to access another customer’s account or order, or interfere with checkout or tracking.",
      ],
    },
    {
      id: "account",
      title: "Account",
      paragraphs: [
        "An account is optional. Guest checkout is available.",
        "You are responsible for the details you submit. Keep sign-in details to yourself.",
      ],
    },
    {
      id: "orders",
      title: "Orders",
      paragraphs: [
        "Submitting checkout is a request to buy. A contract is formed when we accept the order after payment is confirmed — not because a screen said the next step was payment.",
        "Prices are shown in pounds sterling. The amount charged is calculated on the server from live catalogue prices and any stated shipping, not from a figure edited in the browser.",
        "We may refuse or cancel an order where an item cannot be fulfilled, a price is clearly wrong, or the order fails verification.",
      ],
    },
    {
      id: "products",
      title: "Products",
      paragraphs: [
        // Temporarily commented out pending founder approval. Original wording preserved:
        // `Each product page includes this disclosure: ${PRODUCT_DISCLOSURE_COPY}.`,
        "Products are sold as described on their page. We do not claim official designer-house affiliation unless that affiliation is stated on the product page.",
        "Images are of the product where supplied. We do not generate substitute product photographs to fill gaps.",
      ],
    },
    {
      id: "delivery",
      title: "Delivery",
      paragraphs: [SHIPPING_MINIMUM, COUNTRY_UNSUPPORTED],
    },
    {
      id: "liability",
      title: "Liability",
      paragraphs: [
        "Nothing in these terms excludes or limits liability where UK law does not allow it, including for death or personal injury caused by negligence, or for fraud.",
        "For consumer purchases, statutory rights remain. Beyond that, we are not responsible for loss that was not foreseeable.",
      ],
    },
    {
      id: "law",
      title: "Law",
      paragraphs: [
        "These terms are governed by the law of England and Wales. UK consumers may also rely on the mandatory protections of the country in which they live.",
      ],
    },
  ],
};

export const PRIVACY_POLICY: PolicyDocument = {
  title: "Privacy policy",
  description:
    "How SHADESUK handles personal data for guest checkout, accounts, and order tracking. Company registration details are unpublished until confirmed.",
  lede: "We collect what is needed to take an order, run an optional account, and show tracking to the person who placed it.",
  notice: LEGAL_NOTICE,
  related: [
    { href: routes.cookies, label: "Cookie" },
    { href: routes.terms, label: "Terms" },
    { href: routes.contact, label: "Contact" },
  ],
  sections: [
    {
      id: "controller",
      title: "Who is responsible",
      paragraphs: [
        COMPANY_PLACEHOLDER,
        "Until a privacy email is published, use the Contact page. Do not send copies of identity documents to unofficial addresses.",
      ],
    },
    {
      id: "collect",
      title: "What we collect",
      paragraphs: [
        "If you check out, we need an email, name, and UK delivery address, plus the products and quantities in the order.",
        "If you create an account, we also keep sign-in details and any addresses you save.",
        "Guest order tracking asks for an order reference and email so we can show that order to you and not to someone else.",
      ],
    },
    {
      id: "use",
      title: "Why we use it",
      paragraphs: [
        "To fulfil a contract: take the order, dispatch it, and show tracking.",
        "To meet legal duties that apply to sales records.",
        "To keep the storefront secure, including limits on repeated tracking lookups.",
      ],
    },
    {
      id: "share",
      title: "Who we share it with",
      paragraphs: [
        "Payment details, when payment is live, go to the payment provider — not into a SHADESUK card vault.",
        "Carriers and fulfilment partners receive what they need to move a parcel.",
        "Hosting and authentication providers process data to run the site.",
        "We do not sell personal data.",
      ],
    },
    {
      id: "keep",
      title: "How long we keep it",
      paragraphs: [
        "Order records are kept for as long as needed to fulfil, handle rights, and meet accounting or tax rules.",
        "Account data stays until you close the account, subject to those same duties.",
        "Guest bag and checkout cookies expire; see the cookie policy.",
      ],
    },
    {
      id: "rights",
      title: "Your rights",
      paragraphs: [
        "Under UK GDPR you can ask for access, correction, deletion, restriction, objection, or portability, and you can complain to the ICO.",
        "Some rights yield where we must keep a record. We will not pretend a right has been refused because a form is missing.",
      ],
      link: {
        href: ICO_HELP_URL,
        label: "Information Commissioner's Office",
      },
    },
    {
      id: "transfers",
      title: "Transfers",
      paragraphs: [
        "The site is hosted on cloud infrastructure. If personal data leaves the UK, it should only do so with a lawful transfer mechanism. Specific processors will be named when they are contracted and confirmed.",
      ],
    },
  ],
};

export const COOKIE_POLICY: PolicyDocument = {
  title: "Cookie policy",
  description:
    "Cookies used by SHADESUK: guest bag, checkout, account session, and order-tracking limits. No advertising cookies are set today.",
  lede: "The storefront uses cookies that are needed to shop, check out, stay signed in, and protect order lookup.",
  notice: LEGAL_NOTICE,
  related: [
    { href: routes.privacy, label: "Privacy" },
    { href: routes.terms, label: "Terms" },
  ],
  sections: [
    {
      id: "what",
      title: "What we use cookies for",
      paragraphs: [
        "Essential cookies keep your bag, remember checkout progress, keep an account session, and slow repeated order-tracking attempts.",
        "Advertising cookies are not set. Analytics cookies stay off until you choose Accept all or turn analytics on in Cookie settings.",
      ],
    },
    {
      id: "list",
      title: "Cookies on this storefront",
      paragraphs: [
        "Names below are the cookies this site actually sets for shopping and security. Auth cookies from the account provider use a name that includes auth-token.",
      ],
      items: [
        "shadesuk_guest_cart — guest bag session. HttpOnly. About 30 days.",
        "shadesuk_guest_cart_lines — guest bag lines while the live cart service is unavailable. HttpOnly. About 30 days.",
        "shadesuk_guest_checkout — guest checkout progress. HttpOnly. About 24 hours.",
        "shadesuk_track_rl — order-tracking rate limit. HttpOnly. About 12 hours.",
        "Account session cookies — keep you signed in. HttpOnly. Set only if you use account.",
        "shadesuk_cookie_consent — records Accept all, Reject non-essential, or a saved analytics preference. Not HttpOnly. About 180 days. Necessary so the choice survives a refresh.",
      ],
    },
    {
      id: "choice",
      title: "Your controls",
      paragraphs: [
        "You can block or delete cookies in your browser. Blocking essential cookies will stop the bag, checkout, or account from working as intended.",
        "Use Cookie settings in the footer to accept all, reject non-essential cookies, or change an analytics choice later. Advertising cookies are not set.",
      ],
    },
  ],
};

export const INFO_PAGES = [
  { href: routes.about, title: ABOUT_TITLE },
  { href: routes.contact, title: CONTACT_TITLE },
  { href: routes.faq, title: FAQ_TITLE },
  { href: routes.shipping, title: SHIPPING_POLICY.title },
  { href: routes.refunds, title: REFUND_POLICY.title },
  { href: routes.terms, title: TERMS.title },
  { href: routes.privacy, title: PRIVACY_POLICY.title },
  { href: routes.cookies, title: COOKIE_POLICY.title },
] as const;

export function collectLegalHrefs(): string[] {
  const hrefs: string[] = INFO_PAGES.map((page) => page.href);
  for (const item of CONTACT_PATHWAYS) {
    hrefs.push(item.href);
  }
  for (const group of FAQ_GROUPS) {
    for (const item of group.items) {
      if (item.link) {
        hrefs.push(item.link.href);
      }
    }
  }
  for (const document of [SHIPPING_POLICY, REFUND_POLICY, TERMS, PRIVACY_POLICY, COOKIE_POLICY]) {
    for (const link of document.related) {
      hrefs.push(link.href);
    }
    for (const section of document.sections) {
      if (section.link) {
        hrefs.push(section.link.href);
      }
    }
  }
  return hrefs;
}
