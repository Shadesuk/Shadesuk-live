import { redirect } from "next/navigation";
import { AccountNavigation } from "@/components/account/AccountNavigation";
import { AccountOverview } from "@/components/account/AccountOverview";
import { SignInForm } from "@/components/account/SignInForm";
import { resolveAuthReturnPath } from "@/lib/auth-return";
import {
  ACCOUNT_UNAVAILABLE,
  GOOGLE_CANCELLED,
  GOOGLE_FAILED,
  PASSWORD_UPDATED,
  SESSION_EXPIRED,
} from "@/lib/account-copy";
import { getOptionalAccountUser } from "@/lib/account-session";
import { isSafeNextPath } from "@/lib/account-validate";
import { routes } from "@/lib/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { loadAccountProfile } from "@/services/account";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const next = first(params.next);
  const user = await getOptionalAccountUser();
  if (user) {
    const destination = next ? resolveAuthReturnPath({ queryNext: next }) : null;
    if (destination && destination !== routes.account) {
      redirect(destination);
    }
    const profile = await loadAccountProfile(user);
    return (
      <>
        <AccountNavigation pathname={routes.account} />
        <AccountOverview profile={profile} />
      </>
    );
  }

  return (
    <SignInForm
      next={isSafeNextPath(next) ? next : undefined}
      notice={noticeFromParams(params, isSupabaseConfigured())}
    />
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function noticeFromParams(
  params: Record<string, string | string[] | undefined>,
  configured: boolean,
): string | undefined {
  if (!configured) {
    return ACCOUNT_UNAVAILABLE;
  }
  const error = first(params.error);
  if (error === "oauth") {
    return GOOGLE_FAILED;
  }
  if (error === "google_cancelled") {
    return GOOGLE_CANCELLED;
  }
  if (error === "session") {
    return SESSION_EXPIRED;
  }
  if (first(params.notice) === "password") {
    return PASSWORD_UPDATED;
  }
  return undefined;
}
