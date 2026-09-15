import type { ReactNode } from "react";
import Link from "next/link";
import { isAllowedHelpHref } from "@/lib/help-url";

type InfoTextLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function InfoTextLink({ href, children, className }: InfoTextLinkProps) {
  if (!isAllowedHelpHref(href)) {
    return null;
  }
  if (href.startsWith("https://")) {
    return (
      <a className={className} href={href} rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}
