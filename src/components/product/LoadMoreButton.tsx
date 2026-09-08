"use client";

import { Button } from "@/components/ui/Button";

type LoadMoreButtonProps = {
  onClick: () => void;
  loading?: boolean;
};

export function LoadMoreButton({ onClick, loading = false }: LoadMoreButtonProps) {
  return (
    <Button variant="secondary" onClick={onClick} loading={loading}>
      Load more shades
    </Button>
  );
}
