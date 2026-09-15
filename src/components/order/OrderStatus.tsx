import type { CustomerOrderStatusLabel } from "@/contracts/order/status";
import styles from "@/components/tracking/Tracking.module.css";

type OrderStatusProps = {
  label: CustomerOrderStatusLabel | string;
};

export function OrderStatus({ label }: OrderStatusProps) {
  return (
    <p className={`text-micro ${styles.status}`} data-order-status>
      {label}
    </p>
  );
}
