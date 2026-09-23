import type { Metadata } from "next";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { TrackOrderForm } from "@/components/tracking/TrackOrderForm";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ErrorState } from "@/components/ui/ErrorState";
import { NETWORK_ERROR, ORDERS_UNAVAILABLE_TITLE, TRY_AGAIN } from "@/lib/account-copy";
import { routes } from "@/lib/navigation";
import { privatePathMetadata } from "@/lib/seo";
import { TRACK_ORDER_HEADING } from "@/lib/tracking-copy";
import { lookupGrantedGuestOrder } from "@/services/guest-tracking";
import styles from "@/components/tracking/Tracking.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = privatePathMetadata(
  TRACK_ORDER_HEADING,
  "Track a SHADESUK order with your order reference and email.",
  routes.trackOrder,
);

export default async function TrackOrderPage() {
  const granted = await lookupGrantedGuestOrder();

  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <div className={styles.page}>
            {granted.status === "error" ? (
              <ErrorState
                title={ORDERS_UNAVAILABLE_TITLE}
                description={NETWORK_ERROR}
                titleAs="h1"
                actions={
                  <ButtonLink href={routes.trackOrder} variant="secondary">
                    {TRY_AGAIN}
                  </ButtonLink>
                }
              />
            ) : (
              <TrackOrderForm
                initialOrder={granted.status === "ok" ? granted.order : null}
                verificationExpired={granted.status === "expired" || granted.status === "invalid"}
                orderMissing={granted.status === "not_found"}
              />
            )}
          </div>
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
