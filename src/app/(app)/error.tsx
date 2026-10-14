"use client";

import { EmptyState, Button, LinkButton } from "@/components/ui";

/** Shown when a page fails. Plain words and a way forward; the reference lets support find the entry in System health. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      title="This page couldn't be loaded"
      action={<><Button onClick={reset}>Try again</Button><LinkButton variant="secondary" href="/dashboard">Go to dashboard</LinkButton></>}
    >
      <p>Try again in a moment. If it keeps happening, tell the college office and quote the reference below.</p>
      {error.digest && <p className="mt-2 text-xs">Reference: <span className="font-mono">{error.digest}</span></p>}
    </EmptyState>
  );
}
