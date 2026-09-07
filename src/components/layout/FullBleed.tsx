import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

type FullBleedProps = {
  children: ReactNode;
  className?: string;
};

export function FullBleed({ children, className }: FullBleedProps) {
  return <div className={cx("full-bleed", className)}>{children}</div>;
}
