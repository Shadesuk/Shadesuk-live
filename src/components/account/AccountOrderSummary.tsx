import { OrderDetail } from "@/components/order/OrderDetail";
import { CancelOrderForm } from "@/components/order/CancelOrderForm";
import type { CustomerOrderView } from "@/contracts";
import { accountOrderPath } from "@/lib/navigation";

export function AccountOrderSummary({ order }: { order: CustomerOrderView }) {
  return (
    <OrderDetail
      variant="account"
      order={order}
      trackHref={`${accountOrderPath(order.orderReference)}#track-order`}
      footer={
        order.cancellationEligible && !order.cancelled ? (
          <CancelOrderForm orderReference={order.orderReference} mode="account" />
        ) : null
      }
    />
  );
}
