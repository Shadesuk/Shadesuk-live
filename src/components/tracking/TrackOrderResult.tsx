import { OrderDetail } from "@/components/order/OrderDetail";
import { Button } from "@/components/ui/Button";
import type { GuestOrderTrackingView } from "@/contracts/order/dto";
import { TRACK_ANOTHER_ORDER } from "@/lib/tracking-copy";
import styles from "./Tracking.module.css";

type TrackOrderResultProps = {
  order: GuestOrderTrackingView;
  onTrackAnother: () => void;
};

export function TrackOrderResult({ order, onTrackAnother }: TrackOrderResultProps) {
  return (
    <OrderDetail
      variant="guest"
      order={order}
      footer={
        <div className={styles.actions}>
          <Button type="button" variant="tertiary" onClick={onTrackAnother}>
            {TRACK_ANOTHER_ORDER}
          </Button>
        </div>
      }
    />
  );
}
