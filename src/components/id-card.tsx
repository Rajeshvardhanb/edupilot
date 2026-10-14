import { BrandMark } from "@/components/brand-mark";
import { db } from "@/lib/db";
import { getInstitution } from "@/lib/institution";
import { qrSvg } from "@/lib/qr";
import { fmtDate } from "@/lib/format";
import { Avatar } from "./avatar";

/** Credit-card sized student identity card (front and back) with a QR code of the roll number. */
export async function IdCard({ studentId }: { studentId: string }) {
  const s = await db.student.findUniqueOrThrow({ where: { id: studentId }, include: { user: { select: { id: true, name: true, photoType: true, phone: true } }, batch: { include: { program: { include: { department: true } } } } } });
  const inst = await getInstitution();
  const qr = await qrSvg(`ID|${s.rollNo}|${s.user.name}`);
  const validTill = s.batch.admissionYear + s.batch.program.durationYears;
  return (
    <div className="flex flex-wrap justify-center gap-6">
      <div className="w-[21rem] overflow-hidden rounded-2xl border border-line bg-surface shadow-card print:shadow-none">
        <div className="brand-gradient flex items-center gap-2 px-4 py-3 text-white">
          {inst.logoType
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src="/brand/logo" alt="" className="size-9 rounded-lg bg-white object-contain p-0.5" />
            : <BrandMark size={36} tile className="!rounded-lg" />}
          <div className="min-w-0"><p className="truncate text-sm leading-tight font-bold">{inst.name}</p><p className="truncate text-[10px] opacity-80">{inst.affiliation}</p></div>
        </div>
        <div className="flex gap-4 p-4">
          <Avatar name={s.user.name} userId={s.user.id} hasPhoto={!!s.user.photoType} size={84} className="!rounded-xl" />
          <div className="min-w-0 text-sm">
            <p className="truncate text-base font-bold">{s.user.name}</p>
            <p className="font-mono text-xs font-semibold text-brand">{s.rollNo}</p>
            <p className="mt-1 text-xs">{s.batch.program.code} · {s.batch.program.department.code}</p>
            <p className="text-xs text-muted">Batch {s.batch.admissionYear}–{validTill}</p>
            <p className="text-xs text-muted">Blood group: <b className="text-fg">{s.bloodGroup ?? "—"}</b></p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-line bg-surface-2 px-4 py-2 text-[10px] text-muted"><span>STUDENT IDENTITY CARD</span><span>Valid till Jun {validTill}</span></div>
      </div>
      <div className="w-[21rem] rounded-2xl border border-line bg-surface p-4 shadow-card print:shadow-none">
        <div className="flex gap-4">
          <div className="size-24 shrink-0 rounded-lg bg-white p-1" dangerouslySetInnerHTML={{ __html: qr }} />
          <dl className="min-w-0 space-y-1 text-xs">
            <div><dt className="text-muted">Date of birth</dt><dd>{fmtDate(s.dob)}</dd></div>
            <div><dt className="text-muted">Guardian</dt><dd className="truncate">{s.guardianName ?? "—"} · {s.guardianPhone ?? ""}</dd></div>
            <div><dt className="text-muted">Address</dt><dd className="line-clamp-2">{s.address ?? "—"}</dd></div>
          </dl>
        </div>
        <p className="mt-3 border-t border-line pt-2 text-[10px] text-muted">If found, please return to: {inst.name}{inst.address ? `, ${inst.address}` : ""}{inst.phone ? ` · ${inst.phone}` : ""}. This card is not transferable.</p>
      </div>
    </div>
  );
}
