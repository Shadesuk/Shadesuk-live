"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  retrieveCheckoutAddressAction,
  searchCheckoutAddressAction,
} from "@/app/(storefront)/checkout/actions";
import { saveAddressAction } from "@/app/(storefront)/account/actions";
import {
  AddressForm,
  type AddressFormValue,
} from "@/components/address/AddressForm";
import { AddressLookup } from "@/components/address/AddressLookup";
import { Button } from "@/components/ui/Button";
import { FieldSelect } from "@/components/ui/Field";
import {
  ADD_ADDRESS,
  ADDRESS_LABEL,
  ADDRESS_LABEL_HOME,
  ADDRESS_LABEL_OTHER,
  ADDRESS_LABEL_WORK,
  EDIT_ADDRESS,
  NETWORK_ERROR,
  SAVE_CHANGES,
  SAVED_ADDRESSES_LABEL,
} from "@/lib/account-copy";
import { ENTER_ADDRESS_MANUALLY } from "@/lib/checkout-copy";
import { mergeLookupPostalAddress } from "@/lib/address-merge";
import { routes } from "@/lib/navigation";
import { CHECKOUT_COUNTRY_GB, type CheckoutFieldErrors } from "@/types/checkout";
import type { AccountAddress, AccountAddressLabel } from "@/types/account";
import type { PostalAddress } from "@/types/integrations";
import styles from "./Account.module.css";

const emptyValue = (): AddressFormValue => ({
  firstName: "",
  lastName: "",
  line1: "",
  line2: "",
  city: "",
  county: "",
  postcode: "",
  country: CHECKOUT_COUNTRY_GB,
});

function fromAddress(address: AccountAddress): AddressFormValue {
  return {
    firstName: address.firstName,
    lastName: address.lastName,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    county: address.county,
    postcode: address.postcode,
    country: address.country || CHECKOUT_COUNTRY_GB,
  };
}

type AddressEditorProps = {
  address?: AccountAddress;
};

export function AddressEditor({ address }: AddressEditorProps) {
  const router = useRouter();
  const [label, setLabel] = useState<AccountAddressLabel>(address?.label ?? ADDRESS_LABEL_HOME);
  const [value, setValue] = useState<AddressFormValue>(
    address ? fromAddress(address) : emptyValue(),
  );
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(Boolean(address));
  const [errors, setErrors] = useState<CheckoutFieldErrors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  function applyPostal(next: PostalAddress) {
    setValue((current) => mergeLookupPostalAddress(current, next));
    setShowForm(true);
    setQuery(next.postcode);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    if (!showForm) {
      setShowForm(true);
      return;
    }
    setPending(true);
    setFormError("");
    const result = await saveAddressAction({
      addressId: address?.id,
      label,
      firstName: value.firstName,
      lastName: value.lastName,
      line1: value.line1,
      line2: value.line2,
      city: value.city,
      county: value.county,
      postcode: value.postcode,
      country: value.country,
    });
    if (result.status === "unauthenticated") {
      window.location.assign(routes.account);
      return;
    }
    if (result.status === "invalid") {
      setErrors({
        firstName: result.errors.firstName,
        lastName: result.errors.lastName,
        line1: result.errors.line1,
        city: result.errors.city,
        postcode: result.errors.postcode,
        country: result.errors.country,
        form: result.errors.form,
      });
      setPending(false);
      return;
    }
    if (result.status === "ok") {
      router.replace(routes.accountAddresses);
      router.refresh();
      return;
    }
    setFormError(result.message || NETWORK_ERROR);
    setPending(false);
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate data-account-address>
      <h1 className="text-h2">{address ? EDIT_ADDRESS : ADD_ADDRESS}</h1>
      <p className="text-micro">{SAVED_ADDRESSES_LABEL}</p>
      {formError ? (
        <p className="text-small" role="alert">
          {formError}
        </p>
      ) : null}
      <FieldSelect
        id="address-label"
        name="label"
        label={ADDRESS_LABEL}
        value={label}
        disabled={pending}
        onChange={(event) => setLabel(event.target.value as AccountAddressLabel)}
      >
        <option value={ADDRESS_LABEL_HOME}>{ADDRESS_LABEL_HOME}</option>
        <option value={ADDRESS_LABEL_WORK}>{ADDRESS_LABEL_WORK}</option>
        <option value={ADDRESS_LABEL_OTHER}>{ADDRESS_LABEL_OTHER}</option>
      </FieldSelect>
      <AddressLookup
        query={query}
        onQueryChange={setQuery}
        onSelect={applyPostal}
        onManual={() => setShowForm(true)}
        search={(next) => searchCheckoutAddressAction({ query: next })}
        retrieve={(id) => retrieveCheckoutAddressAction({ id })}
        disabled={pending}
      />
      {showForm ? (
        <AddressForm
          idPrefix="account-address"
          value={value}
          errors={errors}
          disabled={pending}
          onChange={setValue}
        />
      ) : (
        <Button type="button" variant="secondary" onClick={() => setShowForm(true)}>
          {ENTER_ADDRESS_MANUALLY}
        </Button>
      )}
      <div className={styles.actions}>
        <Button type="submit" loading={pending}>
          {address ? SAVE_CHANGES : ADD_ADDRESS}
        </Button>
      </div>
    </form>
  );
}
