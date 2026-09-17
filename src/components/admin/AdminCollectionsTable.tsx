import Link from "next/link";
import {
  ADMIN_COLLECTION_STATUS_LABELS,
  type AdminCollectionListItem,
  type AdminCollectionListQuery,
} from "@/contracts/admin/collections";
import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  ADMIN_COLLECTION_COL_ACTIONS,
  ADMIN_COLLECTION_COL_NAME,
  ADMIN_COLLECTION_COL_PRODUCTS,
  ADMIN_COLLECTION_COL_SLUG,
  ADMIN_COLLECTION_COL_UPDATED,
  ADMIN_COLLECTION_COL_VISIBILITY,
  ADMIN_COLLECTION_EDIT,
  ADMIN_COLLECTIONS_ADD,
  ADMIN_COLLECTIONS_EMPTY_BODY,
  ADMIN_COLLECTIONS_EMPTY_FILTER_BODY,
  ADMIN_COLLECTIONS_EMPTY_FILTER_TITLE,
  ADMIN_COLLECTIONS_EMPTY_TITLE,
  ADMIN_ORDERS_NEXT,
  ADMIN_ORDERS_PREV,
} from "@/lib/admin-copy";
import { formatAdminDateTime } from "@/lib/admin-format";
import { adminCollectionPath, routes } from "@/lib/navigation";
import { loadAdminCollectionList } from "@/services/admin-collections";
import { AdminCollectionFilters, adminCollectionsHref } from "./AdminCollectionFilters";
import { AdminCollectionsUnavailable } from "./AdminCollectionsUnavailable";
import styles from "./AdminCollections.module.css";

export async function AdminCollectionsList({ query }: { query: AdminCollectionListQuery }) {
  const result = await loadAdminCollectionList(query);
  if (result.status !== "ok") {
    return <AdminCollectionsUnavailable />;
  }
  return (
    <div className={styles.stack}>
      <AdminCollectionFilters query={query} />
      <AdminCollectionsTable
        collections={result.data.collections}
        query={query}
        total={result.data.total}
        page={result.data.page}
        pageCount={result.data.pageCount}
      />
    </div>
  );
}

export function AdminCollectionsTable({
  collections,
  query,
  total,
  page,
  pageCount,
}: {
  collections: AdminCollectionListItem[];
  query: AdminCollectionListQuery;
  total: number;
  page: number;
  pageCount: number;
}) {
  const filtered = Boolean(query.q || query.visibility !== "all");
  if (collections.length === 0) {
    const noMatch = filtered || page > 1;
    return (
      <div className={styles.quiet}>
        <p className={`text-micro ${styles.quietTitle}`}>
          {noMatch ? ADMIN_COLLECTIONS_EMPTY_FILTER_TITLE : ADMIN_COLLECTIONS_EMPTY_TITLE}
        </p>
        <p className={`text-small ${styles.quietBody}`}>
          {noMatch ? ADMIN_COLLECTIONS_EMPTY_FILTER_BODY : ADMIN_COLLECTIONS_EMPTY_BODY}
        </p>
        {noMatch ? null : (
          <ButtonLink href={routes.adminCollectionsNew} variant="primary">
            {ADMIN_COLLECTIONS_ADD}
          </ButtonLink>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className={styles.head} aria-hidden="true">
        <span>{ADMIN_COLLECTION_COL_NAME}</span>
        <span>{ADMIN_COLLECTION_COL_SLUG}</span>
        <span>{ADMIN_COLLECTION_COL_VISIBILITY}</span>
        <span>{ADMIN_COLLECTION_COL_PRODUCTS}</span>
        <span>{ADMIN_COLLECTION_COL_UPDATED}</span>
      </div>
      <ul className={styles.list} aria-label="Collections">
        {collections.map((collection) => (
          <li key={collection.id}>
            <Link href={adminCollectionPath(collection.id)} className={styles.row}>
              <p className={`text-small ${styles.name}`}>
                <span className="visually-hidden">{ADMIN_COLLECTION_COL_NAME} </span>
                {collection.name}
              </p>
              <span className={`text-small ${styles.slugValue}`}>
                <span className="visually-hidden">{ADMIN_COLLECTION_COL_SLUG} </span>
                {collection.slug}
              </span>
              <span className={styles.meta}>
                <span className="text-small">
                  <span className="visually-hidden">{ADMIN_COLLECTION_COL_VISIBILITY} </span>
                  {ADMIN_COLLECTION_STATUS_LABELS[collection.status]}
                </span>
                <span className="text-small">
                  <span className="visually-hidden">{ADMIN_COLLECTION_COL_PRODUCTS} </span>
                  {collection.productCount}
                </span>
                <span className="text-small">
                  <span className="visually-hidden">{ADMIN_COLLECTION_COL_UPDATED} </span>
                  {formatAdminDateTime(collection.updatedAt)}
                </span>
                <span className="visually-hidden">
                  {ADMIN_COLLECTION_COL_ACTIONS}: {ADMIN_COLLECTION_EDIT}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {pageCount > 1 ? (
        <nav className={styles.pagination} aria-label="Pagination">
          {page > 1 ? (
            <ButtonLink href={adminCollectionsHref(query, page - 1)} variant="secondary">
              {ADMIN_ORDERS_PREV}
            </ButtonLink>
          ) : (
            <span />
          )}
          <p className="text-small">
            {page} / {pageCount} · {total}
          </p>
          {page < pageCount ? (
            <ButtonLink href={adminCollectionsHref(query, page + 1)} variant="secondary">
              {ADMIN_ORDERS_NEXT}
            </ButtonLink>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
