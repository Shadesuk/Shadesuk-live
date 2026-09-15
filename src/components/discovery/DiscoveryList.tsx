import Link from "next/link";
import { MediaSlot, type MediaSlotAsset } from "@/components/media/MediaSlot";
import { cx } from "@/lib/cx";
import styles from "./DiscoveryList.module.css";

export type DiscoveryListItem = {
  href: string;
  title: string;
  meta?: string;
  image?: MediaSlotAsset | null;
};

type DiscoveryListProps = {
  items: DiscoveryListItem[];
  labelledBy?: string;
  variant?: "list" | "cards";
};

export function DiscoveryList({
  items,
  labelledBy,
  variant = "list",
}: DiscoveryListProps) {
  if (items.length === 0) {
    return null;
  }

  const cards = variant === "cards";

  return (
    <ul
      className={cx(styles.list, cards && styles.cards)}
      aria-labelledby={labelledBy}
    >
      {items.map((item) => (
        <li key={item.href}>
          <Link href={item.href} className={cards ? styles.card : styles.link}>
            {cards ? (
              <MediaSlot
                label={`${item.title} photography`}
                ratio="square"
                image={item.image}
                sizes="(min-width: 1200px) 25vw, (min-width: 768px) 33vw, 50vw"
              />
            ) : null}
            <span className="text-h3">{item.title}</span>
            {item.meta ? <span className="text-micro">{item.meta}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
