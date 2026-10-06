/**
 * Phase 3 address lookup. Does not call Postcodes.io or Geoapify.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SUPPORTED_COUNTRIES } from "../src/contracts/countries";
import { structuredAddressToPostal } from "../src/lib/address/structured";
import { getAddressProvider, lookupAddresses, retrieveAddress } from "../src/lib/address-lookup";
import { featureToStructured, createGeoapifyProvider, GEOAPIFY_BASE_URL } from "../src/lib/address-providers/geoapify";
import { UK_STANDARD_DELIVERY_MINOR } from "../src/lib/checkout-quote";
import {
  checkoutCountryOptions,
  hasCheckoutFieldErrors,
  lookupUsesAutocomplete,
  postalFieldCopy,
  validateCheckoutAddress,
} from "../src/lib/checkout-validate";

const root = resolve(process.cwd());

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const berlin = {
  properties: {
    place_id: "place-berlin-1",
    formatted: "Unter den Linden 1, 10117 Berlin, Germany",
    address_line1: "Unter den Linden 1",
    address_line2: "",
    city: "Berlin",
    state: "Berlin",
    postcode: "10117",
    country_code: "de",
  },
};

async function verifyAddress(): Promise<void> {
const emptyEnv = { NODE_ENV: "test" } as NodeJS.ProcessEnv;
if (getAddressProvider("GB", emptyEnv) === null) {
  throw new Error("GB lookup must keep the Postcodes.io provider.");
}
const gbStreet = await lookupAddresses("221B Baker Street", getAddressProvider("gb", emptyEnv));
if (gbStreet.status !== "ok" || gbStreet.suggestions.length !== 0) {
  throw new Error("UK lookup must still refuse street text before Postcodes.io.");
}
if (getAddressProvider("JP", { ...emptyEnv, GEOAPIFY_API_KEY: "test" }) === null) {
  throw new Error("Japan must resolve the Geoapify provider.");
}
if (getAddressProvider("ZZ", { ...emptyEnv, GEOAPIFY_API_KEY: "test" }) !== null) {
  throw new Error("A country outside the supported list must not resolve a provider.");
}

if (getAddressProvider("FR", { ...emptyEnv, GEOAPIFY_API_KEY: "test" }) === null) {
  throw new Error("France must resolve the Geoapify provider.");
}
if (!lookupUsesAutocomplete("FR") || !lookupUsesAutocomplete("US") || !lookupUsesAutocomplete("AU")) {
  throw new Error("France, the US, and Australia must autocomplete.");
}
if (lookupUsesAutocomplete("GB") || lookupUsesAutocomplete("ZZ")) {
  throw new Error("The UK stays on postcode lookup, and an unknown country does not autocomplete.");
}
const empire = featureToStructured(
  {
    place_id: "place-esb",
    name: "Empire State Building",
    formatted: "Empire State Building, 350 5th Avenue, New York, NY 10118, United States of America",
    address_line1: "Empire State Building",
    address_line2: "350 5th Avenue, New York, NY 10118, United States of America",
    housenumber: "350",
    street: "5th Avenue",
    city: "New York",
    state: "New York",
    postcode: "10118",
    country_code: "us",
  },
  "us",
);
if (
  !empire ||
  empire.line1 !== "350 5th Avenue" ||
  empire.line2 !== "Empire State Building" ||
  empire.city !== "New York" ||
  empire.region !== "New York" ||
  empire.postalCode !== "10118" ||
  empire.line2.includes("10118")
) {
  throw new Error("A US place must keep the house number and street on line 1 and the building name on line 2.");
}
const missingKey = await lookupAddresses("Berlin", getAddressProvider("DE", emptyEnv));
if (missingKey.status !== "unavailable") {
  throw new Error("International lookup without GEOAPIFY_API_KEY must fall closed.");
}

const requested: string[] = [];
const geoapify = createGeoapifyProvider({
  apiKey: "server-key",
  countryCode: "DE",
  fetch: async (url) => {
    const parsed = new URL(url);
    if (parsed.searchParams.get("apiKey") !== "server-key") {
      throw new Error("Geoapify request omitted the server key.");
    }
    parsed.searchParams.delete("apiKey");
    requested.push(`${parsed.origin}${parsed.pathname}?${parsed.searchParams.toString()}`);
    if (parsed.pathname === "/v1/geocode/autocomplete") {
      return jsonResponse({
        features: [berlin, { properties: { ...berlin.properties, country_code: "fr", place_id: "place-paris" } }],
      });
    }
    if (parsed.pathname === "/v2/place-details" && parsed.searchParams.get("id") === "place-berlin-1") {
      return jsonResponse({ features: [berlin] });
    }
    return jsonResponse({ features: [] }, 404);
  },
});

const found = await lookupAddresses("Unter den Linden", geoapify);
if (found.status !== "ok" || found.suggestions.length !== 1 || found.suggestions[0]?.id !== "place-berlin-1") {
  throw new Error("Geoapify search must keep only the requested country.");
}
if (!requested[0]?.startsWith(`${GEOAPIFY_BASE_URL}/v1/geocode/autocomplete?`)) {
  throw new Error("Geoapify search must use the autocomplete endpoint.");
}
if (new URL(requested[0] ?? "https://invalid.example").searchParams.get("filter") !== "countrycode:de") {
  throw new Error("Geoapify search must filter to the checkout country.");
}
const retrieved = await retrieveAddress("place-berlin-1", geoapify);
if (retrieved.status !== "ok") {
  throw new Error("Geoapify retrieve must map place details.");
}
const postal = structuredAddressToPostal({
  line1: "Unter den Linden 1",
  line2: "",
  city: "Berlin",
  region: "Berlin",
  postalCode: "10117",
  countryCode: "de",
});
if (
  retrieved.address.line1 !== postal.line1 ||
  retrieved.address.city !== "Berlin" ||
  retrieved.address.postcode !== "10117" ||
  retrieved.address.country !== "DE" ||
  retrieved.address.county !== "Berlin"
) {
  throw new Error("StructuredAddress must normalize line, city, postal code, region, and country.");
}
const rejectedId = await retrieveAddress("bad id", geoapify);
if (rejectedId.status !== "error") {
  throw new Error("A malformed place id must not be sent upstream.");
}
if (requested.some((url) => url.includes("bad"))) {
  throw new Error("A malformed place id must not be sent upstream.");
}

const options = checkoutCountryOptions();
if (
  options.length !== SUPPORTED_COUNTRIES.length ||
  options.length < 150 ||
  !options.some((country) => country.code === "GB")
) {
  throw new Error("Checkout countries must be the full supported list.");
}
if (postalFieldCopy("GB").postal !== "Postcode" || postalFieldCopy("US").postal !== "ZIP code") {
  throw new Error("Postal field labels must follow the country.");
}
if (hasCheckoutFieldErrors(validateCheckoutAddress({
  firstName: "Ada",
  lastName: "Lovelace",
  line1: "Unter den Linden 1",
  city: "Berlin",
  postcode: "10117",
  country: "DE",
}))) {
  throw new Error("A seeded German address must pass validation.");
}
if (validateCheckoutAddress({
  firstName: "Ada",
  lastName: "Lovelace",
  line1: "1 Example Street",
  city: "London",
  postcode: "123",
  country: "GB",
}).postcode !== "Enter a valid postcode.") {
  throw new Error("UK postcode validation must stay strict.");
}

if (UK_STANDARD_DELIVERY_MINOR !== 465) {
  throw new Error("Address phase must not change the UK shipping amount.");
}

const lookupUi = read("src/components/address/AddressLookup.tsx");
if (!lookupUi.includes("FIND_ADDRESS") || !lookupUi.includes("ENTER_ADDRESS_MANUALLY")) {
  throw new Error("UK find button and manual fallback must stay.");
}
if (lookupUi.includes("onManual()")) {
  throw new Error("Lookup failures must not force the manual form open.");
}
if (!lookupUi.includes('autoCapitalize={unitedKingdom ? "characters" : "off"}')) {
  throw new Error("Only the UK postcode search may force capital letters.");
}
if (lookupUi.includes("unitedKingdom && result.suggestions.length === 1")) {
  throw new Error("A UK search must not resolve until the shopper selects a suggestion.");
}
if (!lookupUi.includes("new AbortController()")) {
  throw new Error("Address lookup must cancel a stale request with AbortController.");
}
if (lookupUi.includes("disabled={disabled || pending}")) {
  throw new Error("Address search must keep the field editable while a lookup is in flight.");
}
const checkoutAddress = read("src/components/checkout/CheckoutAddress.tsx");
const countryAt = checkoutAddress.indexOf("AddressCountryField");
const lookupAt = checkoutAddress.indexOf("<AddressLookup");
if (countryAt < 0 || lookupAt < 0 || countryAt > lookupAt) {
  throw new Error("Country must be visible before address search.");
}
if (!read("src/services/checkout.ts").includes("validateDeliverableCheckoutAddress")) {
  throw new Error("Checkout save must keep non-GB orders off the payment path.");
}
if (!read("src/lib/payment/pending-attempt.ts").includes("validateDeliverableCheckoutAddress")) {
  throw new Error("Payment attempts must stay GB-only.");
}
if (!lookupUi.includes("scheduleAutocomplete") || !lookupUi.includes("AUTOCOMPLETE_DEBOUNCE_MS = 300")) {
  throw new Error("Non-UK lookup must debounce autocomplete.");
}
if (!lookupUi.includes("lookupUsesAutocomplete")) {
  throw new Error("France must use the same autocomplete path as other non-UK countries.");
}
if (!read("src/lib/checkout-copy.ts").includes("We couldn't find that address. Enter it below.")) {
  throw new Error("An international resolve failure must tell the shopper to enter the address below.");
}
if (!lookupUi.includes("onLookupFailed")) {
  throw new Error("An international resolve failure must move the shopper to manual entry.");
}
if (lookupUi.includes("api.geoapify.com") || lookupUi.includes("GEOAPIFY_API_KEY") || lookupUi.includes("NEXT_PUBLIC_")) {
  throw new Error("The lookup UI must not call Geoapify or read its key.");
}

const clientFiles = [
  "src/components/address/AddressLookup.tsx",
  "src/components/address/AddressForm.tsx",
  "src/components/checkout/CheckoutPage.tsx",
  "src/components/checkout/CheckoutAddress.tsx",
  "src/components/account/AddressEditor.tsx",
];
for (const file of clientFiles) {
  const source = read(file);
  if (source.includes("api.geoapify.com") || source.includes("api.postcodes.io") || source.includes("GEOAPIFY_API_KEY")) {
    throw new Error(`${file} must keep address providers on the server.`);
  }
}

const envExample = read(".env.example");
if (!envExample.includes("\nGEOAPIFY_API_KEY=")) {
  throw new Error(".env.example must document GEOAPIFY_API_KEY.");
}
if (envExample.includes("NEXT_PUBLIC_GEOAPIFY")) {
  throw new Error("GEOAPIFY_API_KEY must not use NEXT_PUBLIC_.");
}
const quote = read("src/lib/checkout-quote.ts");
if (!quote.includes("UK_STANDARD_DELIVERY_MINOR = 465") || quote.includes("geoapify") || quote.includes("getLocalizedPrice")) {
  throw new Error("Checkout quote must stay the GBP 465 path.");
}
const adapter = read("src/lib/address-providers/geoapify.ts");
if (!adapter.includes('import "server-only"') || !adapter.includes("api.geoapify.com")) {
  throw new Error("Geoapify adapter must stay server-side.");
}
const factory = read("src/lib/address-lookup.ts");
if (!factory.includes("getAddressProvider") || !factory.includes("postcodesIoAddressLookupProvider")) {
  throw new Error("getAddressProvider must keep Postcodes.io for the UK.");
}

console.log("Address OK: Postcodes.io kept, Geoapify server-side, manual fallback, checkout quote untouched");
}

verifyAddress().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
