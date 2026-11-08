import { AppShell } from "@/components/app-shell";
import { ROLE_LABEL } from "@/components/nav";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { termProgress } from "@/lib/insights";
import { getInstitution } from "@/lib/institution";
import { currentTerm } from "@/lib/scope";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [term, inst] = await Promise.all([currentTerm(), getInstitution()]);
  // The line under the name in the top bar: who this is in the college.
  const [student, dept] = await Promise.all([
    user.role === "STUDENT" && user.studentId ? db.student.findUnique({ where: { id: user.studentId }, select: { rollNo: true } }) : null,
    user.departmentId ? db.department.findUnique({ where: { id: user.departmentId }, select: { code: true } }) : null,
  ]);
  const subtitle = user.role === "STUDENT" ? `Student · ${student?.rollNo ?? ""}`
    : user.role === "PARENT" ? `Parent of ${user.children.find((c) => c.id === user.studentId)?.name ?? user.children[0]?.name ?? "—"}`
    : user.role === "ADMIN" ? `Principal · ${ROLE_LABEL.ADMIN}`
    : dept ? `${ROLE_LABEL[user.role]} · ${dept.code}` : ROLE_LABEL[user.role];
  return (
    <AppShell
      user={{ id: user.id, name: user.name, email: user.email, role: user.role, hasPhoto: user.hasPhoto, children: user.children, studentId: user.studentId, subtitle }}
      term={term ? { name: term.name, ...termProgress(term) } : undefined}
      brand={{ name: inst.name, shortName: inst.shortName, tagline: inst.tagline, hasLogo: !!inst.logoType }}
    >
      {children}
    </AppShell>
  );
}
