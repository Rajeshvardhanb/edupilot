import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

/** Trail shown above detail pages: Home › Section › Current. */
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="no-print mb-3 flex flex-wrap items-center gap-1 text-xs text-muted">
      <Link href="/dashboard" aria-label="Dashboard" className="flex items-center gap-1 hover:text-brand"><Home className="size-3.5" /></Link>
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="size-3" />
          {it.href ? <Link href={it.href} className="hover:text-brand">{it.label}</Link> : <span className="font-medium text-fg">{it.label}</span>}
        </span>
      ))}
    </nav>
  );
}
