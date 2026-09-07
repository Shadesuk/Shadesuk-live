import Image from "next/image";
import Link from "next/link";
import { routes } from "@/lib/navigation";
import { site } from "@/lib/site";
import styles from "./BrandMark.module.css";

type BrandMarkProps = {
  priority?: boolean;
};

export function BrandMark({ priority = false }: BrandMarkProps) {
  return (
    <Link href={routes.home} className={styles.mark} aria-label={site.name}>
      <Image
        src="/brand/shadesuk-wordmark.jpg"
        alt=""
        width={1099}
        height={253}
        className={styles.image}
        priority={priority}
      />
    </Link>
  );
}
