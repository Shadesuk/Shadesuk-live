import { AccountNavigation } from "@/components/account/AccountNavigation";
import { OrdersPlaceholder } from "@/components/account/OrdersPlaceholder";
import { routes } from "@/lib/navigation";
import { requireAccountUser } from "@/lib/account-session";

export default async function AccountOrdersPage() {
  await requireAccountUser();
  return (
    <>
      <AccountNavigation pathname={routes.accountOrders} />
      <OrdersPlaceholder />
    </>
  );
}
