import Link from "next/link";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { routes } from "@/lib/navigation";

export default function ProductNotFound() {
  return (
    <PageContainer>
      <main id="main" data-product-not-found>
        <ContentWidth>
          <h1 className="text-h2">This product isn’t available.</h1>
          <p className="text-body">
            That product isn’t part of the current SHADESUK catalogue.
          </p>
          <p>
            <Link href={routes.shop}>View all shades</Link>
          </p>
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
