import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
};

export function PageContainer({ children, className }: PageContainerProps) {
  return <div className={cx("page-container", className)}>{children}</div>;
}
