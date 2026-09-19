/** Locked account / auth copy from account_order_tracking.md. Do not invent loyalty or dashboard language. */

export const ACCOUNT_TITLE = "Account";
export const SIGN_IN_HEADING = "Sign in";
export const SIGN_IN_ACTION = "Sign in";
export const EMAIL_LABEL = "Email";
export const PASSWORD_LABEL = "Password";
export const FORGOT_PASSWORD_LINK = "Forgot password?";
export const AUTH_OR = "Or";
export const CONTINUE_WITH_GOOGLE = "Continue with Google";
export const NO_ACCOUNT_PROMPT = "Don't have an account?";
export const CREATE_ACCOUNT_ACTION = "Create account";
export const CREATE_ACCOUNT_HEADING = "Create account";
export const HAVE_ACCOUNT_PROMPT = "Already have an account?";
export const FIRST_NAME_LABEL = "First name";
export const LAST_NAME_LABEL = "Last name";
export const SHOW_PASSWORD = "Show";
export const HIDE_PASSWORD = "Hide";

export const FORGOT_PASSWORD_HEADING = "Forgot password";
export const FORGOT_PASSWORD_BODY =
  "Enter your email. If an account exists, we will send reset instructions.";
export const SEND_RESET_ACTION = "Send reset instructions";
export const RESET_SENT_TITLE = "Check your email";
export const RESET_SENT_BODY =
  "If an account exists for that email, we have sent reset instructions.";
export const RESET_PASSWORD_HEADING = "Reset password";
export const NEW_PASSWORD_LABEL = "New password";
export const SAVE_PASSWORD_ACTION = "Save password";
export const PASSWORD_UPDATED = "Your password has been updated. Sign in.";

export const HELLO_PREFIX = "Hello";
export const ORDERS_LABEL = "Orders";
export const ORDERS_HINT = "View your recent orders";
export const PERSONAL_DETAILS_LABEL = "Personal details";
export const PERSONAL_DETAILS_HINT = "Manage your details";
export const SAVED_ADDRESSES_LABEL = "Saved addresses";
export const SAVED_ADDRESSES_HINT = "Manage your addresses";
export const SIGN_OUT_ACTION = "Sign out";
export const SAVE_CHANGES = "Save changes";
export const OVERVIEW_LABEL = "Overview";

export const NO_ORDERS_TITLE = "No orders yet";
export const NO_ORDERS_BODY = "Your orders will appear here after you make a purchase.";
export const SHOP_SHADES = "Shop shades";
export const VIEW_ORDER = "View order";
export const ORDERS_UNAVAILABLE_TITLE = "Orders unavailable";
export const ORDERS_UNAVAILABLE_BODY = "We couldn't load your orders.";
export const ORDER_NOT_FOUND_TITLE = "Order unavailable";
export const ORDER_NOT_FOUND_BODY = "We couldn't find that order.";
export const TRACK_ORDER_LINK = "Track order";
export const ORDER_CONFIRMED = "ORDER CONFIRMED";
export const PRODUCTS_LABEL = "Products";
export const DELIVERY_LABEL = "Delivery";
export const SHIPPING_ADDRESS_LABEL = "Shipping address";
export const PAYMENT_LABEL = "Payment";
export const LOGIN_LABEL = "Login";
export const MY_ACCOUNT_LABEL = "My account";
export const LOG_OUT_LABEL = "Log out";
export const ACCOUNT_MENU_LABEL = "Account";
export const QTY_PREFIX = "Qty";
export const DELIVERY_ADDRESS_LABEL = "Delivery address";
export const TOTAL_LABEL = "Total";
export const REMOVE_ADDRESS_TITLE = "Remove address";
export const REMOVE_ADDRESS_BODY = "This address will be removed from your account.";
export const CANCEL_ACTION = "Cancel";
export const EMAIL_READ_ONLY_HINT = "Email is managed with your sign-in details.";

export const NO_ADDRESSES_TITLE = "No saved addresses";
export const NO_ADDRESSES_BODY = "Save an address for faster checkout.";
export const ADD_ADDRESS = "Add address";
export const ADD_NEW_ADDRESS = "+ Add new address";
export const EDIT_ADDRESS = "Edit";
export const REMOVE_ADDRESS = "Remove";
export const ADDRESS_LABEL = "Label";
export const ADDRESS_LABEL_HOME = "Home";
export const ADDRESS_LABEL_WORK = "Work";
export const ADDRESS_LABEL_OTHER = "Other";
export const DEFAULT_ADDRESS = "Default";

export const EMAIL_REQUIRED = "Enter an email.";
export const EMAIL_INVALID = "Enter a valid email.";
export const PASSWORD_REQUIRED = "Enter a password.";
export const PASSWORD_TOO_SHORT = "Use at least 8 characters.";
export const FIRST_NAME_REQUIRED = "Enter a first name.";
export const LAST_NAME_REQUIRED = "Enter a last name.";
export const CREDENTIALS_INVALID = "Those details didn't match. Try again.";
export const ACCOUNT_EXISTS = "An account already exists with this email. Sign in instead.";
export const ACCOUNT_CREATE_FAILED = "We couldn't create your account. Try again.";
export const GOOGLE_UNAVAILABLE = "Google sign-in is unavailable.";
export const GOOGLE_FAILED = "Google sign-in could not be completed.";
export const GOOGLE_CANCELLED = "Google sign-in was cancelled.";
export const SESSION_EXPIRED = "Your session has expired. Sign in again.";
export const ACCOUNT_UNAVAILABLE =
  "Account is unavailable. You can still checkout as a guest.";
export const NETWORK_ERROR = "We couldn't complete that request.";
export const GENERIC_REQUEST_ERROR = "Something went wrong";
export const TRY_AGAIN = "Try again";
export const DETAILS_SAVED = "Your details have been saved.";
export const ADDRESS_SAVED = "Address saved.";
export const ADDRESS_REMOVED = "Address removed.";
export const CONFIRM_EMAIL_TITLE = "Check your email";
export const CONFIRM_EMAIL_BODY =
  "Confirm your email to finish creating your account. You can still checkout as a guest.";

export const ACCOUNT_NAV = [
  { href: "/account", label: OVERVIEW_LABEL },
  { href: "/account/orders", label: ORDERS_LABEL },
  { href: "/account/details", label: PERSONAL_DETAILS_LABEL },
  { href: "/account/addresses", label: SAVED_ADDRESSES_LABEL },
] as const;
