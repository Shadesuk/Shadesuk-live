"use server";

import { cartActionOriginAllowed } from "@/lib/cart-origin-server";
import { hasForbiddenOwnershipKey } from "@/lib/ownership-keys";
import {
  saveCheckoutAddress,
  saveCheckoutContact,
  setCheckoutStep,
} from "@/services/checkout";
import { lookupAddresses, retrieveAddress } from "@/lib/address-lookup";
import type {
  AddressLookupView,
  AddressRetrieveView,
  CheckoutMutationResult,
  CheckoutStepId,
} from "@/types/checkout";

export async function saveCheckoutContactAction(input: {
  email: string;
}): Promise<CheckoutMutationResult> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(input)) {
    return { status: "error" };
  }
  if (typeof input.email !== "string") {
    return { status: "error" };
  }
  return saveCheckoutContact(input.email);
}

export async function saveCheckoutAddressAction(input: {
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string;
  city: string;
  county?: string;
  postcode: string;
  country: string;
  addressEntry?: "search" | "manual";
}): Promise<CheckoutMutationResult> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(input)) {
    return { status: "error" };
  }
  if (
    typeof input.firstName !== "string" ||
    typeof input.lastName !== "string" ||
    typeof input.line1 !== "string" ||
    typeof input.city !== "string" ||
    typeof input.postcode !== "string" ||
    typeof input.country !== "string"
  ) {
    return { status: "error" };
  }
  return saveCheckoutAddress({
    firstName: input.firstName,
    lastName: input.lastName,
    line1: input.line1,
    line2: typeof input.line2 === "string" ? input.line2 : "",
    city: input.city,
    county: typeof input.county === "string" ? input.county : "",
    postcode: input.postcode,
    country: input.country,
    addressEntry: input.addressEntry,
  });
}

export async function setCheckoutStepAction(input: {
  step: CheckoutStepId;
}): Promise<CheckoutMutationResult> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(input)) {
    return { status: "error" };
  }
  if (input.step !== "contact" && input.step !== "address" && input.step !== "review") {
    return { status: "error" };
  }
  return setCheckoutStep(input.step);
}

export async function searchCheckoutAddressAction(input: {
  query: string;
}): Promise<AddressLookupView> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(input)) {
    return { status: "error" };
  }
  if (typeof input.query !== "string") {
    return { status: "error" };
  }
  return lookupAddresses(input.query);
}

export async function retrieveCheckoutAddressAction(input: {
  id: string;
}): Promise<AddressRetrieveView> {
  if (!(await cartActionOriginAllowed()) || hasForbiddenOwnershipKey(input)) {
    return { status: "error" };
  }
  if (typeof input.id !== "string") {
    return { status: "error" };
  }
  return retrieveAddress(input.id);
}
