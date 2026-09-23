import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ACCOUNT_EXISTS,
  ACCOUNT_TITLE,
  ACCOUNT_UNAVAILABLE,
  CONTINUE_WITH_GOOGLE,
  CREATE_ACCOUNT_ACTION,
  CREDENTIALS_INVALID,
  FORGOT_PASSWORD_LINK,
  HELLO_PREFIX,
  NO_ADDRESSES_TITLE,
  NO_ORDERS_TITLE,
  RESET_SENT_BODY,
  SHOP_SHADES,
  SIGN_IN_ACTION,
  SIGN_OUT_ACTION,
} from "../src/lib/account-copy";
import {
  isSafeNextPath,
  resolveSafeAdminNextPath,
  resolveSafeNextPath,
  validateRegisterInput,
  validateSignInInput,
} from "../src/lib/account-validate";
import { CART_MERGE_POLICY } from "../src/contracts";
import { CONTINUE_AS_GUEST } from "../src/lib/checkout-copy";
import { routes } from "../src/lib/navigation";
import {
  requireGuestCookieSecret,
  resolveGuestCookieSecret,
} from "../src/lib/guest-cookie-hmac";
import {
  accountEntryHref,
  authNextFromPathname,
  encodeAuthReturnCookie,
  isFrameworkRedirect,
  resolveAuthReturnPath,
} from "../src/lib/auth-return";
import { hasForbiddenOwnershipKey } from "../src/lib/ownership-keys";
import { resolveActionOrigin } from "../src/lib/request-origin";
import { isSupabaseAuthCookieName } from "../src/lib/supabase/cookie-options";

if (routes.account !== "/account") {
  throw new Error("Account route must stay /account.");
}
if (routes.accountRegister !== "/account/register") {
  throw new Error("Create-account route must stay /account/register.");
}
if (routes.accountForgotPassword !== "/account/forgot-password") {
  throw new Error("Forgot-password route must stay /account/forgot-password.");
}
if (routes.authCallback !== "/auth/callback") {
  throw new Error("Auth callback must stay /auth/callback.");
}
if (routes.checkout !== "/checkout") {
  throw new Error("Guest checkout route must remain /checkout.");
}

if (ACCOUNT_TITLE !== "Account") {
  throw new Error("Account heading copy must stay locked.");
}
if (SIGN_IN_ACTION !== "Sign in") {
  throw new Error("Sign in copy must stay locked.");
}
if (CREATE_ACCOUNT_ACTION !== "Create account") {
  throw new Error("Create account copy must stay locked.");
}
if (CONTINUE_WITH_GOOGLE !== "Continue with Google") {
  throw new Error("Google CTA copy must stay locked.");
}
if (FORGOT_PASSWORD_LINK !== "Forgot password?") {
  throw new Error("Forgot password copy must stay locked.");
}
if (HELLO_PREFIX !== "Hello") {
  throw new Error("Account greeting copy must stay locked.");
}
if (NO_ORDERS_TITLE !== "No orders yet") {
  throw new Error("Empty orders copy must stay locked.");
}
if (NO_ADDRESSES_TITLE !== "No saved addresses") {
  throw new Error("Empty addresses copy must stay locked.");
}
if (SHOP_SHADES !== "Shop shades") {
  throw new Error("Empty orders CTA copy must stay locked.");
}
if (SIGN_OUT_ACTION !== "Sign out") {
  throw new Error("Sign out copy must stay locked.");
}
if (CONTINUE_AS_GUEST !== "Continue as guest") {
  throw new Error("Guest checkout CTA must remain locked.");
}
if (!RESET_SENT_BODY.toLowerCase().includes("if an account exists")) {
  throw new Error("Password reset must not reveal whether an email exists.");
}
if (
  CREDENTIALS_INVALID.toLowerCase().includes("registered") ||
  CREDENTIALS_INVALID.toLowerCase().includes("no account")
) {
  throw new Error("Invalid sign-in must not reveal whether the email exists.");
}
if (!ACCOUNT_UNAVAILABLE.toLowerCase().includes("guest")) {
  throw new Error("Account unavailable copy must keep guest checkout available.");
}

