import { CheckCircle2, AlertTriangle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mailConfigured } from "@/lib/mail";
import { fmtDateTime } from "@/lib/format";
import { sendTestEmail } from "@/actions/alerts";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Pagination, Td, type Tone } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard, Tabs, Th, Table } from "@/components/ui-server";
import { ADMIN_TABS } from "../tabs";

export const metadata = { title: "Email outbox" };
const TONE: Record<string, Tone> = { SENT: "success", FAILED: "danger", NOT_CONFIGURED: "warning" };
const LABEL: Record<string, string> = { SENT: "Sent", FAILED: "Failed", NOT_CONFIGURED: "Not delivered" };
const PAGE = 40;

export default async function EmailPage(props: PageProps<"/admin/email">) {
  await requireUser(["ADMIN"]);
  const sp = await props.searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const [rows, total, counts] = await Promise.all([
    db.emailLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    db.emailLog.count(),
    db.emailLog.groupBy({ by: ["status"], _count: true }),
  ]);
  const c = (s: string) => counts.find((x) => x.status === s)?._count ?? 0;
  const ok = mailConfigured();
  return (
    <>
      <PageHeader title="Administration" subtitle="Every email the system sends is recorded here" />
      <Tabs active="/admin/email" items={ADMIN_TABS} />
      <div className={`mb-6 flex items-start gap-3 rounded-[var(--radius-card)] border p-4 text-sm ${ok ? "border-success/30 bg-success-soft text-success" : "border-warning/30 bg-warning-soft text-warning"}`}>
        {ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0" />}
        <div>
          <p className="font-semibold">{ok ? `Mail server connected (${process.env.SMTP_HOST})` : "No mail server configured: emails are saved below but not delivered"}</p>
          {!ok && <p className="mt-1 text-fg/80">Add these lines to <code>.env</code> and restart. A free Gmail account works (create an “App password” in your Google account): <code className="mt-1 block rounded bg-surface px-2 py-1 text-xs text-fg">SMTP_HOST=smtp.gmail.com · SMTP_PORT=587 · SMTP_USER=you@gmail.com · SMTP_PASS=app-password · APP_URL=http://localhost:3001</code></p>}
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
        <StatCard label="Sent" value={c("SENT")} tone="success" /><StatCard label="Not delivered" value={c("NOT_CONFIGURED")} tone="warning" /><StatCard label="Failed" value={c("FAILED")} tone="danger" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="Outbox">
          {rows.length === 0 ? <EmptyState title="No emails yet" /> : (
            <Table>
              <thead><tr><Th>When</Th><Th>To</Th><Th>Message</Th><Th>Status</Th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}>
                  <Td className="text-xs whitespace-nowrap">{fmtDateTime(r.createdAt)}</Td>
                  <Td className="text-xs">{r.to}</Td>
                  <Td><details><summary className="cursor-pointer text-sm font-medium">{r.subject}</summary><p className="mt-2 text-xs whitespace-pre-line text-muted">{r.body}</p>{r.error && <p className="mt-1 text-xs text-danger">{r.error}</p>}</details></Td>
                  <Td><Badge tone={TONE[r.status]}>{LABEL[r.status] ?? r.status}</Badge></Td>
                </tr>
              ))}</tbody>
            </Table>
          )}
          <Pagination page={page} pages={Math.ceil(total / PAGE)} makeHref={(p) => `/admin/email?page=${p}`} />
        </Card>
        <Card title="Send a test email" className="h-fit">
          <ActionForm action={sendTestEmail} className="space-y-3">
            <input name="to" type="email" placeholder="you@example.com" className="input" required />
            <SubmitButton>Send test</SubmitButton>
          </ActionForm>
          <p className="mt-4 text-xs text-muted">Emails go out for: password resets, fee receipts, results, leave decisions, certificates, placement selection, attendance shortage and fee reminders.</p>
        </Card>
      </div>
    </>
  );
}
