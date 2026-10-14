import { Suspense } from "react";
import { banner } from "@/lib/images";
import Link from "next/link";
import { Wallet, AlertTriangle, Receipt, TrendingUp, IndianRupee, Layers, BookOpen } from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { feeByProgram, feeTotals, topOverdue } from "@/lib/fee-ledger";
import { greeting, weeklyCollections } from "@/lib/insights";
import { fmtDate, inr, pct, titleCase } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { Badge, Td, DashboardBodySkeleton, TasksSkeleton } from "@/components/ui";
import { Card, StatCard, Th, Table } from "@/components/ui-server";
import { BarsChart, DonutChart, Sparkline } from "@/components/charts";
import { StackedBar } from "@/components/infographics";
import { StudyIllustration } from "@/components/illustrations";
import { MyTasks } from "@/components/my-tasks";
import { Hero, HeroAction } from "@/components/hero";
import { RecentNotices } from "./widgets";

const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];

async function AccountsHero({ user }: { user: CurrentUser }) {
  const t = await feeTotals();
  return (
    <Hero
      eyebrow="Accounts · Academic year 2026-27"
      title={greeting(user.name)}
      subtitle={<>Collection realisation is at <b>{pct(t.paid, t.payable)}%</b> with <b>{inr(t.payable - t.paid)}</b> outstanding.</>}
      {...banner("hero-accounts")}
      art={<StudyIllustration className="w-full [--surface:rgba(255,255,255,.95)] [--brand-soft:#e0e7ff] [--line:rgba(255,255,255,.35)]" />}
    >
      <div className="flex flex-wrap gap-2">
        <HeroAction href="/fees?status=OVERDUE"><AlertTriangle className="size-4" /> Overdue invoices</HeroAction>
        <HeroAction href="/fees/payments"><BookOpen className="size-4" /> Day book</HeroAction>
        <HeroAction href="/fees/structures"><Layers className="size-4" /> Fee structures</HeroAction>
      </div>
    </Hero>
  );
}

export function AccountsDashboard({ user }: { user: CurrentUser }) {
  return (
    <>
      <AccountsHero user={user} />
      <Suspense fallback={<TasksSkeleton />}><MyTasks user={user} /></Suspense>
      <Suspense fallback={<DashboardBodySkeleton />}><AccountsBody /></Suspense>
    </>
  );
}

async function AccountsBody() {
  const [totals, programRows, defaulters, byMode, recent, weekly] = await Promise.all([
    feeTotals(), feeByProgram(), topOverdue(7),
    db.payment.groupBy({ by: ["mode"], _sum: { amount: true } }),
    db.payment.findMany({ orderBy: { paidAt: "desc" }, take: 7, include: { invoice: { include: { student: { include: { user: { select: { id: true, name: true, photoType: true } } } } } } } }),
    weeklyCollections(12),
  ]);
  const t = { payable: totals.payable, paid: totals.paid, overdue: totals.overdue, overdueAmt: totals.overdueBalance, split: totals.split };
  const byProgram = new Map(programRows.map((p) => [p.code, p]));
  const invoices = { length: totals.invoices };
  const wow = weekly.at(-2) ? Math.round(((weekly.at(-1)! - weekly.at(-2)!) / Math.max(1, weekly.at(-2)!)) * 100) : 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard href="/fees" label="Total demand" value={inr(t.payable)} icon={<Receipt className="size-5" />} hint={`${invoices.length} invoices`} />
        <StatCard href="/fees/payments" label="Collected" value={inr(t.paid)} tone="success" icon={<TrendingUp className="size-5" />} trend={{ value: `${Math.abs(wow)}%`, up: wow >= 0 }} hint="this week vs last" chart={<Sparkline data={weekly} color="var(--success)" />} />
        <StatCard href="/fees" label="Outstanding" value={inr(t.payable - t.paid)} tone="warning" icon={<Wallet className="size-5" />} hint={`${Math.round((100 - pct(t.paid, t.payable)) * 10) / 10}% of demand`} />
        <StatCard href="/fees?status=OVERDUE" label="Overdue" value={t.overdue} tone="danger" icon={<AlertTriangle className="size-5" />} hint={inr(t.overdueAmt)} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Weekly collections (₹ lakh) — last 12 weeks" className="lg:col-span-2">
          <BarsChart data={weekly.map((v, i) => ({ label: i === weekly.length - 1 ? "This wk" : `W-${weekly.length - 1 - i}`, value: Math.round(v / 1000) / 100 }))} />
        </Card>
        <Card title="Payment modes">
          <DonutChart centerLabel="collected" valueFormat="lakh"
            data={byMode.sort((a, b) => (b._sum.amount ?? 0) - (a._sum.amount ?? 0)).slice(0, 5).map((m, i) => ({ label: titleCase(m.mode), value: m._sum.amount ?? 0, color: SERIES[i] }))} />
        </Card>
        <Card title="Invoice status">
          <StackedBar data={[
            { label: "Paid", value: t.split.PAID, color: "var(--success)" },
            { label: "Partial", value: t.split.PARTIAL, color: "var(--info)" },
            { label: "Due", value: t.split.DUE, color: "var(--warning)" },
            { label: "Overdue", value: t.split.OVERDUE, color: "var(--danger)" },
          ]} />
          <h3 className="mt-6 mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Collection % by programme</h3>
          <BarsChart unit="%" horizontal height={Math.max(180, byProgram.size * 28)} data={[...byProgram].filter(([, v]) => v.payable).map(([label, v]) => ({ label, value: pct(v.paid, v.payable) }))} />
        </Card>
        <Card title="Recent payments" actions={<Link href="/fees/payments" className="text-xs text-brand">Day book →</Link>}>
          <ul className="space-y-3">
            {recent.map((p) => (
              <li key={p.id}>
                <Link href={`/fees/receipt/${p.id}`} className="flex items-center gap-3 rounded-lg hover:bg-surface-2">
                  <Avatar name={p.invoice.student.user.name} userId={p.invoice.student.user.id} hasPhoto={!!p.invoice.student.user.photoType} size={34} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm">{p.invoice.student.user.name}</span><span className="text-xs text-muted">{titleCase(p.mode)} · {fmtDate(p.paidAt)}</span></span>
                  <span className="text-sm font-medium text-success tabular-nums">+{inr(p.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Top overdue balances" actions={<Badge tone="danger">{t.overdue}</Badge>}>
          <Table>
            <thead><tr><Th>Student</Th><Th className="text-right">Balance</Th></tr></thead>
            <tbody>
              {defaulters.map((d) => (
                <tr key={d.id}>
                  <Td><Link href={`/fees/${d.id}`} className="flex items-center gap-2 hover:text-brand"><Avatar name={d.name} userId={d.userId} hasPhoto={d.hasPhoto} size={28} /><span className="min-w-0"><span className="block truncate">{d.name}</span><span className="font-mono text-[11px] text-muted">{d.roll}</span></span></Link></Td>
                  <Td className="text-right font-medium text-danger tabular-nums">{inr(d.balance)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-3 text-xs text-muted"><IndianRupee className="mr-1 inline size-3" />Send reminders from the Notices module.</p>
        </Card>
      </div>
      <div className="mt-6"><RecentNotices audiences={["ALL", "FACULTY"]} /></div>
    </>
  );
}