const signInErrors = validateSignInInput({ email: "", password: "" });
if (!signInErrors.email || !signInErrors.password) {
  throw new Error("Sign-in validation must require email and password.");
}
const registerErrors = validateRegisterInput({
  firstName: "",
  lastName: "",
  email: "not-an-email",
  password: "short",
});
if (!registerErrors.firstName || !registerErrors.email || !registerErrors.password) {
  throw new Error("Register validation must cover name, email, and password.");
}

if (
  isSafeNextPath("https://evil.example") ||
  isSafeNextPath("//evil.example") ||
  isSafeNextPath("/\\evil")
) {
  throw new Error("Auth next paths must reject open redirects.");
}
if (!isSafeNextPath("/checkout") || resolveSafeNextPath("https://evil.example") !== "/account") {
  throw new Error("Safe next-path fallback failed.");
}
if (resolveSafeNextPath("/admin") !== "/account" || resolveSafeNextPath("/admin/settings") !== "/account") {
  throw new Error("Customer auth next paths must not enter /admin.");
}
if (resolveSafeAdminNextPath("/account") !== "/admin" || resolveSafeAdminNextPath("/admin/settings") !== "/admin/settings") {
  throw new Error("Admin next paths must stay inside /admin.");
}

if (
  CART_MERGE_POLICY.soldOut !== "drop_with_notice" ||
  CART_MERGE_POLICY.guestCartAfterMerge !== "converted"
) {
  throw new Error("Guest cart merge policy must stay locked.");
}
if (!hasForbiddenOwnershipKey({ email: "a@b.com", sessionId: "nope" })) {
  throw new Error("Auth actions must reject client-supplied session ids.");
}

const root = resolve(process.cwd());
const accountActions = readFileSync(resolve(root, "src/app/(storefront)/account/actions.ts"), "utf8");
if (
  accountActions.includes("sessionId") ||
  accountActions.includes("session_id") ||
  accountActions.includes("cart_id")
) {
  throw new Error("Account auth actions must not serialize guest cart session ids.");
}
if (!accountActions.includes("cartActionOriginAllowed")) {
  throw new Error("Account mutations must check CSRF/origin.");
}
if (!accountActions.includes("resetPasswordForEmail")) {
  throw new Error("Password reset must use Supabase Auth email reset.");
}

const resetAction = accountActions.slice(
  accountActions.indexOf("requestPasswordResetAction"),
  accountActions.indexOf("updatePasswordAction"),
);
if (resetAction.includes("ACCOUNT_EXISTS") || resetAction.includes("CREDENTIALS_INVALID")) {
  throw new Error("Password reset must not branch on whether the email exists.");
}
if (!resetAction.includes('return { status: "reset_sent" }')) {
  throw new Error("Password reset must always return the same sent state.");
}

const proxy = readFileSync(resolve(root, "src/proxy.ts"), "utf8");
if (!proxy.includes("/account/:path*") || !proxy.includes("refreshAccountSession")) {
  throw new Error("Proxy must refresh sessions for /account/**.");
}
if (proxy.includes("/checkout")) {
  throw new Error("Session proxy must not hijack guest checkout.");
}

const refresh = readFileSync(resolve(root, "src/lib/supabase/refresh-session.ts"), "utf8");
if (refresh.includes("getSession()") || !refresh.includes("getClaims")) {
  throw new Error("Session refresh must validate with getClaims, not getSession.");
}

const accountPage = readFileSync(resolve(root, "src/app/(storefront)/account/page.tsx"), "utf8");
if (!accountPage.includes("getOptionalAccountUser") || !accountPage.includes("SignInForm")) {
  throw new Error("Unauthenticated /account must render the sign-in UI.");
}

const ordersPage = readFileSync(resolve(root, "src/app/(storefront)/account/orders/page.tsx"), "utf8");
if (!ordersPage.includes("requireAccountUser")) {
  throw new Error("Account orders must be gated on a real server session.");
}
if (!ordersPage.includes("listOwnCustomerOrders")) {
  throw new Error("Account orders must load from the session-scoped customer order service.");
}

