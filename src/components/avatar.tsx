import { cn } from "@/lib/utils";

// Initials sit on a soft tint of one of a few calm colours, picked from the name so a person keeps theirs.
const TINTS = [
  "bg-[#eef0ff] text-[#4f46e5]", "bg-[#fce7f3] text-[#be185d]", "bg-[#e0f2fe] text-[#0369a1]",
  "bg-[#dcf7ea] text-[#0e7a4f]", "bg-[#fef3c7] text-[#b45309]", "bg-[#f1ebff] text-[#7c3aed]",
  "bg-[#cffafe] text-[#0e7490]", "bg-[#ffe4e8] text-[#be123c]",
];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  return name.replace(/^(Dr|Mr|Mrs|Ms|Prof)\.?\s+/i, "").split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

/** Initials-only avatar; profile photo upload and serving are removed. */
export function Avatar({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38) };
  return <span style={style} aria-hidden className={cn("grid shrink-0 place-items-center rounded-[28%] font-bold", TINTS[hash(name) % TINTS.length], className)}>{initials(name)}</span>;
}
