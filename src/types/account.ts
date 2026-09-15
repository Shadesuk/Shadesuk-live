export type AccountFieldErrors = Partial<
  Record<
    | "email"
    | "password"
    | "firstName"
    | "lastName"
    | "form"
    | "label"
    | "line1"
    | "city"
    | "postcode"
    | "country",
    string
  >
>;

export type AccountUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type AccountProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type AccountAddressLabel = "Home" | "Work" | "Other";

export type AccountAddress = {
  id: string;
  label: AccountAddressLabel;
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
  isDefault: boolean;
};

export type AuthActionResult =
  | { status: "ok"; redirectTo?: string; message?: string }
  | { status: "invalid"; errors: AccountFieldErrors }
  | { status: "error"; message: string }
  | { status: "confirm_email" }
  | { status: "reset_sent" }
  | { status: "oauth"; url: string };

export type AccountMutationResult =
  | { status: "ok"; message?: string }
  | { status: "invalid"; errors: AccountFieldErrors }
  | { status: "error"; message: string }
  | { status: "unauthenticated" };

export const ACCOUNT_ADDRESS_LABELS: AccountAddressLabel[] = ["Home", "Work", "Other"];
