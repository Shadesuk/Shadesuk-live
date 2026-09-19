export { majorToMinorGbp, minorToMajorGbp, moneyMinor, STORE_CURRENCY } from "./money";

export {
  ADMIN_V1_ROLES,
  AUTHENTICATED_ROLE_ASSIGNMENT_ALLOWED,
  LEGACY_NON_V1_ADMIN_ROLES,
  adminRoleLabel,
  canAccessAdmin,
  canAccessMerchandising,
  canAccessSettings,
  canArchiveCollection,
  canArchiveProduct,
  canAssignAdminRole,
  canDeleteCollection,
  canDeleteProduct,
  canManageCollections,
  canPublishProduct,
  canUnpublishProduct,
  isAdminV1Role,
  isStaffAdmin,
  isSuperadmin,
  toAdminV1Role,
} from "./admin/roles";
export type { AdminV1Role, DatabaseAdminRole, LegacyNonV1AdminRole } from "./admin/roles";

export {
  ADMIN_DASHBOARD_TIME_ZONE,
  ADMIN_ORDER_STATUS_LABELS,
  ADMIN_PAYMENT_STATUS_LABELS,
  DASHBOARD_PERIODS,
  DASHBOARD_PERIOD_LABELS,
  DEFAULT_DASHBOARD_PERIOD,
  QUALIFYING_REVENUE_PAYMENT_STATUS,
  RECENT_ORDERS_LIMIT,
  adminOrderStatusLabel,
  adminPaymentStatusLabel,
  averageOrderValueMinor,
  buildDashboardKpis,
  countQualifyingOrders,
  dashboardPeriodRange,
  groupSalesByDay,
  hasSalesActivity,
  isDashboardPeriod,
  isOrderStatus,
  isPaymentStatus,
  isQualifyingRevenuePayment,
  isShipmentStatus,
  parseDashboardPeriod,
  sumRevenueMinor,
} from "./admin/dashboard";
export type {
  DashboardDateRange,
  DashboardDayPoint,
  DashboardKpis,
  DashboardOrderMetricRow,
  DashboardPeriod,
} from "./admin/dashboard";

export {
  ADMIN_FULFILMENT_TEXT_MAX,
  ADMIN_ORDERS_PAGE_SIZE,
  ADMIN_ORDER_EVENT_TYPES,
  ADMIN_ORDER_LIST_PERIODS,
  ADMIN_ORDER_SEARCH_MAX,
  ADMIN_SHIPMENT_STATUS_LABELS,
  ADMIN_TRACKING_URL_MAX,
  adminOrderCustomerLabel,
  adminOrderEventLabel,
  adminOrderListPeriodRange,
  adminOrderListQueryString,
  adminOrderSearchReference,
  adminOrderStatusOptions,
  adminShipmentStatusLabel,
  isUnchangedAdminFulfilment,
  parseAdminFulfilmentInput,
  parseAdminOrderListQuery,
  parseAdminOrderStatusInput,
  sanitizeAdminOrderSearch,
} from "./admin/orders";
export type {
  AdminFulfilmentField,
  AdminFulfilmentInput,
  AdminOrderDetailView,
  AdminOrderEventType,
  AdminOrderEventView,
  AdminOrderItemView,
  AdminOrderListItem,
  AdminOrderListPeriod,
  AdminOrderListQuery,
  AdminShipmentView,
  AdminTrackingEventView,
} from "./admin/orders";

export {
  ADMIN_PRODUCTS_PAGE_SIZE,
  ADMIN_PRODUCT_SEARCH_MAX,
  ADMIN_CATALOGUE_STATUS_LABELS,
  adminCatalogueStatusLabel,
  adminProductListQueryString,
  adminProductSlugFromName,
  nextUniqueProductSlug,
  availabilityFromVariants,
  formatGbpMajorInput,
  isProductSlug,
  parseAdminProductListQuery,
  parseAdminProductSaveInput,
  parseGbpMajorInput,
  sanitizeAdminProductSearch,
  suggestedVariantSku,
  variantCombinations,
} from "./admin/products";
export type {
  AdminProductDetailView,
  AdminProductListItem,
  AdminProductListQuery,
  AdminProductSaveInput,
} from "./admin/products";

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
export { merchandisingFromCollectionSlugs, merchandisingFlagsFromState, isNewArrivalFromPublishedAt, newArrivalDaysRemaining, MERCHANDISING_COLLECTION_SLUGS, NEW_ARRIVAL_WINDOW_MS, HOMEPAGE_MERCHANDISING_ID } from "./catalogue/merchandising";
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
export type {
  CartView,
  CartItemView,
  CartMergeConflict,
  CartRevalidationIssue,
  CartItemReconciliation,
} from "./cart/dto";
export type { CartItemRow, CartRow, CartStatus } from "./cart/schema";

export {
  createOrderReference,
  isOrderReference,
  ORDER_REFERENCE_PATTERN,
  parseOrderReferenceInput,
} from "./order/reference";
export {
  consumeGuestTrackingEmailCompare,
  emailRateLimitFingerprint,
  emailsMatch,
  guestTrackingVerified,
  GUEST_TRACKING_DUMMY_EMAIL,
  GUEST_TRACKING_GENERIC_ERROR,
  GUEST_TRACKING_RATE_LIMIT,
  GUEST_TRACKING_RATE_LIMITED,
  normalizeEmail,
  parseGuestTrackingRequest,
  verifyGuestTrackingEmail,
} from "./order/tracking";
export type { GuestTrackingRequest } from "./order/tracking";
export {
  formatOrderHeading,
  toCustomerOrderListItem,
  toCustomerOrderView,
  toGuestDeliveryAddress,
  toGuestOrderTrackingView,
} from "./order/dto";
export type {
  CustomerOrderListItem,
  CustomerOrderView,
  CustomerVisibleOrderEventView,
  GuestDeliveryAddressView,
  GuestOrderTrackingView,
} from "./order/dto";
export {
  CUSTOMER_ORDER_STATUS_LABELS,
  CUSTOMER_TRACKING_STEPS,
  customerOrderStatusLabel,
  isLegalOrderStatusTransition,
  legalOrderStatusTargets,
} from "./order/status";
export type { CustomerTrackingStep } from "./order/status";

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
