"use client";
import { useState } from "react";
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

/** Private profile photo with a versioned URL; initials are the fallback. */
export function Avatar({ name, userId, hasPhoto, photoVersion, size = 36, className }: { name: string; userId?: string; hasPhoto?: boolean; photoVersion?: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = `/photo/${userId}?v=${encodeURIComponent(photoVersion ?? "")}`;
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38) };
  if (hasPhoto && userId && failed !== src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} style={style} onError={() => setFailed(src)} className={cn("shrink-0 rounded-[28%] object-cover", className)} />;
  return <span style={style} aria-hidden className={cn("grid shrink-0 place-items-center rounded-[28%] font-bold", TINTS[hash(name) % TINTS.length], className)}>{initials(name)}</span>;
}
