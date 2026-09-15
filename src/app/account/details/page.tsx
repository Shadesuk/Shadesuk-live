import { AccountNavigation } from "@/components/account/AccountNavigation";
import { PersonalDetailsForm } from "@/components/account/PersonalDetailsForm";
import { requireAccountUser } from "@/lib/account-session";
import { routes } from "@/lib/navigation";
import { loadAccountProfile } from "@/services/account";

export default async function AccountDetailsPage() {
  const user = await requireAccountUser();
  const profile = await loadAccountProfile(user);
  return (
    <>
      <AccountNavigation pathname={routes.accountDetails} />
      <PersonalDetailsForm profile={profile} />
    </>
  );
}
