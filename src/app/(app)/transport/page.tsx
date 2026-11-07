import { banner } from "@/lib/images";
import { Bus, MapPin } from "lucide-react";
import { isOffice, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { inr } from "@/lib/format";
import { assignPass, cancelPass, saveRoute } from "@/actions/campus";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field } from "@/components/ui";
import { Card, EmptyState, StatCard, PageBanner } from "@/components/ui-server";

export const metadata = { title: "Transport" };

export default async function TransportPage() {
  const user = await requireUser(["ADMIN", "OFFICE", "STUDENT"]);
  const admin = isOffice(user);
  const routes = await db.transportRoute.findMany({
    include: { stops: { orderBy: { position: "asc" } }, passes: admin ? { include: { stop: true, student: { include: { user: { select: { name: true } } } } } } : { where: { studentId: user.studentId ?? "-" }, include: { stop: true, student: { include: { user: { select: { name: true } } } } } } },
    orderBy: { name: "asc" },
  });
  const mine = !admin ? routes.flatMap((r) => r.passes.map((p) => ({ p, r })))[0] : null;
  const riders = routes.reduce((s, r) => s + r.passes.length, 0);
  return (
    <>
      <PageBanner {...banner("transport")} eyebrow="Bus routes, stops and passes" tint="#7a3410" title="Transport" subtitle={admin ? "Bus routes, stops and passes" : "College bus routes and your pass"} />
      {admin ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
          <StatCard label="Routes" value={routes.length} icon={<Bus className="size-5" />} /><StatCard label="Stops" value={routes.reduce((s, r) => s + r.stops.length, 0)} tone="info" /><StatCard label="Pass holders" value={riders} tone="success" />
        </div>
      ) : (
        <Card className="mb-6 max-w-xl" title="My bus pass">
          {mine ? <p className="text-sm"><b>{mine.r.name}</b> · board at <b>{mine.p.stop?.name}</b> at <b>{mine.p.stop?.pickup}</b><br /><span className="text-muted">Bus {mine.r.vehicleNo} · driver {mine.r.driver} ({mine.r.phone})</span></p> : <p className="text-sm text-muted">You don&apos;t have a bus pass. Ask the transport office to issue one.</p>}
        </Card>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {routes.length === 0 && <EmptyState title="No routes yet" />}
          {routes.map((r) => (
            <Card key={r.id} title={<span className="flex items-center gap-2"><Bus className="size-4 text-brand" />{r.name}</span>} actions={<span className="text-xs text-muted">{r.vehicleNo} · {inr(r.fee)}/year{admin && ` · ${r.passes.length} riders`}</span>}>
              <ol className="relative ml-2 space-y-3 border-l-2 border-dashed border-line pl-5">
                {r.stops.map((s) => (
                  <li key={s.id} className="relative flex items-center justify-between text-sm">
                    <span className="absolute -left-[27px] grid size-3 place-items-center rounded-full bg-brand ring-4 ring-surface" />
                    <span className="flex items-center gap-1.5"><MapPin className="size-3.5 text-muted" />{s.name}</span>
                    <span className="flex items-center gap-2"><span className="tabular-nums text-muted">{s.pickup}</span>{admin && <Badge>{r.passes.filter((p) => p.stopId === s.id).length}</Badge>}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-muted">Driver: {r.driver ?? "—"} {r.phone && `· ${r.phone}`}</p>
              {admin && r.passes.length > 0 && (
                <details className="mt-3 text-sm"><summary className="cursor-pointer text-brand">Pass holders ({r.passes.length})</summary>
                  <ul className="mt-2 space-y-1">{r.passes.map((p) => <li key={p.studentId} className="flex items-center justify-between text-xs"><span>{p.student.user.name} <span className="font-mono text-muted">{p.student.rollNo}</span> · {p.stop?.name}</span><ActionButton action={cancelPass} fields={{ studentId: p.studentId }} variant="ghost" confirm="Cancel this bus pass?">×</ActionButton></li>)}</ul>
                </details>
              )}
            </Card>
          ))}
        </div>
        {admin && (
          <div className="space-y-6">
            <Card title="Issue a bus pass">
              <ActionForm action={assignPass} className="space-y-3" resetOnSuccess>
                <Field label="Student roll number" name="rollNo"><input id="rollNo" name="rollNo" data-check="student" className="input font-mono uppercase" required /></Field>
                <Field label="Boarding stop" name="stopId"><select id="stopId" name="stopId" className="input" required>{routes.flatMap((r) => r.stops.map((s) => <option key={s.id} value={s.id}>{r.name} · {s.name} ({s.pickup})</option>))}</select></Field>
                <SubmitButton>Issue pass</SubmitButton>
              </ActionForm>
            </Card>
            <Card title="Add / update a route">
              <ActionForm action={saveRoute} className="space-y-3" resetOnSuccess>
                <Field label="Route name" name="name"><input id="name" name="name" className="input" placeholder="Route 3 — Kukatpally" required /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Bus number" name="vehicleNo"><input id="vehicleNo" name="vehicleNo" className="input" /></Field>
                  <Field label="Fee / year (₹)" name="fee"><input id="fee" name="fee" type="number" className="input" /></Field>
                  <Field label="Driver" name="driver"><input id="driver" name="driver" className="input" /></Field>
                  <Field label="Driver phone" name="phone"><input id="phone" name="phone" className="input" /></Field>
                </div>
                <Field label="Stops — one per line: name, time" name="stops"><textarea id="stops" name="stops" rows={4} className="input font-mono text-xs" placeholder={"Kukatpally, 07:30\nMiyapur, 07:45\nCollege, 08:40"} /></Field>
                <SubmitButton variant="secondary">Save route</SubmitButton>
              </ActionForm>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
