"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, Phone, Mail, X, Download } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Avatar } from "@/components/avatar";
import { Badge, type Tone } from "@/components/ui";
import { bulkUpdateStudents } from "@/actions/students";
import { cn } from "@/lib/utils";

export type Row = { id: string; userId: string; hasPhoto: boolean; rollNo: string; name: string; email: string; phone: string | null; batch: string; semester: number; admissionType: string; status: string };
type Summary = Row & { program: string; guardian: string | null; guardianPhone: string | null; attendance: number | null; attendanceRequired: number; cgpa: number; backlogs: number; feeDue: number | null };

const STATUS_TONE: Record<string, Tone> = { ACTIVE: "success", DETAINED: "danger", SUSPENDED: "warning", DROPPED: "neutral", GRADUATED: "info" };
const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

function Th({ href, active, desc, children, className }: { href?: string; active?: boolean; desc?: boolean; children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn("border-b border-line bg-surface-2/60 px-3 py-2.5 text-left text-xs font-medium whitespace-nowrap text-muted", className)} aria-sort={active ? (desc ? "descending" : "ascending") : undefined}>
      {href ? <Link href={href} className="inline-flex items-center gap-1 hover:text-fg">{children}<span className={active ? "text-brand" : "opacity-30"}>{active && desc ? "▼" : "▲"}</span></Link> : children}
    </th>
  );
}

