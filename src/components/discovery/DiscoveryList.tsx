import Link from "next/link";
import styles from "./DiscoveryList.module.css";

export type DiscoveryListItem = {
  href: string;
  title: string;
  meta?: string;
};

type DiscoveryListProps = {
  items: DiscoveryListItem[];
  labelledBy?: string;
};

export function DiscoveryList({ items, labelledBy }: DiscoveryListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className={styles.list} aria-labelledby={labelledBy}>
      {items.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className={styles.link}>
            <span className="text-h3">{item.title}</span>
            {item.meta ? <span className="text-micro">{item.meta}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