const googleButton = readFileSync(resolve(root, "src/components/account/GoogleAuthButton.tsx"), "utf8");
if (!googleButton.includes("GoogleMark") || !googleButton.includes("signInWithGoogleAction")) {
  throw new Error("Google sign-in must use the existing OAuth action and Google G mark.");
}
const googleMark = readFileSync(resolve(root, "src/components/account/GoogleMark.tsx"), "utf8");
if (!googleMark.includes("#4285F4") || !googleMark.includes("#EA4335")) {
  throw new Error("Google mark must use the official G colours.");
}

const header = readFileSync(resolve(root, "src/components/navigation/SiteHeader.tsx"), "utf8");
if (!header.includes("AccountMenu")) {
  throw new Error("Header Account control must use the account menu.");
}
const accountMenu = readFileSync(resolve(root, "src/components/navigation/AccountMenu.tsx"), "utf8");
if (
  !accountMenu.includes("routes.account") ||
  !accountMenu.includes("routes.accountOrders") ||
  !accountMenu.includes("routes.trackOrder")
) {
  throw new Error("Account menu must wire My account, Orders, and Track order.");
}

const checkoutContact = readFileSync(
  resolve(root, "src/components/checkout/CheckoutContact.tsx"),
  "utf8",
);
if (!checkoutContact.includes("CONTINUE_AS_GUEST") || !checkoutContact.includes("routes.account")) {
  throw new Error("Guest checkout contact must keep Continue as guest and Sign in.");
}

const envExample = readFileSync(resolve(root, ".env.example"), "utf8");
if (envExample.includes("GOOGLE_CLIENT") || envExample.includes("GOOGLE_SECRET")) {
  throw new Error("Do not invent Google client secrets in .env.example.");
}
if (!envExample.includes("fails closed") && !envExample.toLowerCase().includes("fail closed")) {
  throw new Error(".env.example must document production HMAC fail-closed.");
}

const hmacHelper = readFileSync(resolve(root, "src/lib/guest-cookie-hmac.ts"), "utf8");
if (!hmacHelper.includes('nodeEnv === "production"') || !hmacHelper.includes("LOCAL_DEV_FALLBACK")) {
  throw new Error("Guest cookie HMAC must keep the local fallback off the production path.");
}

const demoStore = readFileSync(resolve(root, "src/lib/demo-cart-cookie-store.ts"), "utf8");
const checkoutStore = readFileSync(resolve(root, "src/lib/checkout-draft-store.ts"), "utf8");
if (!demoStore.includes("requireGuestCookieSecret") || !checkoutStore.includes("requireGuestCookieSecret")) {
  throw new Error("Cookie writes must require a real HMAC secret in production.");
}

const docs = readFileSync(resolve(root, "docs/PHASE3_ACCOUNT_AUTH.md"), "utf8");
if (!docs.includes("Supabase dashboard") || !docs.includes("Continue with Google")) {
  throw new Error("Account auth docs must record dashboard-pending Google setup.");
}
if (!docs.includes("fail closed") || !docs.includes("GUEST_COOKIE_SECRET")) {
  throw new Error("Account auth docs must record production HMAC fail-closed.");
}

if (
  resolveGuestCookieSecret({
    guestCookieSecret: "",
    supabaseSecret: "",
    nodeEnv: "production",
  }) !== ""
) {
  throw new Error("Production must fail closed without GUEST_COOKIE_SECRET or a Supabase secret.");
}
let productionCookieSecretThrew = false;
try {
  requireGuestCookieSecret({
    guestCookieSecret: "",
    supabaseSecret: "",
    nodeEnv: "production",
  });
} catch {
  productionCookieSecretThrew = true;
}
if (!productionCookieSecretThrew) {
  throw new Error("Account/auth cookie writes must not use a local HMAC fallback in production.");
}

if (ACCOUNT_EXISTS.toLowerCase().includes("try a different")) {
  throw new Error("Duplicate-account copy drifted.");
}

