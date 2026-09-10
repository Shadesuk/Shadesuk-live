import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { routes } from "@/lib/navigation";

type SearchEmptyStateProps = {
  query: string;
};

export function SearchEmptyState({ query }: SearchEmptyStateProps) {
  return (
    <EmptyState
      title="No shades found."
      description={
        query
          ? `Nothing in the catalogue matched “${query}”. Try a different search, or browse the catalogue.`
          : "Try a different search, or browse the catalogue."
      }
      actions={
        <>
          <ButtonLink href={routes.search} variant="primary">
            Clear search
          </ButtonLink>
          <ButtonLink href={routes.shop} variant="secondary">
            View all shades
          </ButtonLink>
          <Link href={routes.bestSellers} className="text-small">
            Best sellers
          </Link>
          <Link href={routes.newArrivals} className="text-small">
            New arrivals
          </Link>
        </>
      }
    />
  );
}
