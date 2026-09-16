import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/account/ForgotPasswordForm";
import { getOptionalAccountUser } from "@/lib/account-session";
import { routes } from "@/lib/navigation";

export default async function ForgotPasswordPage() {
  const user = await getOptionalAccountUser();
  if (user) {
    redirect(routes.account);
  }
  return <ForgotPasswordForm />;
}
