import Link from "next/link";
import { SignOutButton } from "@/components/account/SignOutButton";
import {
  ACCOUNT_TITLE,
  HELLO_PREFIX,
  ORDERS_HINT,
  ORDERS_LABEL,
  PERSONAL_DETAILS_HINT,
  PERSONAL_DETAILS_LABEL,
  SAVED_ADDRESSES_HINT,
  SAVED_ADDRESSES_LABEL,
} from "@/lib/account-copy";
import { routes } from "@/lib/navigation";
import type { AccountProfile } from "@/types/account";
import styles from "./Account.module.css";

export function AccountOverview({ profile }: { profile: AccountProfile }) {
  const hello = profile.firstName ? `${HELLO_PREFIX}, ${profile.firstName}` : HELLO_PREFIX;

  return (
    <div className={styles.form}>
      <h1 className="text-h2">{ACCOUNT_TITLE}</h1>
      <p className="text-h3">{hello}</p>
      <div className={styles.cardList}>
        <Link className={styles.card} href={routes.accountOrders}>
          <h2 className="text-micro">{ORDERS_LABEL}</h2>
          <p className="text-body">{ORDERS_HINT} →</p>
        </Link>
        <Link className={styles.card} href={routes.accountDetails}>
          <h2 className="text-micro">{PERSONAL_DETAILS_LABEL}</h2>
          <p className="text-body">{PERSONAL_DETAILS_HINT} →</p>
        </Link>
        <Link className={styles.card} href={routes.accountAddresses}>
          <h2 className="text-micro">{SAVED_ADDRESSES_LABEL}</h2>
          <p className="text-body">{SAVED_ADDRESSES_HINT} →</p>
        </Link>
      </div>
      <SignOutButton />
    </div>
  );
}
