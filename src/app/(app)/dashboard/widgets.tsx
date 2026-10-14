import { getT } from "@/lib/i18n-server";
import Link from "next/link";
import { Pin, Megaphone } from "lucide-react";
import type { NoticeAudience } from "@prisma/client";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui";
import { Card } from "@/components/ui-server";
import { ScheduleIllustration } from "@/components/illustrations";
import { PERIOD_TIMES } from "@/components/timetable-grid";
import { DAYS, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export async function RecentNotices({ audiences }: { audiences: NoticeAudience[] }) {
  const t = await getT();
  const notices = await db.notice.findMany({
    where: { audience: { in: audiences } },
    include: { createdBy: { select: { name: true } } },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 4,
  });
  return (
    <Card title={<span className="flex items-center gap-2"><Megaphone className="size-4 text-brand" /> {t("Notice board")}</span>} actions={<Link href="/notices" className="text-xs text-brand">View all →</Link>}>
      {notices.length === 0 ? <p className="text-sm text-muted">No notices.</p> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {notices.map((n) => (
            <li key={n.id} className={cn("rounded-xl border p-4", n.pinned ? "border-brand/30 bg-brand-soft/40" : "border-line")}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{n.title}</p>
                {n.pinned && <Pin className="size-3.5 shrink-0 text-brand" />}
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted">{n.body}</p>
              <p className="mt-2 text-[11px] text-muted">{fmtDate(n.createdAt)} · {n.createdBy?.name ?? "Office"}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

type SlotWithOffering = {
  period: number;
  room: string | null;
  offering: { subject: { code: string; name: string; type?: string }; batch?: { admissionYear: number; section: string; program: { code: string } } };
};

/** Today's classes as a vertical timeline; marks the current period live. */
export function TodaySchedule({ slots, showBatch }: { slots: SlotWithOffering[]; showBatch?: boolean }) {
  const now = new Date();
  const dow = now.getDay();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  // Merge back-to-back periods of the same course (e.g. a 3-period lab) into one block.
  const blocks: (SlotWithOffering & { last: number; key: string })[] = [];
  for (const s of slots) {
    const prev = blocks.at(-1);
    if (prev && prev.last === s.period - 1 && prev.offering.subject.code === s.offering.subject.code) prev.last = s.period;
    else blocks.push({ ...s, last: s.period, key: `${s.period}` });
  }
  const current = blocks.find((s) => hhmm >= PERIOD_TIMES[s.period] && hhmm < (PERIOD_TIMES[s.last + 1] ?? "17:00"));
  return (
    <Card title={`Today · ${DAYS[dow] || "Sunday"}`} actions={<Link href="/timetable" className="text-xs text-brand">Timetable →</Link>}>
      {slots.length === 0 ? (
        <div className="py-4 text-center"><ScheduleIllustration className="mx-auto h-28" /><p className="mt-2 text-sm text-muted">No classes scheduled today</p></div>
      ) : (
        <ol className="relative space-y-3 border-l-2 border-dashed border-line pl-5">
          {blocks.map((s) => {
            const live = current?.period === s.period;
            return (
              <li key={s.key} className="relative">
                <span className={cn("absolute top-3 -left-[27px] size-3 rounded-full ring-4 ring-surface", live ? "animate-pulse bg-success" : "bg-brand")} />
                <div className={cn("rounded-xl p-3", live ? "bg-success-soft" : "bg-surface-2")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{s.offering.subject.name}</p>
                    {live ? <Badge tone="success">Now</Badge> : <span className="text-xs text-muted tabular-nums">{PERIOD_TIMES[s.period]}</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {s.last > s.period ? `P${s.period}–P${s.last}` : `P${s.period}`} · {s.offering.subject.code}
                    {showBatch && s.offering.batch && ` · ${s.offering.batch.program.code} ${s.offering.batch.admissionYear}-${s.offering.batch.section}`}
                    {s.room && ` · ${s.room}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
