import { banner } from "@/lib/images";
import { PhotoBanner } from "@/components/hero";
import { BedDouble } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, inr, pct } from "@/lib/format";
import { allotRoom, saveHostelRoom, vacateRoom } from "@/actions/campus";
import { ActionButton, ActionForm, SubmitButton } from "@/components/forms";
import { Badge, Field } from "@/components/ui";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui-server";

export const metadata = { title: "Hostel" };

export default async function HostelPage() {
  const user = await requireUser(["ADMIN", "OFFICE", "STUDENT"]);
  if (user.role === "STUDENT") {
    const a = await db.hostelAllocation.findFirst({
      where: { studentId: user.studentId!, vacatedOn: null },
      include: { room: { include: { hostel: true, allocations: { where: { vacatedOn: null }, include: { student: { include: { user: { select: { name: true } } } } } } } } },
    });
    return (
      <>
        <PhotoBanner {...banner("hostel")} />
        <PageHeader title="Hostel" />
        {!a ? <EmptyState title="You are not a hostel resident">Contact the hostel office to apply for accommodation.</EmptyState> : (
          <Card title={`${a.room.hostel.name} · Room ${a.room.number}`} className="max-w-xl">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Since</dt><dd>{fmtDate(a.fromDate)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Warden</dt><dd>{a.room.hostel.warden ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Mess fee (per month)</dt><dd>{inr(a.room.hostel.messFee)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Room-mates</dt><dd>{a.room.allocations.filter((x) => x.studentId !== user.studentId).map((x) => x.student.user.name).join(", ") || "None"}</dd></div>
            </dl>
          </Card>
        )}
      </>
    );
  }
  const hostels = await db.hostel.findMany({
    include: { rooms: { orderBy: { number: "asc" }, include: { allocations: { where: { vacatedOn: null }, include: { student: { include: { user: { select: { name: true } } } } } } } } },
    orderBy: { name: "asc" },
  });
  const rooms = hostels.flatMap((h) => h.rooms.map((r) => ({ ...r, hostel: h })));
  const beds = rooms.reduce((s, r) => s + r.capacity, 0), used = rooms.reduce((s, r) => s + r.allocations.length, 0);
  return (
    <>
      <PhotoBanner {...banner("hostel")} />
      <PageHeader title="Hostel" subtitle="Rooms, occupancy and allotment" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Hostels" value={hostels.length} icon={<BedDouble className="size-5" />} /><StatCard label="Beds" value={beds} tone="info" />
        <StatCard label="Occupied" value={used} tone="warning" hint={`${pct(used, beds)}% occupancy`} /><StatCard label="Vacant beds" value={beds - used} tone="success" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {hostels.length === 0 && <EmptyState title="No hostels yet">Add the first room using the form.</EmptyState>}
          {hostels.map((h) => (
            <Card key={h.id} title={<span>{h.name} <Badge tone={h.kind === "Girls" ? "info" : "brand"}>{h.kind}</Badge></span>} actions={<span className="text-xs text-muted">Mess {inr(h.messFee)}/month</span>}>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {h.rooms.map((r) => (
                  <div key={r.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between"><p className="text-sm font-semibold">Room {r.number}</p><Badge tone={r.allocations.length >= r.capacity ? "danger" : "success"}>{r.allocations.length}/{r.capacity}</Badge></div>
                    <ul className="mt-2 space-y-1 text-xs">
                      {r.allocations.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-1"><span className="truncate">{a.student.user.name} <span className="font-mono text-muted">{a.student.rollNo}</span></span><ActionButton action={vacateRoom} fields={{ id: a.id }} variant="ghost" confirm={`Vacate ${a.student.user.name} from room ${r.number}?`}>×</ActionButton></li>
                      ))}
                      {Array.from({ length: r.capacity - r.allocations.length }, (_, i) => <li key={i} className="text-muted">— vacant bed —</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
        <div className="space-y-6">
          <Card title="Allot a room">
            <ActionForm action={allotRoom} className="space-y-3" resetOnSuccess>
              <Field label="Student roll number" name="rollNo"><input id="rollNo" name="rollNo" data-check="student" className="input font-mono uppercase" required /></Field>
              <Field label="Room" name="roomId"><select id="roomId" name="roomId" className="input" required>{rooms.filter((r) => r.allocations.length < r.capacity).map((r) => <option key={r.id} value={r.id}>{r.hostel.name} · {r.number} ({r.capacity - r.allocations.length} free)</option>)}</select></Field>
              <SubmitButton>Allot</SubmitButton>
            </ActionForm>
          </Card>
          <Card title="Add a room">
            <ActionForm action={saveHostelRoom} className="space-y-3" resetOnSuccess>
              <Field label="Hostel name" name="hostel"><input id="hostel" name="hostel" className="input" list="hostels" required /><datalist id="hostels">{hostels.map((h) => <option key={h.id} value={h.name} />)}</datalist></Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Type" name="kind"><select id="kind" name="kind" className="input"><option>Boys</option><option>Girls</option></select></Field>
                <Field label="Room no." name="number"><input id="number" name="number" className="input" required /></Field>
                <Field label="Beds" name="capacity"><input id="capacity" name="capacity" type="number" min={1} defaultValue={3} className="input" /></Field>
              </div>
              <Field label="Mess fee / month (new hostels)" name="messFee"><input id="messFee" name="messFee" type="number" className="input" /></Field>
              <SubmitButton variant="secondary">Save room</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
