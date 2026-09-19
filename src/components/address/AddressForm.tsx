"use client";

import { Field, FieldSelect } from "@/components/ui/Field";
import {
  ADDRESS_COMPLETE_HINT,
  ADDRESS_LINE_1_LABEL,
  ADDRESS_LINE_1_PLACEHOLDER,
  ADDRESS_LINE_2_LABEL,
  ADDRESS_LINE_2_PLACEHOLDER,
  CITY_LABEL,
  COUNTRY_LABEL,
  COUNTY_LABEL,
  FIRST_NAME_LABEL,
  LAST_NAME_LABEL,
  POSTCODE_LABEL,
  UNITED_KINGDOM,
} from "@/lib/checkout-copy";
import { CHECKOUT_COUNTRY_GB, type CheckoutFieldErrors } from "@/types/checkout";
import styles from "./AddressForm.module.css";

export type AddressFormValue = {
  firstName: string;
  lastName: string;
  line1: string;
  line2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
};

type AddressFormProps = {
  idPrefix: string;
  value: AddressFormValue;
  errors?: CheckoutFieldErrors;
  disabled?: boolean;
  onChange: (next: AddressFormValue) => void;
};

export function AddressForm({
  idPrefix,
  value,
  errors,
  disabled = false,
  onChange,
}: AddressFormProps) {
  function patch(partial: Partial<AddressFormValue>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className={styles.form} data-address-form>
      <div className={styles.row}>
        <Field
          id={`${idPrefix}-first-name`}
          name="firstName"
          label={FIRST_NAME_LABEL}
          autoComplete="given-name"
          value={value.firstName}
          required
          disabled={disabled}
          error={errors?.firstName}
          onChange={(event) => patch({ firstName: event.target.value })}
        />
        <Field
          id={`${idPrefix}-last-name`}
          name="lastName"
          label={LAST_NAME_LABEL}
          autoComplete="family-name"
          value={value.lastName}
          required
          disabled={disabled}
          error={errors?.lastName}
          onChange={(event) => patch({ lastName: event.target.value })}
        />
      </div>
      <Field
        id={`${idPrefix}-line1`}
        name="line1"
        label={ADDRESS_LINE_1_LABEL}
        placeholder={ADDRESS_LINE_1_PLACEHOLDER}
        autoComplete="address-line1"
        value={value.line1}
        required
        disabled={disabled}
        hint={ADDRESS_COMPLETE_HINT}
        error={errors?.line1}
        onChange={(event) => patch({ line1: event.target.value })}
      />
      <Field
        id={`${idPrefix}-line2`}
        name="line2"
        label={ADDRESS_LINE_2_LABEL}
        placeholder={ADDRESS_LINE_2_PLACEHOLDER}
        autoComplete="address-line2"
        value={value.line2}
        disabled={disabled}
        error={errors?.line2}
        onChange={(event) => patch({ line2: event.target.value })}
      />
      <Field
        id={`${idPrefix}-city`}
        name="city"
        label={CITY_LABEL}
        autoComplete="address-level2"
        value={value.city}
        required
        disabled={disabled}
        error={errors?.city}
        onChange={(event) => patch({ city: event.target.value })}
      />
      <Field
        id={`${idPrefix}-county`}
        name="county"
        label={COUNTY_LABEL}
        autoComplete="address-level1"
        value={value.county}
        disabled={disabled}
        error={errors?.county}
        onChange={(event) => patch({ county: event.target.value })}
      />
      <div className={styles.row}>
        <Field
          id={`${idPrefix}-postcode`}
          name="postcode"
          label={POSTCODE_LABEL}
          autoComplete="postal-code"
          autoCapitalize="characters"
          value={value.postcode}
          required
          disabled={disabled}
          error={errors?.postcode}
          onChange={(event) => patch({ postcode: event.target.value })}
        />
        <FieldSelect
          id={`${idPrefix}-country`}
          name="country"
          label={COUNTRY_LABEL}
          autoComplete="country"
          value={value.country || CHECKOUT_COUNTRY_GB}
          required
          disabled={disabled}
          error={errors?.country}
          onChange={(event) => patch({ country: event.target.value })}
        >
          <option value={CHECKOUT_COUNTRY_GB}>{UNITED_KINGDOM}</option>
        </FieldSelect>
      </div>
    </div>
  );
}
