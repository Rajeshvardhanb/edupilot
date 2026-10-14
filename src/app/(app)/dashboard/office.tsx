import { Suspense } from "react";
import { banner } from "@/lib/images";
import Link from "next/link";
import { ClipboardList, GraduationCap, LifeBuoy, PhoneCall, ScrollText, UserPlus } from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { greeting } from "@/lib/insights";
import { fmtDate, isoDate, pct, titleCase } from "@/lib/format";
import { Badge, TasksSkeleton } from "@/components/ui";
import { Card, EmptyState, StatCard } from "@/components/ui-server";
import { Funnel } from "@/components/infographics";
import { CampusIllustration } from "@/components/illustrations";
import { MyTasks } from "@/components/my-tasks";
import { Hero, HeroAction } from "@/components/hero";
import { RecentNotices } from "./widgets";

const STAGES = [["ENQUIRY", "Enquiry", "var(--series-1)"], ["APPLIED", "Applied", "var(--series-2)"], ["DOCUMENTS", "Documents verified", "var(--series-4)"], ["ADMITTED", "Admitted", "var(--series-3)"]] as const;

/** Front office: enquiries, admissions, certificates and helpdesk. No marks, money or settings. */
export async function OfficeDashboard({ user }: { user: CurrentUser }) {
  const today = new Date(isoDate(new Date()));
  const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const [byStage, followUps, pendingCerts, openTickets, admitted, students, recentCerts] = await Promise.all([
    db.enquiry.groupBy({ by: ["stage"], _count: true }),
    db.enquiry.findMany({ where: { followUpDate: { lte: today }, stage: { notIn: ["ADMITTED", "LOST"] } }, include: { program: { select: { code: true } } }, orderBy: { followUpDate: "asc" }, take: 6 }),
    db.certificateRequest.count({ where: { status: "PENDING" } }),
    db.ticket.count({ where: { status: { not: "RESOLVED" } } }),
    db.student.count({ where: { admissionDate: { gte: yearStart } } }),
    db.student.count({ where: { status: "ACTIVE" } }),
    db.certificateRequest.findMany({ where: { status: "PENDING" }, include: { student: { select: { rollNo: true, user: { select: { name: true } } } } }, orderBy: { createdAt: "asc" }, take: 5 }),
  ]);
  const count = (s: string) => byStage.find((x) => x.stage === s)?._count ?? 0;
  const active = count("ENQUIRY") + count("APPLIED") + count("DOCUMENTS");
  const decided = count("ADMITTED") + count("LOST");

  return (
    <>
      <Hero
        eyebrow="Front office"
        title={greeting(user.name)}
        subtitle={<><b>{active}</b> enquiries in progress · <b>{followUps.length}</b> follow-up{followUps.length === 1 ? "" : "s"} due · <b>{pendingCerts}</b> certificate{pendingCerts === 1 ? "" : "s"} to issue</>}
        {...banner("admissions")}
        art={<CampusIllustration className="w-full drop-shadow-xl" />}
      >
        <div className="flex flex-wrap gap-2">
          <HeroAction href="/admissions"><PhoneCall className="size-4" /> Enquiries</HeroAction>
          <HeroAction href="/students/new"><UserPlus className="size-4" /> Admit student</HeroAction>
          <HeroAction href="/certificates"><ScrollText className="size-4" /> Certificates</HeroAction>
          <HeroAction href="/helpdesk"><LifeBuoy className="size-4" /> Helpdesk</HeroAction>
        </div>
      </Hero>
      <Suspense fallback={<TasksSkeleton />}><MyTasks user={user} /></Suspense>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard href="/admissions" label="Active enquiries" value={active} icon={<ClipboardList className="size-5" />} hint={`${count("ENQUIRY")} new · ${count("APPLIED")} applied`} />
        <StatCard href="/admissions" label="Admitted this year" value={admitted} tone="success" icon={<GraduationCap className="size-5" />} hint={decided ? `${pct(count("ADMITTED"), decided)}% of decided enquiries` : `${students} active students`} />
        <StatCard href="/certificates" label="Certificates to issue" value={pendingCerts} tone="warning" icon={<ScrollText className="size-5" />} hint="bonafide, study, conduct, transfer" />
        <StatCard href="/helpdesk" label="Open helpdesk tickets" value={openTickets} tone="info" icon={<LifeBuoy className="size-5" />} hint="from students, parents and staff" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Follow-ups due" className="lg:col-span-2" actions={<Link href="/admissions" className="text-xs text-brand">Pipeline →</Link>}>
          {followUps.length === 0 ? <EmptyState title="No follow-ups are due">New enquiries appear here on their follow-up date.</EmptyState> : (
            <ul className="divide-y divide-line/70">
              {followUps.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="chip size-10 text-xs font-bold">{e.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.name}</p>
                    <p className="truncate text-xs text-muted">{e.phone}{e.program && ` · ${e.program.code}`}{e.source && ` · ${e.source}`}</p>
                  </div>
                  <Badge tone="neutral">{titleCase(e.stage)}</Badge>
                  <Badge tone={e.followUpDate! < today ? "danger" : "warning"}>{e.followUpDate! < today ? `Due ${fmtDate(e.followUpDate!)}` : "Today"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Admission funnel">
          <Funnel stages={STAGES.map(([, label, color], i) => ({ label, color, value: STAGES.slice(i).reduce((s, [x]) => s + count(x), 0) }))} />
          <p className="mt-4 text-xs text-muted">Each bar counts everyone who reached that stage or went further.</p>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Certificate requests waiting" className="lg:col-span-2" actions={<Link href="/certificates" className="text-xs text-brand">All requests →</Link>}>
          {recentCerts.length === 0 ? <p className="text-sm text-muted">Nothing is waiting.</p> : (
            <ul className="divide-y divide-line/70">
              {recentCerts.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{c.student.user.name} <span className="font-mono text-xs font-normal text-muted">{c.student.rollNo}</span></p><p className="truncate text-xs text-muted">{titleCase(c.type)} certificate · {c.purpose}</p></div>
                  <span className="text-xs text-muted">{fmtDate(c.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <RecentNotices audiences={["ALL", "FACULTY"]} />
      </div>
    </>
  );
}
