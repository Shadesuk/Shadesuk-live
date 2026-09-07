import type { ElementType, ReactNode } from "react";
import { cx } from "@/lib/cx";

type GridProps = {
  children: ReactNode;
  className?: string;
  variant?: "page" | "product";
  as?: ElementType;
};

export function Grid({
  children,
  className,
  variant = "page",
  as: Component = "div",
}: GridProps) {
  return (
    <Component
      className={cx(
        "grid",
        variant === "product" && "grid--product",
        className,
      )}
    >
      {children}
    </Component>
  );
}

type GridItemProps = {
  children: ReactNode;
  className?: string;
  spanAll?: boolean;
  as?: ElementType;
};

export function GridItem({
  children,
  className,
  spanAll,
  as: Component = "div",
}: GridItemProps) {
  return (
    <Component className={cx(spanAll && "grid__span-all", className)}>
      {children}
    </Component>
  );
}
