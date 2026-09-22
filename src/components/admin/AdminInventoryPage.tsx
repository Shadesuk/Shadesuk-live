import { Suspense } from "react";
import Link from "next/link";
import {
  adminInventoryHref,
  INVENTORY_VIEW_LABELS,
  INVENTORY_VIEWS,
  inventoryStockDescription,
  lowStockEmptyBody,
  type InventoryView,
  type OpsInventoryRow,
} from "@/contracts/admin/ops";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  ADMIN_INVENTORY_COL_COLOUR,
  ADMIN_INVENTORY_COL_PRODUCT,
  ADMIN_INVENTORY_COL_SKU,
  ADMIN_INVENTORY_COL_STOCK,
  ADMIN_INVENTORY_LOADING,
  ADMIN_INVENTORY_LOW_COUNT,
  ADMIN_INVENTORY_LOW_EMPTY_TITLE,
  ADMIN_INVENTORY_LOW_PRODUCTS,
  ADMIN_INVENTORY_NAV,
  ADMIN_INVENTORY_OUT_COUNT,
  ADMIN_INVENTORY_OUT_EMPTY_BODY,
  ADMIN_INVENTORY_OUT_EMPTY_TITLE,
  ADMIN_INVENTORY_TITLE,
  ADMIN_INVENTORY_UNAVAILABLE_BODY,
  ADMIN_INVENTORY_UNAVAILABLE_TITLE,
} from "@/lib/admin-copy";
import { adminProductPath } from "@/lib/navigation";
import { loadInventory } from "@/services/admin-ops";
import { AdminDashboardUnavailable } from "./AdminDashboardUnavailable";
import { AdminOpsEmpty, AdminOpsPagination, AdminOpsSkeleton, AdminOpsViewNav } from "./AdminOpsChrome";
import styles from "./AdminOps.module.css";

export function AdminInventoryPage({ view, page }: { view: InventoryView; page: number }) {
  const description = inventoryStockDescription();
  return (
    <div data-admin-inventory data-inventory-view={view}>
      <AdminPageHeader
        title={ADMIN_INVENTORY_TITLE}
        description={description}
        action={
          <AdminOpsViewNav
            label={ADMIN_INVENTORY_NAV}
            views={INVENTORY_VIEWS}
            labels={INVENTORY_VIEW_LABELS}
            current={view}
            hrefFor={(next) => adminInventoryHref(next)}
          />
        }
      />
      <div className={styles.stack}>
        <Suspense fallback={<AdminOpsSkeleton label={ADMIN_INVENTORY_LOADING} />}>
          <InventoryQueue view={view} page={page} />
        </Suspense>
      </div>
    </div>
  );
}

async function InventoryQueue({ view, page }: { view: InventoryView; page: number }) {
  const result = await loadInventory(view, page);
  if (result.status !== "ok") {
    return (
      <AdminDashboardUnavailable
        title={ADMIN_INVENTORY_UNAVAILABLE_TITLE}
        body={ADMIN_INVENTORY_UNAVAILABLE_BODY}
      />
    );
  }
  const { lowVariants, lowProducts, outVariants, page: list } = result.data;
  return (
    <div className={styles.stack}>
      <ul className={styles.counts}>
        <li className={styles.count}>
          <p className={`text-micro ${styles.countLabel}`}>{ADMIN_INVENTORY_LOW_PRODUCTS}</p>
          <p className={`text-h3 ${styles.countValue}`}>{lowProducts}</p>
        </li>
        <li className={styles.count}>
          <p className={`text-micro ${styles.countLabel}`}>{ADMIN_INVENTORY_LOW_COUNT}</p>
          <p className={`text-h3 ${styles.countValue}`}>{lowVariants}</p>
        </li>
        <li className={styles.count}>
          <p className={`text-micro ${styles.countLabel}`}>{ADMIN_INVENTORY_OUT_COUNT}</p>
          <p className={`text-h3 ${styles.countValue}`}>{outVariants}</p>
        </li>
      </ul>
      {list.rows.length === 0 ? (
        <AdminOpsEmpty
          title={view === "out" ? ADMIN_INVENTORY_OUT_EMPTY_TITLE : ADMIN_INVENTORY_LOW_EMPTY_TITLE}
          body={view === "out" ? ADMIN_INVENTORY_OUT_EMPTY_BODY : lowStockEmptyBody()}
        />
      ) : (
        <div>
          <div className={`${styles.head} ${styles.inventoryHead}`} aria-hidden="true">
            <span>{ADMIN_INVENTORY_COL_PRODUCT}</span>
            <span>{ADMIN_INVENTORY_COL_SKU}</span>
            <span>{ADMIN_INVENTORY_COL_COLOUR}</span>
            <span>{ADMIN_INVENTORY_COL_STOCK}</span>
          </div>
          <ul className={styles.list} aria-label={ADMIN_INVENTORY_TITLE}>
            {list.rows.map((row) => (
              <li key={row.variantId}>
                <InventoryRow row={row} />
              </li>
            ))}
          </ul>
          <AdminOpsPagination
            page={list.page}
            pageCount={list.pageCount}
            total={list.total}
            hrefFor={(next) => adminInventoryHref(view, next)}
          />
        </div>
      )}
    </div>
  );
}

function InventoryRow({ row }: { row: OpsInventoryRow }) {
  return (
    <Link href={adminProductPath(row.productId)} className={`${styles.row} ${styles.inventoryRow}`}>
      <p className={`text-small ${styles.primary}`}>
        <span className="visually-hidden">{ADMIN_INVENTORY_COL_PRODUCT} </span>
        {row.productName}
      </p>
      <span className={styles.meta}>
        <span className="text-small">
          <span className="visually-hidden">{ADMIN_INVENTORY_COL_SKU} </span>
          {row.sku}
        </span>
        <span className="text-small">
          <span className="visually-hidden">{ADMIN_INVENTORY_COL_COLOUR} </span>
          {row.colourName}
        </span>
        <span className={`text-small ${styles.stock}`}>
          <span className="visually-hidden">{ADMIN_INVENTORY_COL_STOCK} </span>
          {row.stockQuantity}
        </span>
      </span>
    </Link>
  );
}
