import { ERROR_DESCRIPTION } from "@/lib/ui-state-copy";

export function InlineError({ children = ERROR_DESCRIPTION }: { children?: string }) {
  return (
    <p className="text-small" role="alert">
      {children}
    </p>
  );
}
