import type { CurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { offeringScope,studentScope } from "@/lib/scope";
import Link from "next/link";
import { Card } from "./ui-server";

/** Pending academic work for the current role. */
export async function MyTasks({ user }: { user: CurrentUser }) {
  const tasks: { label: string; count: number; href: string }[] = [];
  if (["ADMIN", "HOD", "FACULTY"].includes(user.role)) {
    tasks.push({ label: "Student leave requests", count: await db.leaveRequest.count({ where: { status: "PENDING", student: studentScope(user) } }), href: "/leave" });
    tasks.push({ label: "Submissions to grade", count: await db.submission.count({ where: { marks: null, material: { offering: offeringScope(user) } } }), href: "/materials" });
  }
  if (["ADMIN", "HOD"].includes(user.role)) tasks.push({ label: "Revaluation requests", count: await db.revaluationRequest.count({ where: { status: "PENDING", offering: offeringScope(user) } }), href: "/exams/revaluation" });
  if (user.facultyId) tasks.push({ label: "Class swap requests", count: await db.swapRequest.count({ where: { toId: user.facultyId, status: "PENDING" } }), href: "/staff/swaps" });
  const pending = tasks.filter((t) => t.count);
  if (!pending.length) return null;
  return <Card title="My tasks"><ul className="flex flex-wrap gap-4">{pending.map((t) => <li key={t.href}><Link href={t.href} className="text-sm text-brand">{t.label} <b>{t.count}</b></Link></li>)}</ul></Card>;
}
