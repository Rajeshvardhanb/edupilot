import "server-only";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Photo slots. Drop a file named <slot>.jpg (or .webp / .png) into public/images and the
 * matching screen uses it; until then the screen keeps its illustration. See public/images/README.md.
 */
export type PhotoSlot =
  | "login" | "hero-admin" | "hero-faculty" | "hero-student" | "hero-accounts" | "hero-parent"
  | "placements" | "results" | "library" | "hostel" | "transport" | "alumni" | "admissions" | "calendar" | "campus-life" | "profile-cover"
  | "dept-cse" | "dept-ece" | "dept-eee" | "dept-me" | "dept-ce";

/**
 * Banners are wider and shorter than the photos, so some of each photo's height is cropped away.
 * This says which part to keep in view (CSS object-position), chosen so faces are never cut off.
 */
const FOCUS: Partial<Record<PhotoSlot, string>> = {
  "hero-admin": "right 12%",     // keep the clock tower
  "hero-faculty": "right 12%",   // the teacher's head is near the top edge
  "hero-student": "right 30%",
  "hero-parent": "right 25%",
  "hero-accounts": "right 5%",
  placements: "right 22%",
  results: "right 72%",          // keep the graduates' faces; some of the open sky goes
  library: "center 55%",
  hostel: "center 60%",
  transport: "center 60%",
  alumni: "center 30%",
  calendar: "center 60%",
  "campus-life": "center 55%",
  admissions: "center 30%",
  "profile-cover": "center 45%",
};

/** Used when a slot has no photo of its own. */
const FALLBACK: Partial<Record<PhotoSlot, PhotoSlot>> = { admissions: "login" };

const found = new Map<string, string | null>();

/** The slot's own file, with its modified time in the URL so a replaced photo is never served from cache. */
function own(slot: PhotoSlot): string | null {
  for (const ext of ["jpg", "jpeg", "webp", "png"]) {
    const file = join(process.cwd(), "public/images", `${slot}.${ext}`);
    if (existsSync(file)) return `/images/${slot}.${ext}?v=${Math.floor(statSync(file).mtimeMs / 1000)}`;
  }
  return null;
}

export function photo(slot: PhotoSlot): string | null {
  // In development look every time, so a newly added file appears without a restart.
  if (process.env.NODE_ENV === "production" && found.has(slot)) return found.get(slot)!;
  const url = own(slot) ?? (FALLBACK[slot] ? photo(FALLBACK[slot]!) : null);
  found.set(slot, url);
  return url;
}

/** Props for <Hero> and <PhotoBanner>: the photo and where to keep it focused. */
export function banner(slot: PhotoSlot): { image: string | null; imagePosition?: string } {
  const image = photo(slot);
  const mine = !!image && image.startsWith(`/images/${slot}.`);
  return { image, imagePosition: FOCUS[mine ? slot : FALLBACK[slot] ?? slot] ?? "center" };
}
