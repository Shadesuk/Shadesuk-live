import type { ReactNode } from "react";
import { CollectionIntro } from "./CollectionIntro";
import { ProductCount } from "./ProductCount";
import styles from "./CollectionHeader.module.css";

type CollectionHeaderProps = {
  title: string;
  description?: string;
  count: number;
  controls: ReactNode;
};

export function CollectionHeader({
  title,
  description,
  count,
  controls,
}: CollectionHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.copy}>
        <h1 className="text-h2">{title}</h1>
        {description ? <CollectionIntro>{description}</CollectionIntro> : null}
        <ProductCount count={count} />
      </div>
      <div className={styles.controls}>{controls}</div>
    </header>
  );
}
