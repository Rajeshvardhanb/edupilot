import "server-only";
import { cache } from "react";
import type { Institution } from "@prisma/client";
import { db } from "./db";

// The college's settings change a few times a year but are read on every request, so they are kept
// in memory for a short while. Saving settings clears the copy straight away (forgetInstitution).
const KEEP_MS = 15_000;
let memo: { at: number; value: Omit<Institution, "logo"> } | null = null;

/** The college's own identity (name, logo, colours, fee rules). One row, created on first read. */
export const getInstitution = cache(async () => {
  if (memo && Date.now() - memo.at < KEEP_MS) return memo.value;
  const value = (await db.institution.findUnique({ where: { id: 1 } })) ?? (await db.institution.create({ data: { id: 1 } }));
  memo = { at: Date.now(), value };
  return value;
});

/** Call after changing the institution row so the next read sees it. */
export function forgetInstitution() { memo = null; }
