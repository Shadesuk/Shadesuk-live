import { ResetPasswordForm } from "@/components/account/ResetPasswordForm";
import { requireAccountUser } from "@/lib/account-session";

export default async function ResetPasswordPage() {
  await requireAccountUser();
  return <ResetPasswordForm />;
}
