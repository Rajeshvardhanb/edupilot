import { cn } from "@/lib/utils";

const GRADIENTS = [
  "from-indigo-500 to-violet-500", "from-sky-500 to-indigo-500", "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500", "from-rose-500 to-pink-500", "from-fuchsia-500 to-purple-500",
  "from-cyan-500 to-blue-500", "from-lime-500 to-emerald-600",
];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  return name.replace(/^(Dr|Mr|Mrs|Ms|Prof)\.?\s+/i, "").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

/** User photo when uploaded (served from /photo/[userId]), otherwise gradient initials. */
export function Avatar({ name, userId, hasPhoto, size = 36, className }: { name: string; userId?: string; hasPhoto?: boolean; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38) };
  if (hasPhoto && userId)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/photo/${userId}`} alt={name} style={style} className={cn("shrink-0 rounded-full object-cover ring-2 ring-surface", className)} />;
  return (
    <span style={style} aria-hidden className={cn("grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold text-white ring-2 ring-surface", GRADIENTS[hash(name) % GRADIENTS.length], className)}>
      {initials(name)}
    </span>
  );
}
