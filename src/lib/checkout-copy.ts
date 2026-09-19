/** Locked guest-checkout copy. Do not invent urgency, trust badges, or payment success. */

export const CHECKOUT_TITLE = "Checkout";

export const CHECKOUT_STEPS = [
  { id: "contact", number: "01", label: "Contact" },
  { id: "address", number: "02", label: "Delivery" },
  { id: "review", number: "03", label: "Review" },
] as const;

export const CONTINUE_AS_GUEST = "Continue as guest";
export const HAVE_ACCOUNT_PROMPT = "Have an account?";
export const SIGN_IN = "Sign in";

export const CONTACT_HEADING = "Contact";
export const EMAIL_LABEL = "Email";
export const EMAIL_INVALID = "Enter a valid email.";
export const EMAIL_REQUIRED = "Enter an email.";

export const DELIVERY_HEADING = "Delivery address";
export const ADDRESS_SEARCH_LABEL = "Postcode";
export const ADDRESS_SEARCH_PLACEHOLDER = "Enter postcode";
export const ADDRESS_SEARCH_HINT = "Enter your UK postcode to find your area.";
export const FIND_ADDRESS = "Find address";
export const ENTER_ADDRESS_MANUALLY = "Enter address manually";
export const ADDRESS_LOOKUP_UNAVAILABLE =
  "Postcode lookup is unavailable. Enter address manually.";
export const ADDRESS_LOOKUP_EMPTY = "No postcode found. Enter address manually.";
export const ADDRESS_LOOKUP_ERROR =
  "Postcode lookup could not be completed. Enter address manually.";
export const ADDRESS_LOOKUP_LOADING = "Looking up postcode…";
export const ADDRESS_COMPLETE_HINT = "Add your house number and street.";
export const ADDRESS_LINE_1_PLACEHOLDER = "Enter house number and street";
export const ADDRESS_LINE_2_PLACEHOLDER = "Flat, unit, etc. optional";

export const FIRST_NAME_LABEL = "First name";
export const LAST_NAME_LABEL = "Last name";
export const ADDRESS_LINE_1_LABEL = "Address line 1";
export const ADDRESS_LINE_2_LABEL = "Address line 2";
export const CITY_LABEL = "City / Town";
export const COUNTY_LABEL = "County";
export const POSTCODE_LABEL = "Postcode";
export const COUNTRY_LABEL = "Country";
export const UNITED_KINGDOM = "United Kingdom";

export const FIRST_NAME_REQUIRED = "Enter a first name.";
export const LAST_NAME_REQUIRED = "Enter a last name.";
export const ADDRESS_LINE_1_REQUIRED = "Enter address line 1.";
export const CITY_REQUIRED = "Enter a city or town.";
export const POSTCODE_REQUIRED = "Enter a postcode.";
export const POSTCODE_INVALID = "Enter a valid postcode.";
export const COUNTRY_UNSUPPORTED = "Delivery is currently available in the United Kingdom.";

export const SHIPPING_HEADING = "Delivery";
export const SHIPPING_MINIMUM = "Minimum 2-week delivery timeframe.";
export const SHIPPING_BODY =
  "UK delivery. Delivery is expected to take a minimum of 2 weeks.";
export const SHIPPING_CALCULATED_LATER = "Calculated later";
export const SHIPPING_MANUAL_NOTE =
  "Orders are prepared for dispatch by hand. Carrier details appear once a shipment has been dispatched.";
export const SHIPPING_INFORMATION = "Shipping information";

export const REVIEW_HEADING = "Your order";
export const PAYMENT_HEADING = "Payment";
export const PAYMENTS_ACCEPTED = "Payments accepted";
export const PAYMENT_NEXT_TITLE = "Payment is next.";
export const PAYMENT_NEXT_BODY = "Nothing has been charged yet.";
export const PAYMENT_NOT_READY =
  "Card payment is not available yet. Continue to payment stays unavailable until checkout can take payment.";
export const CONTINUE_TO_PAYMENT = "Continue to payment";
export const SECURE_CARD_PAYMENT = "Secure card payment";
export const ALL_MAJOR_CARDS = "All major cards accepted";

export const ORDER_SUMMARY_HEADING = "Order summary";
export const SUBTOTAL_LABEL = "Subtotal";
export const SHIPPING_LABEL = "Shipping";
export const TOTAL_LABEL = "Total";
export const RETURN_TO_BAG = "Return to bag";

export const CHECKOUT_EXPIRED_TITLE = "Checkout session expired";
export const CHECKOUT_EXPIRED_BODY = "Your cart is still available where possible.";

export const CHECKOUT_REQUEST_ERROR = "We could not complete that request.";
export const CHECKOUT_CART_UNAVAILABLE = "Your bag is no longer available.";

export const CONTINUE = "Continue";
export const BACK = "Back";
