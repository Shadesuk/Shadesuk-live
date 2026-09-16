import type { Metadata } from "next";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { TrackOrderForm } from "@/components/tracking/TrackOrderForm";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";
import { TRACK_ORDER_HEADING } from "@/lib/tracking-copy";
import styles from "@/components/tracking/Tracking.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = privatePathMetadata(
  TRACK_ORDER_HEADING,
  "Track a SHADESUK order with your order reference and email.",
  routes.trackOrder,
);

export default function TrackOrderPage() {
  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <div className={styles.page}>
            <TrackOrderForm />
          </div>
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
