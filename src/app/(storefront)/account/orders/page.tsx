import { redirect } from "next/navigation";
import { AccountNavigation } from "@/components/account/AccountNavigation";
import { AccountOrders } from "@/components/account/AccountOrders";
import { requireAccountUser } from "@/lib/account-session";
import { routes } from "@/lib/navigation";
import { listOwnCustomerOrders } from "@/services/customer-orders";

export default async function AccountOrdersPage() {
  await requireAccountUser(routes.accountOrders);
  const result = await listOwnCustomerOrders();
  if (result.status === "unauthenticated") {
    redirect(routes.account);
  }
  return (
    <>
      <AccountNavigation pathname={routes.accountOrders} />
      <AccountOrders
        orders={result.status === "ok" ? result.data : []}
        error={result.status === "error"}
      />
    </>
  );
}
