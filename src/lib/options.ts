import "server-only";
import { db } from "./db";
import { batchLabel } from "./format";
import type { CurrentUser } from "./auth";
import { programScope } from "./scope";

export async function batchOptions(user?: CurrentUser) {
  const batches = await db.batch.findMany({
    where: user ? { program: programScope(user) } : {},
    include: { program: true, _count: { select: { students: true } } },
    orderBy: [{ program: { code: "asc" } }, { admissionYear: "desc" }, { section: "asc" }],
  });
  // Open presentation screens on an enrolled class; keep empty batches available for admissions.
  batches.sort((a, b) => Number(b._count.students > 0) - Number(a._count.students > 0));
  return batches.map((b) => ({ id: b.id, label: `${batchLabel(b)} · Sem ${b.currentSemester}`, programId: b.programId }));
}
