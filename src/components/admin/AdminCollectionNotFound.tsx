import { ButtonLink } from "@/components/ui/ButtonLink";
import {
  ADMIN_COLLECTION_BACK,
  ADMIN_COLLECTION_NOT_FOUND_BODY,
  ADMIN_COLLECTION_NOT_FOUND_TITLE,
} from "@/lib/admin-copy";
import { routes } from "@/lib/navigation";
import styles from "./AdminCollections.module.css";

export function AdminCollectionNotFound() {
  return (
    <div className={styles.unavailable}>
      <h1 className="text-h2">{ADMIN_COLLECTION_NOT_FOUND_TITLE}</h1>
      <p className={`text-body ${styles.quietBody}`}>{ADMIN_COLLECTION_NOT_FOUND_BODY}</p>
      <ButtonLink href={routes.adminCollections} variant="secondary">
        {ADMIN_COLLECTION_BACK}
      </ButtonLink>
    </div>
  );
}
