import { getT } from "@/lib/i18n-server";
import { db } from "@/lib/db";
import { gpa, standing } from "@/lib/grading";
import { Badge, Td } from "./ui";
import { Card, EmptyState, Th, Table } from "./ui-server";

/** Semester-wise grade sheet with SGPA, plus overall CGPA. Server component. */
export async function AcademicRecord({ studentId }: { studentId: string }) {
  const tr = await getT();
  const results = await db.subjectResult.findMany({
    where: { studentId, offering: { resultsPublished: true } },
    include: { offering: { include: { subject: true, term: true } } },
    orderBy: [{ offering: { term: { startDate: "asc" } } }, { offering: { subject: { code: "asc" } } }],
  });
  if (results.length === 0) return <EmptyState title="No published results yet" />;
  const st = standing(results.map((r) => ({ ...r, subjectId: r.offering.subjectId, termId: r.offering.termId })));
  const terms = [...new Map(results.map((r) => [r.offering.termId, r.offering.term])).values()];
  const sems = terms.map((t) => { const rows = results.filter((r) => r.offering.termId === t.id); return { id: t.id, sem: rows[0].offering.subject.semester, sgpa: gpa(rows) }; });
  const lo = Math.min(...sems.map((x) => x.sgpa)), hi = Math.max(...sems.map((x) => x.sgpa));

  return (
    <div className="space-y-4">
      {/* CGPA with the semester-by-semester trend, then a chip per semester that jumps to its grades. */}
      <section className="relative overflow-hidden rounded-[var(--radius-panel)] bg-gradient-to-br from-[#6366f1] via-[#8b5cf6] to-[#c026d3] p-5 text-white shadow-[var(--shadow-brand)]">
        <span aria-hidden className="absolute -top-10 -right-10 size-36 rounded-full bg-white/10" />
        <div className="relative flex items-end justify-between gap-4">
          <div>
            <p className="text-xs text-white/80">{tr("Cumulative GPA")}</p>
            <p className="text-4xl font-bold tabular-nums">{st.cgpa.toFixed(2)}</p>
            <p className="text-xs text-white/85">{st.creditsEarned} credits · {st.backlogs} backlog{st.backlogs === 1 ? "" : "s"}</p>
          </div>
          {sems.length > 1 && (
            <svg viewBox="0 0 120 44" className="h-12 w-32" aria-hidden>
              <polyline fill="none" stroke="white" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
                points={sems.map((x, i) => `${(i / (sems.length - 1)) * 112 + 4},${40 - ((x.sgpa - lo) / Math.max(0.5, hi - lo)) * 34}`).join(" ")} />
              {sems.map((x, i) => <circle key={i} cx={(i / (sems.length - 1)) * 112 + 4} cy={40 - ((x.sgpa - lo) / Math.max(0.5, hi - lo)) * 34} r="3" fill="white" />)}
            </svg>
          )}
        </div>
      </section>
      <nav aria-label="Semesters" className="no-print flex gap-2 overflow-x-auto pb-1">
        {sems.map((x) => (
          <a key={x.id} href={`#sem-${x.id}`} className="shrink-0 rounded-xl border border-line bg-surface px-4 py-2 text-center shadow-xs hover:border-brand/40">
            <span className="block text-[11px] text-muted">Sem {x.sem}</span><span className="block text-base font-bold tabular-nums">{x.sgpa.toFixed(2)}</span>
          </a>
        ))}
      </nav>
      {terms.map((t) => {
        const rows = results.filter((r) => r.offering.termId === t.id);
        const sem = rows[0].offering.subject.semester;
        return (
          <div key={t.id} id={`sem-${t.id}`} className="scroll-mt-24">
          <Card title={`Semester ${sem} · ${t.name}`} actions={<span className="text-sm font-semibold text-brand">SGPA {gpa(rows).toFixed(2)}</span>}>
            <div className="hidden sm:block"><Table>
              <thead><tr><Th>{tr("Code")}</Th><Th>{tr("Subject")}</Th><Th className="text-right">{tr("Credits")}</Th><Th className="text-right">{tr("Internal")}</Th><Th className="text-right">{tr("External")}</Th><Th className="text-right">{tr("Total")}</Th><Th>{tr("Grade")}</Th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="font-mono text-xs">{r.offering.subject.code}</Td>
                    <Td>{r.offering.subject.name}</Td>
                    <Td className="text-right">{r.credits}</Td>
                    <Td className="text-right tabular-nums">{r.internal}/{r.offering.subject.internalMax}</Td>
                    <Td className="text-right tabular-nums">{r.external}/{r.offering.subject.externalMax}</Td>
                    <Td className="text-right tabular-nums">{r.total}</Td>
                    <Td><Badge tone={r.passed ? (r.gradePoint >= 8 ? "success" : "neutral") : "danger"}>{r.grade}</Badge></Td>
                  </tr>
                ))}
              </tbody>
            </Table></div>
            {/* Phones: one line per subject with its marks and grade. */}
            <ul className="divide-y divide-line sm:hidden">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.offering.subject.name}</span>
                    <span className="block truncate text-[11px] text-muted">{r.offering.subject.code} · {r.credits} cr · {r.internal}/{r.offering.subject.internalMax} + {r.external}/{r.offering.subject.externalMax}</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">{r.total}</span>
                  <span className={`grid h-7 min-w-8 place-items-center rounded-lg px-1.5 text-xs font-bold text-white ${!r.passed ? "bg-[#f43f5e]" : r.gradePoint >= 9 ? "bg-[#10b981]" : "bg-[#6366f1]"}`}>{r.grade}</span>
                </li>
              ))}
            </ul>
          </Card>
          </div>
        );
      })}
    </div>
  );
}
