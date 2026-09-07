"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { isCurrentPath } from "@/lib/navigation";
import styles from "./NavLink.module.css";

type NavLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
};

export function NavLink({ href, children, className, onClick }: NavLinkProps) {
  const pathname = usePathname();
  const current = isCurrentPath(pathname, href);

  return (
    <Link
      href={href}
      className={cx(styles.link, current && styles.current, className)}
      aria-current={current ? "page" : undefined}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
