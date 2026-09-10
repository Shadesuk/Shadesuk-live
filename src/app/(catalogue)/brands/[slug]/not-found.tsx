import Link from "next/link";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { routes } from "@/lib/navigation";

export default function BrandNotFound() {
  return (
    <PageContainer>
      <main id="main" data-brand-not-found>
        <ContentWidth>
          <h1 className="text-h2">This brand isn’t available.</h1>
          <p className="text-body">
            That brand isn’t part of the current SHADESUK catalogue.
          </p>
          <p>
            <Link href={routes.brands}>View all brands</Link>
          </p>
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
