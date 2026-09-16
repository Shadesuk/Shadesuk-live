import {
  ADMIN_CATALOGUE_STATUS_LABELS,
  ADMIN_PRODUCT_AVAILABILITY_LABELS,
  CATALOGUE_STATUSES,
  type AdminProductAvailabilityFilter,
  type AdminProductListQuery,
  adminProductListQueryString,
} from "@/contracts/admin/products";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Field, FieldSelect } from "@/components/ui/Field";
import {
  ADMIN_PRODUCTS_APPLY,
  ADMIN_PRODUCTS_CLEAR,
  ADMIN_PRODUCTS_FILTER_ALL,
  ADMIN_PRODUCTS_FILTER_AVAILABILITY,
  ADMIN_PRODUCTS_FILTER_BRAND,
  ADMIN_PRODUCTS_FILTER_STATUS,
  ADMIN_PRODUCTS_SEARCH_HINT,
  ADMIN_PRODUCTS_SEARCH_LABEL,
} from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import styles from "./AdminProducts.module.css";

const AVAILABILITY: AdminProductAvailabilityFilter[] = [
  "all",
  "in_stock",
  "out_of_stock",
  "sold_out",
];

export function AdminProductFilters({
  query,
  brands,
}: {
  query: AdminProductListQuery;
  brands: string[];
}) {
  return (
    <form className={styles.filters} method="get" action={routes.adminProducts}>
      <div className={styles.filterFields}>
        <Field
          id="admin-products-q"
          name="q"
          label={ADMIN_PRODUCTS_SEARCH_LABEL}
          hint={ADMIN_PRODUCTS_SEARCH_HINT}
          defaultValue={query.q}
          autoComplete="off"
        />
        <FieldSelect
          id="admin-products-status"
          name="status"
          label={ADMIN_PRODUCTS_FILTER_STATUS}
          defaultValue={query.status ?? ""}
        >
          <option value="">{ADMIN_PRODUCTS_FILTER_ALL}</option>
          {CATALOGUE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ADMIN_CATALOGUE_STATUS_LABELS[status]}
            </option>
          ))}
        </FieldSelect>
        <FieldSelect
          id="admin-products-availability"
          name="availability"
          label={ADMIN_PRODUCTS_FILTER_AVAILABILITY}
          defaultValue={query.availability}
        >
          {AVAILABILITY.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? ADMIN_PRODUCTS_FILTER_ALL : ADMIN_PRODUCT_AVAILABILITY_LABELS[value]}
            </option>
          ))}
        </FieldSelect>
        <FieldSelect
          id="admin-products-brand"
          name="brand"
          label={ADMIN_PRODUCTS_FILTER_BRAND}
          defaultValue={query.brand}
        >
          <option value="">{ADMIN_PRODUCTS_FILTER_ALL}</option>
          {brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </FieldSelect>
      </div>
      <div className={styles.filterActions}>
        <Button type="submit" variant="primary">
          {ADMIN_PRODUCTS_APPLY}
        </Button>
        <ButtonLink href={routes.adminProducts} variant="tertiary">
          {ADMIN_PRODUCTS_CLEAR}
        </ButtonLink>
      </div>
    </form>
  );
}

export function adminProductsHref(query: AdminProductListQuery, page = query.page): string {
  return `${routes.adminProducts}${adminProductListQueryString(query, page)}`;
}
