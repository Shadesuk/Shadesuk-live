import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { cx } from "@/lib/cx";
import styles from "./Button.module.css";

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "tertiary";
  className?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className,
  onClick,
}: ButtonLinkProps) {
  return (
    <Link
      className={cx(styles.button, styles[variant], className)}
      href={href}
      onClick={onClick}
    >
      <span>{children}</span>
    </Link>
  );
}
