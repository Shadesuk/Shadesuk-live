import type { ReactNode } from "react";
import styles from "./DiscoveryIndex.module.css";

type DiscoveryIndexProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function DiscoveryIndex({
  title,
  description,
  children,
}: DiscoveryIndexProps) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 id="discovery-index-heading" className="text-h2">
          {title}
        </h1>
        {description ? <p className="text-small">{description}</p> : null}
      </header>
      {children}
    </div>
  );
}

type DiscoveryIndexSectionProps = {
  headingId: string;
  title: string;
  children: ReactNode;
};

export function DiscoveryIndexSection({
  headingId,
  title,
  children,
}: DiscoveryIndexSectionProps) {
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className="text-h3">
        {title}
      </h2>
      {children}
    </section>
  );
}
