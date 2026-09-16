import { redirect } from "next/navigation";
import { CreateAccountForm } from "@/components/account/CreateAccountForm";
import { getOptionalAccountUser } from "@/lib/account-session";
import { isSafeNextPath } from "@/lib/account-validate";
import { routes } from "@/lib/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterPage({ searchParams }: PageProps) {
  const user = await getOptionalAccountUser();
  if (user) {
    redirect(routes.account);
  }
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  return <CreateAccountForm next={isSafeNextPath(next) ? next : undefined} />;
}
