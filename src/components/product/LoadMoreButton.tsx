"use client";

import { Button } from "@/components/ui/Button";

type LoadMoreButtonProps = {
  onClick: () => void;
};

export function LoadMoreButton({ onClick }: LoadMoreButtonProps) {
  return (
    <Button variant="secondary" onClick={onClick}>
      Load more
    </Button>
  );
}
