import { redirect } from "next/navigation";
import { AccountNavigation } from "@/components/account/AccountNavigation";
import { AccountOrderSummary } from "@/components/account/AccountOrderSummary";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  ORDER_NOT_FOUND_BODY,
  ORDER_NOT_FOUND_TITLE,
  ORDERS_LABEL,
  ORDERS_UNAVAILABLE_BODY,
  ORDERS_UNAVAILABLE_TITLE,
  TRY_AGAIN,
} from "@/lib/account-copy";
import { requireAccountUser } from "@/lib/account-session";
import { parseOrderReferenceInput } from "@/contracts/order/reference";
import { accountOrderPath, routes } from "@/lib/navigation";
import { getOwnCustomerOrder } from "@/services/customer-orders";

type PageProps = {
  params: Promise<{ reference: string }>;
};

export default async function AccountOrderPage({ params }: PageProps) {
  const { reference } = await params;
  const decoded = safeOrderReferenceParam(reference);
  const parsed = parseOrderReferenceInput(decoded);
  const returnPath = parsed ? accountOrderPath(parsed) : routes.accountOrders;
  await requireAccountUser(returnPath);
  const result = await getOwnCustomerOrder(decoded);
  if (result.status === "unauthenticated") {
    redirect(routes.account);
  }

  return (
    <>
      <AccountNavigation pathname={routes.accountOrders} />
      {result.status === "ok" ? (
        <AccountOrderSummary order={result.data} />
      ) : result.status === "error" ? (
        <ErrorState
          title={ORDERS_UNAVAILABLE_TITLE}
          description={ORDERS_UNAVAILABLE_BODY}
          titleAs="h1"
          actions={
            <ButtonLink href={returnPath} variant="secondary">
              {TRY_AGAIN}
            </ButtonLink>
          }
        />
      ) : (
        <ErrorState
          title={ORDER_NOT_FOUND_TITLE}
          description={ORDER_NOT_FOUND_BODY}
          titleAs="h1"
          actions={
            <ButtonLink href={routes.accountOrders} variant="secondary">
              {ORDERS_LABEL}
            </ButtonLink>
          }
        />
      )}
    </>
  );
}

function safeOrderReferenceParam(reference: string): string {
  if (reference.length > 80) {
    return "";
  }
  try {
    return decodeURIComponent(reference);
  } catch {
    return "";
  }
}
