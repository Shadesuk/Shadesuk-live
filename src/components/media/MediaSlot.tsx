import Image from "next/image";
import { cx } from "@/lib/cx";
import styles from "./MediaSlot.module.css";

export type MediaSlotAsset = {
  alt: string;
  width: number;
  height: number;
  src?: string;
};

type MediaSlotProps = {
  label: string;
  image?: MediaSlotAsset | null;
  ratio?: "campaign" | "editorial" | "square" | "story";
  sizes?: string;
  priority?: boolean;
  compactEmpty?: boolean;
  className?: string;
};

export function MediaSlot({
  label,
  image,
  ratio = "square",
  sizes,
  priority = false,
  compactEmpty = false,
  className,
}: MediaSlotProps) {
  const filled = Boolean(image?.src);

  return (
    <div
      className={cx(
        styles.slot,
        styles[ratio],
        compactEmpty && !filled && styles.compactEmpty,
        className,
      )}
      data-filled={filled || undefined}
      role={filled ? undefined : "img"}
      aria-label={filled ? undefined : label}
    >
      {filled && image?.src ? (
        <Image
          src={image.src}
          alt={image.alt || label}
          width={image.width}
          height={image.height}
          className={styles.image}
          sizes={sizes}
          priority={priority}
        />
      ) : (
        <span className={styles.empty} aria-hidden="true" />
      )}
    </div>
  );
}
