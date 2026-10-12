import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

interface QueryStateProps {
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  children: ReactNode;
}

export function QueryState({
  loading,
  error,
  onRetry,
  children,
}: QueryStateProps) {
  if (loading) {
    return (
      <p className="p-6 text-sm text-muted-foreground" role="status">
        Loading laboratory data…
      </p>
    );
  }

  if (error) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 p-6">
        <p className="text-sm text-destructive" role="alert">
          {error.message}
        </p>
        <Button onClick={onRetry} size="sm" variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return children;
}
