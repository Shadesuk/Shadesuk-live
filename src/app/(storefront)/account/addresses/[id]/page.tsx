import { notFound } from "next/navigation";
import { AccountNavigation } from "@/components/account/AccountNavigation";
import { AddressEditor } from "@/components/account/AddressEditor";
import { requireAccountUser } from "@/lib/account-session";
import { routes } from "@/lib/navigation";
import { getAccountAddress } from "@/services/account";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditAddressPage({ params }: PageProps) {
  const user = await requireAccountUser();
  const { id } = await params;
  const address = await getAccountAddress(user.id, id);
  if (!address) {
    notFound();
  }
  return (
    <>
      <AccountNavigation pathname={routes.accountAddresses} />
      <AddressEditor address={address} />
    </>
  );
}
