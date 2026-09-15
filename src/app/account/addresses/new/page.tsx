import { AccountNavigation } from "@/components/account/AccountNavigation";
import { AddressEditor } from "@/components/account/AddressEditor";
import { requireAccountUser } from "@/lib/account-session";
import { routes } from "@/lib/navigation";

export default async function NewAddressPage() {
  await requireAccountUser();
  return (
    <>
      <AccountNavigation pathname={routes.accountAddresses} />
      <AddressEditor />
    </>
  );
}
