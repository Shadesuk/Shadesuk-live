import Image from "next/image";
import Link from "next/link";
import { routes } from "@/lib/navigation";
import { site } from "@/lib/site";
import { cx } from "@/lib/cx";
import styles from "./BrandMark.module.css";

const ASSETS = {
  wordmark: {
    src: "/brand/shadesuk-wordmark.png",
    width: 638,
    height: 138,
  },
  lockup: {
    src: "/brand/shadesuk-lockup.png",
    width: 965,
    height: 138,
  },
} as const;

type BrandMarkProps = {
  priority?: boolean;
  variant?: keyof typeof ASSETS;
};

export function BrandMark({ priority = false, variant = "wordmark" }: BrandMarkProps) {
  const asset = ASSETS[variant];

  return (
    <Link href={routes.home} className={styles.mark} aria-label={site.name}>
      <Image
        src={asset.src}
        alt=""
        width={asset.width}
        height={asset.height}
        className={cx(styles.image, variant === "lockup" && styles.lockup)}
        priority={priority}
      />
    </Link>
  );
}
