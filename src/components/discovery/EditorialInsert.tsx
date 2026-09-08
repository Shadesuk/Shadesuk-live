import type { ReactNode } from "react";
import styles from "./EditorialInsert.module.css";

type EditorialInsertProps = {
  title?: string;
  children?: ReactNode;
};

export function EditorialInsert({ title, children }: EditorialInsertProps) {
  return (
    <aside className={styles.insert}>
      <div className={`text-micro ${styles.image}`}>Editorial image</div>
      {title ? <p className="text-h3">{title}</p> : null}
      {children}
    </aside>
  );
}
