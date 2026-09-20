import type { PostalAddress } from "@/types/integrations";
import type { PublicCart } from "@/types/cart";
import type { CheckoutQuote } from "@/lib/checkout-quote";

export const CHECKOUT_STEP_IDS = ["contact", "address", "review"] as const;
export type CheckoutStepId = (typeof CHECKOUT_STEP_IDS)[number];

export const CHECKOUT_COUNTRY_GB = "GB";

export type CheckoutAddressEntry = "search" | "manual";

export type CheckoutContact = {
  email: string;
};

export type CheckoutDelivery = {
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
};

export type PublicCheckoutDraft = {
  step: CheckoutStepId;
  email: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
  addressEntry: CheckoutAddressEntry;
  expired: boolean;
};

export type CheckoutFieldErrors = Partial<
  Record<
    | "email"
    | "firstName"
    | "lastName"
    | "line1"
    | "line2"
    | "city"
    | "county"
    | "postcode"
    | "country"
    | "form",
    string
  >
>;

export type CheckoutMutationResult =
  | { status: "ok"; cart: PublicCart; draft: PublicCheckoutDraft; quote: CheckoutQuote }
  | {
      status: "invalid";
      cart: PublicCart;
      draft: PublicCheckoutDraft;
      quote: CheckoutQuote;
      errors: CheckoutFieldErrors;
    }
  | {
      status: "blocked";
      cart: PublicCart;
      draft: PublicCheckoutDraft;
      quote: CheckoutQuote;
    }
  | { status: "empty" }
  | { status: "expired"; cart: PublicCart; draft: PublicCheckoutDraft; quote: CheckoutQuote }
  | { status: "error" };

export type AddressLookupView =
  | { status: "ok"; suggestions: Array<{ id: string; label: string }> }
  | { status: "unavailable" }
  | { status: "error" };

export type AddressRetrieveView =
  | { status: "ok"; address: PostalAddress }
  | { status: "unavailable" }
  | { status: "error" };

export function emptyCheckoutDraft(): PublicCheckoutDraft {
  return {
    step: "contact",
    email: "",
    firstName: "",
    lastName: "",
    line1: "",
    line2: "",
    city: "",
    county: "",
    postcode: "",
    country: CHECKOUT_COUNTRY_GB,
    addressEntry: "search",
    expired: false,
  };
}

export function draftToPostalAddress(draft: PublicCheckoutDraft): PostalAddress {
  const address: PostalAddress = {
    line1: draft.line1,
    city: draft.city,
    postcode: draft.postcode,
    country: draft.country,
  };
  if (draft.line2) {
    address.line2 = draft.line2;
  }
  if (draft.county) {
    address.county = draft.county;
  }
  return address;
}
