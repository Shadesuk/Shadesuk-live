import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { SavedAddressCard } from "@/components/account/SavedAddressCard";
import {
  ADD_ADDRESS,
  ADD_NEW_ADDRESS,
  NO_ADDRESSES_BODY,
  NO_ADDRESSES_TITLE,
  SAVED_ADDRESSES_LABEL,
} from "@/lib/account-copy";
import { routes } from "@/lib/navigation";
import type { AccountAddress } from "@/types/account";
import styles from "./Account.module.css";

export function SavedAddresses({ addresses }: { addresses: AccountAddress[] }) {
  return (
    <div className={styles.form}>
      <h1 className="text-h2">{SAVED_ADDRESSES_LABEL}</h1>
      {addresses.length === 0 ? (
        <EmptyState
          title={NO_ADDRESSES_TITLE}
          description={NO_ADDRESSES_BODY}
          actions={
            <ButtonLink href={`${routes.accountAddresses}/new`}>{ADD_ADDRESS}</ButtonLink>
          }
        />
      ) : (
        <>
          <div className={styles.cardList}>
            {addresses.map((address) => (
              <SavedAddressCard key={address.id} address={address} />
            ))}
          </div>
          <ButtonLink href={`${routes.accountAddresses}/new`} variant="secondary">
            {ADD_NEW_ADDRESS}
          </ButtonLink>
        </>
      )}
    </div>
  );
}
