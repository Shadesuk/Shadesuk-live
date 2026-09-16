import { notFound } from "next/navigation";

/** Unmatched /admin/* stays in the Admin layout (no storefront SiteChrome). */
export default function AdminUnmatchedPage() {
  notFound();
}
