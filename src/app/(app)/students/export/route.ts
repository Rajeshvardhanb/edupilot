import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { studentScope } from "@/lib/scope";
import { batchLabel, isoDate } from "@/lib/format";
import { studentFilter } from "../filter";

const esc = (v: unknown) => {
  let s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection (=, +, -, @ at the start of a cell).
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !["ADMIN", "HOD", "FACULTY", "ACCOUNTANT"].includes(user.role)) return new NextResponse("Forbidden", { status: 403 });
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const students = await db.student.findMany({
    where: { AND: [studentScope(user), studentFilter(sp)] },
    include: { user: true, batch: { include: { program: true } } },
    orderBy: { rollNo: "asc" },
  });
  const header = ["Roll No", "Name", "Email", "Phone", "Programme", "Batch", "Semester", "Admission Type", "Admission Date", "Gender", "Category", "DOB", "Guardian", "Guardian Phone", "Status"];
  const lines = students.map((s) =>
    [s.rollNo, s.user.name, s.user.email, s.user.phone, s.batch.program.name, batchLabel(s.batch), s.batch.currentSemester, s.admissionType, isoDate(s.admissionDate), s.gender, s.category, isoDate(s.dob), s.guardianName, s.guardianPhone, s.status].map(esc).join(","),
  );
  return new NextResponse([header.join(","), ...lines].join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="students-${isoDate(new Date())}.csv"` },
  });
}
