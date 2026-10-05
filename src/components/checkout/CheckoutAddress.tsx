"use client";

import { useState, type FormEvent } from "react";
import { AddressForm, type AddressFormValue } from "@/components/address/AddressForm";
import { AddressLookup } from "@/components/address/AddressLookup";
import { Button } from "@/components/ui/Button";
import {
  BACK,
  CONTINUE,
  DELIVERY_HEADING,
  SHIPPING_BODY,
  SHIPPING_HEADING,
  SHIPPING_INFORMATION,
  SHIPPING_MANUAL_NOTE,
  SHIPPING_MINIMUM,
} from "@/lib/checkout-copy";
import { routes } from "@/lib/navigation";
import type { AddressLookupView, AddressRetrieveView, CheckoutFieldErrors } from "@/types/checkout";
import type { PostalAddress } from "@/types/integrations";
import styles from "./CheckoutAddress.module.css";

type CheckoutAddressProps = {
  value: AddressFormValue;
  query: string;
  showForm: boolean;
  errors?: CheckoutFieldErrors;
  pending?: boolean;
  onQueryChange: (query: string) => void;
  onChange: (next: AddressFormValue) => void;
  onManual: () => void;
  onSelect: (address: PostalAddress) => void;
  onBack: () => void;
  onSubmit: () => Promise<void>;
  search: (query: string) => Promise<AddressLookupView>;
  retrieve: (id: string) => Promise<AddressRetrieveView>;
};

export function CheckoutAddress({
  value,
  query,
  showForm,
  errors,
  pending = false,
  onQueryChange,
  onChange,
  onManual,
  onSelect,
  onBack,
  onSubmit,
  search,
  retrieve,
}: CheckoutAddressProps) {
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || submitted) {
      return;
    }
    if (!showForm) {
      onManual();
      return;
    }
    setSubmitted(true);
    try {
      await onSubmit();
    } finally {
      setSubmitted(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate data-checkout-address>
      <h2 className="text-h3">{DELIVERY_HEADING}</h2>
      <AddressLookup
        query={query}
        country={value.country}
        onQueryChange={onQueryChange}
        onSelect={onSelect}
        onManual={onManual}
        search={search}
        retrieve={retrieve}
        disabled={pending}
      />
      {showForm ? (
        <AddressForm
          idPrefix="checkout"
          value={value}
          errors={errors}
          disabled={pending}
          onChange={onChange}
        />
      ) : null}
      <section className={styles.shipping} aria-labelledby="checkout-shipping-heading">
        <h3 id="checkout-shipping-heading" className="text-micro">
          {SHIPPING_HEADING}
        </h3>
        <p className="text-small">{SHIPPING_MINIMUM}</p>
        <p className="text-small">{SHIPPING_BODY}</p>
        <p className="text-small">{SHIPPING_MANUAL_NOTE}</p>
        <p className="text-small">
          <a href={routes.shipping}>{SHIPPING_INFORMATION} →</a>
        </p>
      </section>
      <div className={styles.actions}>
        <Button type="submit" loading={pending}>
          {CONTINUE}
        </Button>
        <Button type="button" variant="tertiary" onClick={onBack} disabled={pending}>
          {BACK}
        </Button>
      </div>
    </form>
  );
}
