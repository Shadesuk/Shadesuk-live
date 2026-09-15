import type { Metadata } from "next";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { TrackOrderForm } from "@/components/tracking/TrackOrderForm";
import { TRACK_ORDER_HEADING } from "@/lib/tracking-copy";
import styles from "@/components/tracking/Tracking.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: TRACK_ORDER_HEADING,
  robots: {
    index: false,
    follow: false,
  },
};

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
