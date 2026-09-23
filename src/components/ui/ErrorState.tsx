import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ERROR_DESCRIPTION,
  ERROR_RETRY,
  ERROR_TITLE,
} from "@/lib/ui-state-copy";
import type { ReactNode } from "react";

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  actions?: ReactNode;
  titleAs?: "h1" | "h2";
  titleId?: string;
};

export function ErrorState({
  title = ERROR_TITLE,
  description = ERROR_DESCRIPTION,
  onRetry,
  actions,
  titleAs = "h1",
  titleId,
}: ErrorStateProps) {
  return (
    <EmptyState
      title={title}
      description={description}
      titleAs={titleAs}
      titleId={titleId}
      actions={
        actions ??
        (onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            {ERROR_RETRY}
          </Button>
        ) : null)
      }
    />
  );
}
