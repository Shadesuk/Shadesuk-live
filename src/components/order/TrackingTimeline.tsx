import type { TrackingTimelineStep } from "@/lib/tracking-timeline";
import { CUSTOMER_ORDER_STATUS_LABELS } from "@/contracts/order/status";
import { CURRENT_LABEL } from "@/lib/tracking-copy";
import { timelineStateLabel } from "@/lib/tracking-timeline";
import styles from "@/components/tracking/Tracking.module.css";

type TrackingTimelineProps = {
  steps: TrackingTimelineStep[];
};

export function TrackingTimeline({ steps }: TrackingTimelineProps) {
  return (
    <ol className={styles.timeline} data-tracking-timeline>
      {steps.map((step) => (
        <li
          key={step.status}
          className={styles.timelineStep}
          data-state={step.state}
          aria-current={step.state === "current" || step.state === "exception" ? "step" : undefined}
        >
          <p className={`text-micro ${styles.timelineLabel}`}>{step.label}</p>
          {step.state === "current" ? (
            <p className={`text-micro ${styles.current}`}>{CURRENT_LABEL}</p>
          ) : null}
          {step.state === "exception" ? (
            <p className={`text-micro ${styles.current}`}>{CUSTOMER_ORDER_STATUS_LABELS.exception}</p>
          ) : null}
          {step.state === "done" || step.state === "upcoming" ? (
            <span className="visually-hidden">{timelineStateLabel(step.state)}</span>
          ) : null}
          {step.dateLabel ? <p className="text-small">{step.dateLabel}</p> : null}
          {step.description ? <p className="text-small">{step.description}</p> : null}
        </li>
      ))}
    </ol>
  );
}