export function StudentTable({ rows, canEdit, batches, sortHref, sort, dir }: {
  rows: Row[]; canEdit: boolean; batches: { id: string; label: string }[]; sortHref: Record<string, string>; sort: string; dir: string;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [op, setOp] = useState("status");
  const [open, setOpen] = useState<string | null>(null);
  const all = rows.length > 0 && rows.every((r) => picked.has(r.id));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function exportSelected() {
    const esc = (v: string | number | null) => { let s = v == null ? "" : String(v); if (/^[=+\-@]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = rows.filter((r) => picked.has(r.id)).map((r) => [r.rollNo, r.name, r.email, r.phone, r.batch, r.semester, r.status].map(esc).join(","));
    const url = URL.createObjectURL(new Blob([["Roll No,Name,Email,Phone,Batch,Semester,Status", ...lines].join("\n")], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: "selected-students.csv" }).click();
    URL.revokeObjectURL(url);
  }
  const sortProps = (k: string) => ({ href: sortHref[k], active: sort === k, desc: dir === "desc" });

  return (
    <>
      {picked.size > 0 && (
        <div className="no-print sticky top-16 z-20 mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-brand/30 bg-brand-soft px-4 py-2.5 text-sm">
          <b>{picked.size} selected</b>
          {canEdit && (
            <ActionForm action={bulkUpdateStudents} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="ids" value={[...picked].join(",")} />
              <select name="op" aria-label="Op" value={op} onChange={(e) => setOp(e.target.value)} className="input w-auto py-1 text-xs"><option value="status">Set status</option><option value="batch">Move to batch</option></select>
              {op === "status"
                ? <select name="value" aria-label="Value" className="input w-auto py-1 text-xs">{Object.keys(STATUS_TONE).map((s) => <option key={s} value={s}>{title(s)}</option>)}</select>
                : <select name="value" aria-label="Value" className="input w-auto py-1 text-xs">{batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select>}
              <SubmitButton size="sm" confirm={`Apply this change to ${picked.size} student(s)?`}>Apply</SubmitButton>
            </ActionForm>
          )}
          <button onClick={exportSelected} className="flex items-center gap-1 text-xs font-medium text-brand"><Download className="size-3.5" /> Export selected</button>
          <button onClick={() => setPicked(new Set())} className="ml-auto text-xs text-muted hover:text-fg">Clear</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table data-stack="" className="w-full text-sm [&_tbody_tr:hover]:bg-surface-2/60">
          <thead>
            <tr>
              <Th className="w-8"><input type="checkbox" aria-label="Select all" checked={all} onChange={() => setPicked(all ? new Set() : new Set(rows.map((r) => r.id)))} /></Th>
              <Th {...sortProps("rollNo")}>Roll no</Th><Th {...sortProps("name")}>Name</Th><Th {...sortProps("batch")}>Batch</Th><Th {...sortProps("semester")}>Sem</Th><Th>Admission</Th><Th>Phone</Th><Th {...sortProps("status")}>Status</Th><Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className={cn("transition-colors", picked.has(s.id) && "bg-brand-soft/50")}>
                <td className="border-b border-line px-3 py-2.5"><input type="checkbox" aria-label={`Select ${s.name}`} checked={picked.has(s.id)} onChange={() => toggle(s.id)} /></td>
                <td data-label="Roll no" className="border-b border-line px-3 py-2.5 font-mono text-xs">{s.rollNo}</td>
                <td data-label="Name" className="border-b border-line px-3 py-2.5"><Link href={`/students/${s.id}`} className="flex items-center gap-3 hover:text-brand"><Avatar name={s.name} userId={s.userId} hasPhoto={s.hasPhoto} size={34} /><span className="min-w-0"><span className="block font-medium">{s.name}</span><span className="block text-xs text-muted">{s.email}</span></span></Link></td>
                <td data-label="Batch" className="border-b border-line px-3 py-2.5">{s.batch}</td>
                <td data-label="Sem" className="border-b border-line px-3 py-2.5">{s.semester}</td>
                <td data-label="Admission" className="border-b border-line px-3 py-2.5">{s.admissionType === "LATERAL" ? <Badge tone="brand">Lateral</Badge> : <span className="text-xs text-muted">{title(s.admissionType)}</span>}</td>
                <td data-label="Phone" className="border-b border-line px-3 py-2.5 text-xs">{s.phone ?? "—"}</td>
                <td data-label="Status" className="border-b border-line px-3 py-2.5"><Badge tone={STATUS_TONE[s.status]}>{title(s.status)}</Badge></td>
                <td className="border-b border-line px-3 py-2.5"><button onClick={() => setOpen(s.id)} aria-label={`Quick view ${s.name}`} title="Quick view" className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-brand"><Eye className="size-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <QuickView id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function QuickView({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`/students/${id}/summary`, { signal: ctl.signal }).then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch((e) => { if (e?.name !== "AbortError") setFailed(true); });
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => { ctl.abort(); window.removeEventListener("keydown", esc); };
  }, [id, onClose]);
  const tile = (label: string, value: React.ReactNode, tone = "") => <div className="rounded-xl bg-surface-2 p-3 text-center"><p className={cn("text-lg font-semibold tabular-nums", tone)}>{value}</p><p className="text-xs text-muted">{label}</p></div>;
  return (
    <div className="fixed inset-0 z-[60]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" />
      <aside role="dialog" aria-label="Student quick view" className="absolute inset-y-0 right-0 w-full max-w-sm animate-fade-up overflow-y-auto border-l border-line bg-surface p-6 shadow-lift" onMouseDown={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 rounded-lg p-1.5 hover:bg-surface-2"><X className="size-4" /></button>
        {failed ? <p className="text-sm text-danger">Could not load this student.</p> : !data ? (
          <div className="animate-pulse space-y-4"><div className="size-20 rounded-full bg-surface-2" /><div className="h-5 w-40 rounded bg-surface-2" /><div className="h-24 rounded-xl bg-surface-2" /></div>
        ) : (
          <>
            <Avatar name={data.name} userId={data.userId} hasPhoto={data.hasPhoto} size={80} />
            <h2 className="mt-3 text-xl font-semibold">{data.name}</h2>
            <p className="font-mono text-xs text-muted">{data.rollNo}</p>
            <p className="mt-1 text-sm">{data.program}</p>
            <p className="text-xs text-muted">{data.batch} · Semester {data.semester}</p>
            <div className="mt-2 flex gap-2"><Badge tone={STATUS_TONE[data.status]}>{title(data.status)}</Badge>{data.admissionType === "LATERAL" && <Badge tone="brand">Lateral entry</Badge>}</div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {tile("Attendance", data.attendance == null ? "—" : `${data.attendance}%`, data.attendance != null && data.attendance < data.attendanceRequired ? "text-danger" : "")}
              {tile("CGPA", data.cgpa.toFixed(2))}
              {tile("Backlogs", data.backlogs, data.backlogs ? "text-danger" : "")}
              {data.feeDue != null && tile("Fee due", `₹${data.feeDue.toLocaleString("en-IN")}`, data.feeDue ? "text-warning" : "")}
            </div>
            <div className="mt-5 space-y-2 text-sm">
              <p className="flex items-center gap-2"><Mail className="size-4 text-muted" />{data.email}</p>
              <p className="flex items-center gap-2"><Phone className="size-4 text-muted" />{data.phone ?? "—"}</p>
              <p className="text-xs text-muted">Guardian: {data.guardian ?? "—"} {data.guardianPhone && `· ${data.guardianPhone}`}</p>
            </div>
            <Link href={`/students/${data.id}`} className="mt-6 block rounded-xl bg-brand py-2.5 text-center text-sm font-medium text-brand-fg">Open full profile</Link>
          </>
        )}
      </aside>
    </div>
  );
}
