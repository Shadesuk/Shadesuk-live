import { OrderDetail } from "@/components/order/OrderDetail";
import { CancelOrderForm } from "@/components/order/CancelOrderForm";
import { Button } from "@/components/ui/Button";
import type { GuestOrderTrackingView } from "@/contracts/order/dto";
import { TRACK_ANOTHER_ORDER } from "@/lib/tracking-copy";
import styles from "./Tracking.module.css";

type TrackOrderResultProps = {
  order: GuestOrderTrackingView;
  onTrackAnother: () => void;
  onOrderChange?: (order: GuestOrderTrackingView) => void;
};

export function TrackOrderResult({ order, onTrackAnother, onOrderChange }: TrackOrderResultProps) {
  return (
    <OrderDetail
      variant="guest"
      order={order}
      footer={
        <div className={styles.actions}>
          {order.cancellationEligible && !order.cancelled ? (
            <CancelOrderForm
              orderReference={order.orderReference}
              mode="guest"
              onCancelled={() =>
                onOrderChange?.({
                  ...order,
                  cancelled: true,
                  cancellationEligible: false,
                  refundPending: true,
                })
              }
            />
          ) : null}
          <Button type="button" variant="tertiary" onClick={onTrackAnother}>
            {TRACK_ANOTHER_ORDER}
          </Button>
        </div>
      }
    />
  );
}
