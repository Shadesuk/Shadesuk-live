"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { removeAddressAction } from "@/app/(storefront)/account/actions";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Modal } from "@/components/ui/Modal";
import {
  CANCEL_ACTION,
  EDIT_ADDRESS,
  REMOVE_ADDRESS,
  REMOVE_ADDRESS_BODY,
  REMOVE_ADDRESS_TITLE,
} from "@/lib/account-copy";
import { routes } from "@/lib/navigation";
import type { AccountAddress } from "@/types/account";
import styles from "./Account.module.css";

export function SavedAddressCard({ address }: { address: AccountAddress }) {
  const router = useRouter();
  const titleId = useId();
  const descriptionId = useId();
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
    setConfirmOpen(false);
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
        <Button type="button" variant="tertiary" disabled={pending} onClick={() => setConfirmOpen(true)}>
          {REMOVE_ADDRESS}
        </Button>
      </div>
      <Modal
        open={confirmOpen}
        onClose={() => {
          if (!pending) {
            setConfirmOpen(false);
          }
        }}
        titleId={titleId}
        descriptionId={descriptionId}
      >
        <div className={styles.confirm}>
          <h2 id={titleId} className="text-h3">
            {REMOVE_ADDRESS_TITLE}
          </h2>
          <p id={descriptionId} className="text-body">
            {REMOVE_ADDRESS_BODY}
          </p>
          <div className={styles.cardActions}>
            <Button type="button" loading={pending} onClick={handleRemove}>
              {REMOVE_ADDRESS}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => setConfirmOpen(false)}
            >
              {CANCEL_ACTION}
            </Button>
          </div>
        </div>
      </Modal>
    </article>
  );
}