if (
  resolveAuthReturnPath({
    queryNext: null,
    cookieNext: encodeAuthReturnCookie("/checkout"),
  }) !== "/checkout"
) {
  throw new Error("Google return must restore checkout from the return cookie when the query is stripped.");
}
if (
  resolveAuthReturnPath({
    queryNext: "/account/orders",
    cookieNext: encodeAuthReturnCookie("/checkout"),
  }) !== "/account/orders"
) {
  throw new Error("Explicit next query must win over the stored return path.");
}
if (resolveAuthReturnPath({ queryNext: "https://evil.test/phish", cookieNext: null }) !== "/account") {
  throw new Error("Unsafe next must not leave the storefront.");
}
if (resolveAuthReturnPath({ queryNext: null, cookieNext: null }) !== "/account") {
  throw new Error("A missing Google return path must not fall through to the homepage.");
}
if (resolveAuthReturnPath({ queryNext: "/admin", cookieNext: encodeAuthReturnCookie("/checkout") }) !== "/checkout") {
  throw new Error("Admin paths must not be used as a storefront return path.");
}
if (accountEntryHref("/checkout") !== "/account?next=%2Fcheckout") {
  throw new Error("Signing in from checkout must preserve the checkout return path.");
}
if (accountEntryHref("/product/frame") !== "/account?next=%2Fproduct%2Fframe") {
  throw new Error("Return path must follow the page that started sign-in, not only checkout.");
}
if (authNextFromPathname("/account") !== undefined || authNextFromPathname("/") !== undefined) {
  throw new Error("Account and home must not be stored as implicit return paths.");
}
if (isSupabaseAuthCookieName("sb-project-auth-token-code-verifier")) {
  throw new Error("PKCE verifier cookies must not be treated as a session.");
}
if (isSupabaseAuthCookieName("sb-project-auth-token-flow-abcdefgh-code-verifier")) {
  throw new Error("Per-flow PKCE verifier cookies must not be treated as a session.");
}
if (!isSupabaseAuthCookieName("sb-project-auth-token")) {
  throw new Error("Session cookies must still be recognised.");
}
if (!isFrameworkRedirect({ digest: "NEXT_REDIRECT;push;https://accounts.google.com/o/oauth2;307;" })) {
  throw new Error("OAuth redirect rejections must be recognised as navigation.");
}
if (isFrameworkRedirect(new Error("Google sign-in could not be completed."))) {
  throw new Error("Real Google failures must not be treated as redirects.");
}
const shopperOrigin = resolveActionOrigin({
  origin: "https://shop.example",
  forwardedHost: "shop.example",
  host: "shop.example",
  forwardedProto: "https",
  siteUrl: "https://canonical.example",
});
if (shopperOrigin !== "https://shop.example") {
  throw new Error("OAuth callback origin must follow the shopper host.");
}
const foreignOrigin = resolveActionOrigin({
  origin: "https://evil.test",
  forwardedHost: null,
  host: null,
  forwardedProto: null,
  siteUrl: "https://canonical.example",
});
if (foreignOrigin !== "https://canonical.example") {
  throw new Error("Untrusted origins must not become the OAuth callback host.");
}

const googleAction = readFileSync(resolve(root, "src/app/(storefront)/account/actions.ts"), "utf8");
const googleStart = googleAction.slice(
  googleAction.indexOf("export async function signInWithGoogleAction"),
  googleAction.indexOf("export async function signOutAction"),
);
if (!googleStart.includes("rememberAuthReturnPath") || !googleStart.includes("redirect(oauthUrl)")) {
  throw new Error("Google sign-in must store the return path and redirect with the PKCE response.");
}
if (googleStart.includes("callbackUrl(")) {
  throw new Error("Google redirectTo must be the exact callback URL, without a next query.");
}
if (!googleStart.includes("isFrameworkRedirect")) {
  throw new Error("Google sign-in must rethrow framework redirects instead of reporting them as failures.");
}
const googleButtonSource = readFileSync(resolve(root, "src/components/account/GoogleAuthButton.tsx"), "utf8");
if (!googleButtonSource.includes("isFrameworkRedirect")) {
  throw new Error("Google button must not present the OAuth redirect rejection as a failure.");
}
const callbackSource = readFileSync(resolve(root, "src/app/auth/callback/route.ts"), "utf8");
if (!callbackSource.includes("resolveAuthReturnPath") || !callbackSource.includes("AUTH_RETURN_COOKIE")) {
  throw new Error("Auth callback must restore the stored return path.");
}
const refreshSource = readFileSync(resolve(root, "src/lib/supabase/refresh-session.ts"), "utf8");
if (!refreshSource.includes("isOAuthCallbackExchange")) {
  throw new Error("Session refresh must not run over the OAuth code exchange.");
}

console.log("verify-account: ok");
