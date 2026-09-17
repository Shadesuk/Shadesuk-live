import {
  type AdminCollectionListQuery,
  adminCollectionListQueryString,
} from "@/contracts/admin/collections";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Field, FieldSelect } from "@/components/ui/Field";
import {
  ADMIN_COLLECTION_ARCHIVED,
  ADMIN_COLLECTION_HIDDEN,
  ADMIN_COLLECTION_VISIBLE,
  ADMIN_COLLECTIONS_APPLY,
  ADMIN_COLLECTIONS_CLEAR,
  ADMIN_COLLECTIONS_FILTER_ALL,
  ADMIN_COLLECTIONS_FILTER_VISIBILITY,
  ADMIN_COLLECTIONS_SEARCH_HINT,
  ADMIN_COLLECTIONS_SEARCH_LABEL,
} from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import styles from "./AdminCollections.module.css";

export function AdminCollectionFilters({ query }: { query: AdminCollectionListQuery }) {
  return (
    <form className={styles.filters} method="get" action={routes.adminCollections}>
      <div className={styles.filterFields}>
        <Field
          id="admin-collections-q"
          name="q"
          label={ADMIN_COLLECTIONS_SEARCH_LABEL}
          hint={ADMIN_COLLECTIONS_SEARCH_HINT}
          defaultValue={query.q}
          autoComplete="off"
        />
        <FieldSelect
          id="admin-collections-visibility"
          name="visibility"
          label={ADMIN_COLLECTIONS_FILTER_VISIBILITY}
          defaultValue={query.visibility}
        >
          <option value="all">{ADMIN_COLLECTIONS_FILTER_ALL}</option>
          <option value="visible">{ADMIN_COLLECTION_VISIBLE}</option>
          <option value="hidden">{ADMIN_COLLECTION_HIDDEN}</option>
          <option value="archived">{ADMIN_COLLECTION_ARCHIVED}</option>
        </FieldSelect>
      </div>
      <div className={styles.filterActions}>
        <Button type="submit" variant="primary">
          {ADMIN_COLLECTIONS_APPLY}
        </Button>
        <ButtonLink href={routes.adminCollections} variant="tertiary">
          {ADMIN_COLLECTIONS_CLEAR}
        </ButtonLink>
      </div>
    </form>
  );
}

export function adminCollectionsHref(query: AdminCollectionListQuery, page = query.page): string {
  return `${routes.adminCollections}${adminCollectionListQueryString(query, page)}`;
}
