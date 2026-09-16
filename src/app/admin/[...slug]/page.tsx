import { AdminNotFound } from "@/components/admin/AdminNotFound";

/** Unmatched /admin/* stays in the Admin layout, not the storefront chrome. */
export default function AdminUnmatchedPage() {
  return <AdminNotFound />;
}
