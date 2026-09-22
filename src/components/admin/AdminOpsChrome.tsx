import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ADMIN_OPS_NEXT, ADMIN_OPS_PREV } from "@/lib/admin-copy";
import { cx } from "@/lib/cx";
import styles from "./AdminOps.module.css";

export function AdminOpsViewNav<T extends string>({
  label,
  views,
  labels,
  current,
  hrefFor,
}: {
  label: string;
  views: readonly T[];
  labels: Record<T, string>;
  current: T;
  hrefFor: (view: T) => string;
}) {
  return (
    <nav className={styles.nav} aria-label={label}>
      <ul className={styles.views}>
        {views.map((view) => {
          const active = view === current;
          return (
            <li key={view}>
              <Link
                href={hrefFor(view)}
                className={cx(styles.view, active ? styles.viewCurrent : undefined)}
                aria-current={active ? "page" : undefined}
              >
                {labels[view]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AdminOpsEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className={styles.quiet}>
      <p className={`text-micro ${styles.quietTitle}`}>{title}</p>
      <p className={`text-small ${styles.quietBody}`}>{body}</p>
    </div>
  );
}

export function AdminOpsPagination({
  page,
  pageCount,
  total,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) {
    return null;
  }
  return (
    <nav className={styles.pagination} aria-label="Pagination">
      {page > 1 ? (
        <ButtonLink href={hrefFor(page - 1)} variant="secondary">
          {ADMIN_OPS_PREV}
        </ButtonLink>
      ) : (
        <span />
      )}
      <p className="text-small">
        {page} / {pageCount} · {total}
      </p>
      {page < pageCount ? (
        <ButtonLink href={hrefFor(page + 1)} variant="secondary">
          {ADMIN_OPS_NEXT}
        </ButtonLink>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function AdminOpsSkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <p className="visually-hidden" role="status">
        {label}
      </p>
      {["a", "b", "c", "d"].map((key) => (
        <div key={key} className={`${styles.skeletonBlock} ${styles.skeletonRow}`} aria-hidden="true" />
      ))}
    </div>
  );
}
