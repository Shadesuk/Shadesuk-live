import Link from "next/link";
import { ContentWidth } from "@/components/layout/ContentWidth";
import { PageContainer } from "@/components/layout/PageContainer";
import { routes } from "@/lib/navigation";

export default function NotFound() {
  return (
    <PageContainer>
      <main id="main">
        <ContentWidth>
          <h1 className="text-h2">Page not found.</h1>
          <p className="text-body">
            That page isn’t available. Continue browsing the catalogue.
          </p>
          <p>
            <Link href={routes.shop}>View all shades</Link>
          </p>
        </ContentWidth>
      </main>
    </PageContainer>
  );
}
