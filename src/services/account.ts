import "server-only";

import {
  ADDRESS_LABEL_HOME,
  ADDRESS_LABEL_OTHER,
  ADDRESS_LABEL_WORK,
} from "@/lib/account-copy";
import { CHECKOUT_COUNTRY_GB } from "@/types/checkout";
import type { AccountAddress, AccountAddressLabel, AccountProfile, AccountUser } from "@/types/account";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/ids";

const PROFILE_COLUMNS = "id, email, first_name, last_name, phone, created_at, updated_at";
const ADDRESS_COLUMNS =
  "id, user_id, label, first_name, last_name, address_line_1, address_line_2, city, county, postcode, country, is_default, created_at, updated_at";

export async function loadAccountProfile(user: AccountUser): Promise<AccountProfile> {
  const fallback: AccountProfile = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  };
  try {
    const supabase = await createSupabaseServerClient();
    const existing = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", user.id)
      .maybeSingle();
    if (existing.data) {
      return parseProfile(existing.data, user);
    }
    const inserted = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        email: user.email,
        first_name: user.firstName || null,
        last_name: user.lastName || null,
      })
      .select(PROFILE_COLUMNS)
      .maybeSingle();
    if (inserted.data) {
      return parseProfile(inserted.data, user);
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export async function saveAccountProfile(input: {
  user: AccountUser;
  firstName: string;
  lastName: string;
}): Promise<AccountProfile | null> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: input.user.id,
          email: input.user.email,
          first_name: firstName,
          last_name: lastName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select(PROFILE_COLUMNS)
      .maybeSingle();
    if (error) {
      return {
        id: input.user.id,
        email: input.user.email,
        firstName,
        lastName,
      };
    }
    await supabase.auth.updateUser({
      data: { first_name: firstName, last_name: lastName },
    });
    return data
      ? parseProfile(data, { ...input.user, firstName, lastName })
      : { id: input.user.id, email: input.user.email, firstName, lastName };
  } catch {
    return null;
  }
}

export async function listAccountAddresses(userId: string): Promise<AccountAddress[]> {
  if (!isUuid(userId)) {
    return [];
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("addresses")
      .select(ADDRESS_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error || !data) {
      return [];
    }
    return data
      .map(parseAddress)
      .filter((row): row is AccountAddress => Boolean(row));
  } catch {
    return [];
  }
}

export async function getAccountAddress(
  userId: string,
  addressId: string,
): Promise<AccountAddress | null> {
  if (!isUuid(userId) || !isUuid(addressId)) {
    return null;
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("addresses")
      .select(ADDRESS_COLUMNS)
      .eq("user_id", userId)
      .eq("id", addressId)
      .maybeSingle();
    if (error || !data) {
      return null;
    }
    return parseAddress(data);
  } catch {
    return null;
  }
}

export async function saveAccountAddress(input: {
  userId: string;
  addressId?: string;
  label: string;
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
}): Promise<AccountAddress | null> {
  if (!isUuid(input.userId)) {
    return null;
  }
  const payload = {
    user_id: input.userId,
    label: normalizeAddressLabel(input.label),
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    address_line_1: input.line1.trim(),
    address_line_2: input.line2.trim() || null,
    city: input.city.trim(),
    county: input.county.trim() || null,
    postcode: input.postcode.trim(),
    country: input.country.trim() || CHECKOUT_COUNTRY_GB,
  };
  try {
    const supabase = await createSupabaseServerClient();
    if (input.addressId) {
      if (!isUuid(input.addressId)) {
        return null;
      }
      const { data, error } = await supabase
        .from("addresses")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", input.addressId)
        .eq("user_id", input.userId)
        .select(ADDRESS_COLUMNS)
        .maybeSingle();
      if (error || !data) {
        return null;
      }
      return parseAddress(data);
    }
    const { data, error } = await supabase
      .from("addresses")
      .insert(payload)
      .select(ADDRESS_COLUMNS)
      .maybeSingle();
    if (error || !data) {
      return null;
    }
    return parseAddress(data);
  } catch {
    return null;
  }
}

export async function removeAccountAddress(userId: string, addressId: string): Promise<boolean> {
  if (!isUuid(userId) || !isUuid(addressId)) {
    return false;
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { error, count } = await supabase
      .from("addresses")
      .delete({ count: "exact" })
      .eq("id", addressId)
      .eq("user_id", userId);
    return !error && (count == null || count > 0);
  } catch {
    return false;
  }
}

function parseProfile(value: unknown, fallback: AccountUser): AccountProfile {
  if (!isRecord(value)) {
    return {
      id: fallback.id,
      email: fallback.email,
      firstName: fallback.firstName,
      lastName: fallback.lastName,
    };
  }
  return {
    id: asString(value.id) ?? fallback.id,
    email: asString(value.email) ?? fallback.email,
    firstName: asString(value.first_name) ?? fallback.firstName,
    lastName: asString(value.last_name) ?? fallback.lastName,
  };
}

function parseAddress(value: unknown): AccountAddress | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = asString(value.id);
  const firstName = asString(value.first_name);
  const lastName = asString(value.last_name);
  const line1 = asString(value.address_line_1);
  const city = asString(value.city);
  const postcode = asString(value.postcode);
  const country = asString(value.country);
  if (!id || !firstName || !lastName || !line1 || !city || !postcode || !country) {
    return null;
  }
  return {
    id,
    label: normalizeAddressLabel(asString(value.label)),
    firstName,
    lastName,
    line1,
    line2: asString(value.address_line_2) ?? "",
    city,
    county: asString(value.county) ?? "",
    postcode,
    country,
    isDefault: value.is_default === true,
  };
}

function normalizeAddressLabel(value: string | undefined | null): AccountAddressLabel {
  const trimmed = value?.trim();
  if (trimmed === ADDRESS_LABEL_WORK || trimmed === "Work") {
    return ADDRESS_LABEL_WORK;
  }
  if (trimmed === ADDRESS_LABEL_OTHER || trimmed === "Other") {
    return ADDRESS_LABEL_OTHER;
  }
  return ADDRESS_LABEL_HOME;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
