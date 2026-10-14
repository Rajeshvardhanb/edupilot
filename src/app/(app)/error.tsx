"use client";

import { EmptyState, Button } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState title="Something went wrong">
      <p className="mb-4">{error.message || "An unexpected error occurred."}</p>
      <Button onClick={reset}>Try again</Button>
    </EmptyState>
  );
}
