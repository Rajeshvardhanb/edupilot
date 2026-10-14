import { cn } from "@/lib/utils";

// Initials sit on a soft tint of one of a few calm colours, picked from the name so a person keeps theirs.
const TINTS = [
  "bg-blue-100 text-blue-800", "bg-indigo-100 text-indigo-800", "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-900", "bg-rose-100 text-rose-800", "bg-sky-100 text-sky-800",
  "bg-teal-100 text-teal-800", "bg-slate-200 text-slate-800",
];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  return name.replace(/^(Dr|Mr|Mrs|Ms|Prof)\.?\s+/i, "").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

/** User photo when uploaded (served from /photo/[userId]), otherwise initials on a soft tint. */
export function Avatar({ name, userId, hasPhoto, size = 36, className }: { name: string; userId?: string; hasPhoto?: boolean; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38) };
  if (hasPhoto && userId)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/photo/${userId}`} alt={name} style={style} className={cn("shrink-0 rounded-full object-cover ring-2 ring-surface", className)} />;
  return (
    <span style={style} aria-hidden className={cn("grid shrink-0 place-items-center rounded-full font-semibold ring-2 ring-surface", TINTS[hash(name) % TINTS.length], className)}>
      {initials(name)}
    </span>
  );
}
