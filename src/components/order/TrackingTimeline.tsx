import type { TrackingTimelineStep } from "@/lib/tracking-timeline";
import { CURRENT_LABEL } from "@/lib/tracking-copy";
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
        >
          <p className={`text-micro ${styles.timelineLabel}`}>{step.label}</p>
          {step.state === "current" ? (
            <p className={`text-micro ${styles.current}`}>{CURRENT_LABEL}</p>
          ) : null}
          {step.dateLabel ? <p className="text-small">{step.dateLabel}</p> : null}
          {step.description ? <p className="text-small">{step.description}</p> : null}
        </li>
      ))}
    </ol>
  );
}
