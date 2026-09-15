export { majorToMinorGbp, minorToMajorGbp, moneyMinor, STORE_CURRENCY } from "./money";

export type {
  CatalogueStatus,
  CollectionRow,
  ProductAggregate,
  ProductCollectionRow,
  ProductImageRow,
  ProductImageType,
  ProductRow,
  ProductVariantRow,
  VariantStatus,
} from "./catalogue/schema";
export { mapProductAggregateToStorefront } from "./catalogue/map-product";
export type { MapProductOptions, MappedStorefrontProduct, PdpCatalogueFields } from "./catalogue/map-product";
export { deriveBrandSource, deriveBrandsFromProducts } from "./catalogue/brand";
export { deriveColours, selectableColourCount } from "./catalogue/colour";
export { merchandisingFromCollectionSlugs, MERCHANDISING_COLLECTION_SLUGS } from "./catalogue/merchandising";
export { parseGenderTokens, parseShapeTokens } from "./catalogue/taxonomy";
export { productAvailabilityFromVariants } from "./catalogue/availability";
export { toCatalogueImageDto, toStorefrontImages } from "./catalogue/image";

export {
  CART_MEDIATION_RULES,
  createGuestCartSessionId,
  GUEST_CART_COOKIE,
  GUEST_CART_COOKIE_NAME,
  guestCartCookieSetOptions,
  isGuestCartSessionId,
} from "./cart/session";
export type { CartOwner } from "./cart/session";
export { CART_MERGE_POLICY, toCartView } from "./cart/dto";
export type { CartView, CartItemView, CartMergeConflict } from "./cart/dto";

export {
  createOrderReference,
  isOrderReference,
  ORDER_REFERENCE_PATTERN,
  parseOrderReferenceInput,
} from "./order/reference";
export {
  emailsMatch,
  GUEST_TRACKING_GENERIC_ERROR,
  GUEST_TRACKING_RATE_LIMIT,
  normalizeEmail,
  parseGuestTrackingRequest,
  verifyGuestTrackingEmail,
} from "./order/tracking";
export type { GuestTrackingRequest } from "./order/tracking";
export { toGuestOrderTrackingView, formatOrderHeading } from "./order/dto";
export type { GuestOrderTrackingView } from "./order/dto";
export { customerOrderStatusLabel, isLegalOrderStatusTransition } from "./order/status";

export {
  customerPaymentState,
  PAYMENT_PROVIDER_UNSET,
  PAYMENT_TRUST_RULES,
  paymentStub,
} from "./payment/stub";
export type { PaymentProviderStub, CustomerPaymentState } from "./payment/stub";

export {
  isManualFulfilmentV1,
  toCustomerShipmentView,
  TRACKING_UNAVAILABLE_COPY,
} from "./fulfilment/shipment";
export type { CustomerShipmentView, ShipmentStatus } from "./fulfilment/shipment";
