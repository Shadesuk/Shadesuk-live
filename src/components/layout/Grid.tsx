import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

type GridProps = {
  children: ReactNode;
  className?: string;
  variant?: "page" | "product";
};

export function Grid({
  children,
  className,
  variant = "page",
}: GridProps) {
  return (
    <div
      className={cx(
        "grid",
        variant === "product" && "grid--product",
        className,
      )}
    >
      {children}
    </div>
  );
}

type GridItemProps = {
  children: ReactNode;
  className?: string;
  spanAll?: boolean;
};

export function GridItem({ children, className, spanAll }: GridItemProps) {
  return (
    <div className={cx(spanAll && "grid__span-all", className)}>{children}</div>
  );
}
