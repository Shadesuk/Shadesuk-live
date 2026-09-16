import Image from "next/image";
import Link from "next/link";
import {
  ADMIN_CATALOGUE_STATUS_LABELS,
  ADMIN_PRODUCT_AVAILABILITY_LABELS,
  type AdminProductListItem,
  type AdminProductListQuery,
} from "@/contracts/admin/products";
import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  ADMIN_PRODUCTS_ADD,
  ADMIN_PRODUCTS_EMPTY_BODY,
  ADMIN_PRODUCTS_EMPTY_FILTER_BODY,
  ADMIN_PRODUCTS_EMPTY_FILTER_TITLE,
  ADMIN_PRODUCTS_EMPTY_TITLE,
  ADMIN_PRODUCT_COL_BRAND,
  ADMIN_PRODUCT_COL_INVENTORY,
  ADMIN_PRODUCT_COL_NAME,
  ADMIN_PRODUCT_COL_PRICE,
  ADMIN_PRODUCT_COL_STATUS,
  ADMIN_PRODUCT_COL_VARIANTS,
  ADMIN_ORDERS_NEXT,
  ADMIN_ORDERS_PREV,
} from "@/lib/admin-copy";
import { formatGbpMinor } from "@/lib/money";
import { adminProductPath, routes } from "@/lib/navigation";
import { loadAdminProductList } from "@/services/admin-products";
import { AdminProductFilters, adminProductsHref } from "./AdminProductFilters";
import { AdminProductsUnavailable } from "./AdminProductsUnavailable";
import styles from "./AdminProducts.module.css";

export async function AdminProductsList({ query }: { query: AdminProductListQuery }) {
  const result = await loadAdminProductList(query);
  if (result.status !== "ok") {
    return <AdminProductsUnavailable />;
  }
  return (
    <div className={styles.stack}>
      <AdminProductFilters query={query} brands={result.data.brands} />
      <AdminProductsTable
        products={result.data.products}
        query={query}
        total={result.data.total}
        page={result.data.page}
        pageCount={result.data.pageCount}
      />
    </div>
  );
}

export function AdminProductsTable({
  products,
  query,
  total,
  page,
  pageCount,
}: {
  products: AdminProductListItem[];
  query: AdminProductListQuery;
  total: number;
  page: number;
  pageCount: number;
}) {
  const filtered = Boolean(query.q || query.status || query.availability !== "all" || query.brand);
  if (products.length === 0) {
    const noMatch = filtered || page > 1;
    return (
      <div className={styles.quiet}>
        <p className={`text-micro ${styles.quietTitle}`}>
          {noMatch ? ADMIN_PRODUCTS_EMPTY_FILTER_TITLE : ADMIN_PRODUCTS_EMPTY_TITLE}
        </p>
        <p className={`text-small ${styles.quietBody}`}>
          {noMatch ? ADMIN_PRODUCTS_EMPTY_FILTER_BODY : ADMIN_PRODUCTS_EMPTY_BODY}
        </p>
        {noMatch ? null : (
          <ButtonLink href={routes.adminProductsNew} variant="primary">
            {ADMIN_PRODUCTS_ADD}
          </ButtonLink>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className={styles.head} aria-hidden="true">
        <span />
        <span>{ADMIN_PRODUCT_COL_NAME}</span>
        <span>{ADMIN_PRODUCT_COL_BRAND}</span>
        <span>{ADMIN_PRODUCT_COL_PRICE}</span>
        <span>{ADMIN_PRODUCT_COL_STATUS}</span>
        <span>{ADMIN_PRODUCT_COL_INVENTORY}</span>
        <span>{ADMIN_PRODUCT_COL_VARIANTS}</span>
      </div>
      <ul className={styles.list} aria-label="Products">
        {products.map((product) => (
          <li key={product.id}>
            <Link href={adminProductPath(product.id)} className={styles.row}>
              {product.imageSrc && product.imageWidth && product.imageHeight ? (
                <Image
                  src={product.imageSrc}
                  alt=""
                  width={56}
                  height={56}
                  sizes="56px"
                  className={styles.thumb}
                />
              ) : (
                <span className={styles.thumbEmpty} aria-hidden="true" />
              )}
              <p className={`text-small ${styles.name}`}>
                <span className="visually-hidden">{ADMIN_PRODUCT_COL_NAME} </span>
                {product.name}
              </p>
              <span className="text-small">
                <span className="visually-hidden">{ADMIN_PRODUCT_COL_BRAND} </span>
                {product.brand || "—"}
              </span>
              <span className={styles.meta}>
                <span className={`text-small ${styles.amount}`}>
                  <span className="visually-hidden">{ADMIN_PRODUCT_COL_PRICE} </span>
                  {product.priceMinor == null ? "—" : formatGbpMinor(product.priceMinor)}
                </span>
                <span className="text-small">
                  <span className="visually-hidden">{ADMIN_PRODUCT_COL_STATUS} </span>
                  {ADMIN_CATALOGUE_STATUS_LABELS[product.status]}
                </span>
                <span className="text-small">
                  <span className="visually-hidden">{ADMIN_PRODUCT_COL_INVENTORY} </span>
                  {ADMIN_PRODUCT_AVAILABILITY_LABELS[product.availability]}
                  {` · ${product.stockQuantity}`}
                </span>
                <span className="text-small">
                  <span className="visually-hidden">{ADMIN_PRODUCT_COL_VARIANTS} </span>
                  {product.variantCount}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {pageCount > 1 ? (
        <nav className={styles.pagination} aria-label="Pagination">
          {page > 1 ? (
            <ButtonLink href={adminProductsHref(query, page - 1)} variant="secondary">
              {ADMIN_ORDERS_PREV}
            </ButtonLink>
          ) : (
            <span />
          )}
          <p className="text-small">
            {page} / {pageCount} · {total}
          </p>
          {page < pageCount ? (
            <ButtonLink href={adminProductsHref(query, page + 1)} variant="secondary">
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
