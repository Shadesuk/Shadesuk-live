"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeAddressAction } from "@/app/account/actions";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EDIT_ADDRESS, REMOVE_ADDRESS } from "@/lib/account-copy";
import { routes } from "@/lib/navigation";
import type { AccountAddress } from "@/types/account";
import styles from "./Account.module.css";

export function SavedAddressCard({ address }: { address: AccountAddress }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleRemove() {
    if (pending) {
      return;
    }
    setPending(true);
    const result = await removeAddressAction({ addressId: address.id });
    if (result.status === "unauthenticated") {
      window.location.assign(routes.account);
      return;
    }
    setPending(false);
    router.refresh();
  }

  return (
    <article className={styles.card}>
      <h2 className="text-micro">{address.label}</h2>
      <p className="text-body">
        {address.line1}
        <br />
        {address.city}
        <br />
        {address.postcode}
      </p>
      <div className={styles.cardActions}>
        <ButtonLink href={`${routes.accountAddresses}/${address.id}`} variant="tertiary">
          {EDIT_ADDRESS}
        </ButtonLink>
        <Button type="button" variant="tertiary" loading={pending} onClick={handleRemove}>
          {REMOVE_ADDRESS}
        </Button>
      </div>
    </article>
  );
}
