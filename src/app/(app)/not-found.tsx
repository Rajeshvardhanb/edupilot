import { EmptyState, LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <EmptyState title="Not found">
      <p className="mb-4">The record doesn&apos;t exist or you don&apos;t have access to it.</p>
      <LinkButton href="/dashboard">Back to dashboard</LinkButton>
    </EmptyState>
  );
}
