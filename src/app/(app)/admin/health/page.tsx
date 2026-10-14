import { Activity, Archive, DatabaseBackup, HardDrive, Mail, ShieldAlert, Wallet } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { daysAgo, fmtDateTime } from "@/lib/format";
import { mailConfigured } from "@/lib/mail";
import { databaseSize, recentBackups } from "@/lib/monitor";
import { resolveError, resolveAllErrors } from "@/actions/admin";
import { ActionButton } from "@/components/forms";
import { Badge, Td } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard, Tabs, Th, Table } from "@/components/ui-server";
import { ADMIN_TABS } from "../tabs";

export const metadata = { title: "System health" };

/** Is the system looked after? Backups, errors, email and the size of the database, in one place. */
export default async function HealthPage() {
  await requireUser(["ADMIN"]);
  const [errors, open, last24, size, jobs, failedMail] = await Promise.all([
    db.errorLog.findMany({ orderBy: [{ resolvedAt: "asc" }, { lastAt: "desc" }], take: 30 }),
    db.errorLog.count({ where: { resolvedAt: null } }),
    db.errorLog.count({ where: { lastAt: { gte: daysAgo(1) } } }),
    databaseSize(),
    db.auditLog.findFirst({ where: { action: "DAILY_JOBS", details: { not: "started" } }, orderBy: { createdAt: "desc" } }),
    db.emailLog.count({ where: { status: "FAILED", createdAt: { gte: daysAgo(7) } } }),
  ]);
  const backups = recentBackups();
  const newest = backups[0];
  const stale = !newest || newest.at < daysAgo(2);
  const mb = (n: number) => `${(n / 1e6).toFixed(1)} MB`;

  return (
    <>
      <PageHeader title="Administration" subtitle="Backups, errors, email and storage" />
      <Tabs active="/admin/health" items={ADMIN_TABS} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Last backup" value={newest ? fmtDateTime(newest.at).split(",")[0] : "None yet"} tone={stale ? "danger" : "success"} icon={<DatabaseBackup className="size-5" />} hint={newest ? `${mb(newest.size)} · ${backups.length} recent file${backups.length === 1 ? "" : "s"}` : "run npm run db:backup"} />
        <StatCard label="Errors needing a look" value={open} tone={open ? "danger" : "success"} icon={<ShieldAlert className="size-5" />} hint={`${last24} seen in the last 24 hours`} />
        <StatCard label="Database size" value={`${size.mb} MB`} tone="info" icon={<HardDrive className="size-5" />} hint={`${size.tables} tables`} />
        <StatCard label="Email" value={mailConfigured() ? "Connected" : "Not set up"} tone={mailConfigured() ? (failedMail ? "warning" : "success") : "warning"} icon={<Mail className="size-5" />} hint={mailConfigured() ? `${failedMail} failed in 7 days` : "messages stay in the outbox"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Server errors" className="lg:col-span-2" actions={open > 0 && <ActionButton action={resolveAllErrors} fields={{}} variant="ghost" confirm="Mark every error as dealt with?">Mark all resolved</ActionButton>}>
          {errors.length === 0 ? <EmptyState title="No errors recorded">When a page or action fails on the server it is listed here, with how often it has happened.</EmptyState> : (
            <Table>
              <thead><tr><Th>Last seen</Th><Th>Where</Th><Th>What went wrong</Th><Th className="text-right">Times</Th><Th /></tr></thead>
              <tbody>
                {errors.map((e) => (
                  <tr key={e.id} className={e.resolvedAt ? "opacity-60" : ""}>
                    <Td className="text-xs whitespace-nowrap">{fmtDateTime(e.lastAt)}</Td>
                    <Td className="max-w-40 font-mono text-xs break-all">{e.method} {e.path.split("?")[0]}<span className="block font-sans text-muted">{e.routeType}</span></Td>
                    <Td className="max-w-md text-xs"><details><summary className="cursor-pointer list-none"><span className="line-clamp-2">{e.message}</span></summary>{e.stack && <pre tabIndex={0} className="mt-2 max-h-56 overflow-auto rounded-lg bg-surface-2 p-2 text-[11px] whitespace-pre-wrap">{e.stack}</pre>}</details></Td>
                    <Td className="text-right tabular-nums">{e.count}</Td>
                    <Td className="text-right">{e.resolvedAt ? <Badge tone="success">Resolved</Badge> : <ActionButton action={resolveError} fields={{ id: e.id }} variant="ghost">Resolve</ActionButton>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <div className="space-y-6">
          <Card title="Backups">
            {backups.length === 0 ? <p className="text-sm text-muted">No backup files were found in the backups folder.</p> : (
              <ul className="divide-y divide-line/70 text-sm">
                {backups.map((b) => <li key={b.file} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"><span className="min-w-0"><span className="block truncate font-mono text-xs">{b.file}</span><span className="text-xs text-muted">{fmtDateTime(b.at)}</span></span><span className="text-xs text-muted tabular-nums">{mb(b.size)}</span></li>)}
              </ul>
            )}
            <p className={`mt-4 rounded-xl p-3 text-xs ${stale ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted"}`}>
              {stale ? "There is no backup from the last two days. " : ""}In production the backup service writes one every night and keeps the newest 14. Set BACKUP_MIRROR_DIR so a second copy lands on another disk.
            </p>
          </Card>
          <Card title="Housekeeping">
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3"><Activity className="mt-0.5 size-4 shrink-0 text-brand" /><span><b>Daily jobs</b><span className="block text-xs text-muted">{jobs ? `${fmtDateTime(jobs.createdAt)} · ${jobs.details}` : "Not run yet. They run within an hour of the server starting."}</span></span></li>
              <li className="flex items-start gap-3"><Archive className="mt-0.5 size-4 shrink-0 text-brand" /><span><b>Year-end archive</b><span className="block text-xs text-muted"><a href="/admin/export" className="text-brand underline">Download every record</a> as one compressed file (JSON, one list per table). Passwords, photos and uploaded files are left out. To move to another server, use a database backup with <code>npm run db:restore</code>.</span></span></li>
              <li className="flex items-start gap-3"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-brand" /><span><b>Error reporting</b><span className="block text-xs text-muted">Every server error is recorded here. <a href="/admin/health/test-error" className="text-brand underline">Raise a test error</a> to see it work, then come back to this page.</span></span></li>
              <li className="flex items-start gap-3"><Wallet className="mt-0.5 size-4 shrink-0 text-brand" /><span><b>Online payments</b><span className="block text-xs text-muted">{process.env.RAZORPAY_KEY_ID ? "Razorpay keys are set." : "Using the built-in test checkout (no Razorpay keys)."}</span></span></li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
