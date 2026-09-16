import { AccountNavigation } from "@/components/account/AccountNavigation";
import { SavedAddresses } from "@/components/account/SavedAddresses";
import { requireAccountUser } from "@/lib/account-session";
import { routes } from "@/lib/navigation";
import { listAccountAddresses } from "@/services/account";

export default async function AccountAddressesPage() {
  const user = await requireAccountUser();
  const addresses = await listAccountAddresses(user.id);
  return (
    <>
      <AccountNavigation pathname={routes.accountAddresses} />
      <SavedAddresses addresses={addresses} />
    </>
  );
}
