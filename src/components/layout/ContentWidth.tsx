import type { ElementType, ReactNode } from "react";
import { cx } from "@/lib/cx";

type ContentWidthProps = {
  as?: ElementType;
  children: ReactNode;
  className?: string;
};

export function ContentWidth({
  as: Component = "div",
  children,
  className,
}: ContentWidthProps) {
  return (
    <Component className={cx("content-width", className)}>{children}</Component>
  );
}
