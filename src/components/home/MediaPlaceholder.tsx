import { cx } from "@/lib/cx";
import styles from "./MediaPlaceholder.module.css";

type MediaPlaceholderProps = {
  label: string;
  ratio?: "campaign" | "editorial" | "square" | "story";
  className?: string;
};

export function MediaPlaceholder({
  label,
  ratio = "editorial",
  className,
}: MediaPlaceholderProps) {
  return (
    <div
      className={cx(styles.frame, styles[ratio], className)}
      role="img"
      aria-label={label}
    >
      <span className="text-micro" aria-hidden="true">
        {label}
      </span>
    </div>
  );
}
