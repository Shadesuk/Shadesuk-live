import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

type SectionProps = {
  children: ReactNode;
  className?: string;
  compact?: boolean;
  labelledBy?: string;
};

export function Section({
  children,
  className,
  compact = false,
  labelledBy,
}: SectionProps) {
  return (
    <section
      className={cx("section", compact && "section--compact", className)}
      aria-labelledby={labelledBy}
    >
      {children}
    </section>
  );
}
