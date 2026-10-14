import "server-only";
import { db } from "./db";
import { appUrl, sendMail } from "./mail";

export type Alert = { title: string; body?: string; href?: string; email?: boolean };

/** Kinds of alert a person can switch email off for (My Profile → Notification preferences). In-app alerts always arrive. */
export const ALERT_KINDS = {
  fees: "Fees, receipts and refunds",
  results: "Results and exams",
  attendance: "Attendance and absences",
  leave: "Leave and approvals",
  notices: "Notices and circulars",
  helpdesk: "Helpdesk and certificates",
  placements: "Placements",
  other: "Everything else",
} as const;
export type AlertKind = keyof typeof ALERT_KINDS;

/** Which kind an alert is, worked out from the page it links to. */
export function alertKind(href?: string): AlertKind {
  const h = href ?? "";
  if (/^\/(fees|pay|scholarships)/.test(h)) return "fees";
  if (/^\/(results|exams)/.test(h)) return "results";
  if (/^\/attendance/.test(h)) return "attendance";
  if (/^\/(leave|staff)/.test(h)) return "leave";
  if (/^\/notices/.test(h)) return "notices";
  if (/^\/(helpdesk|certificates)/.test(h)) return "helpdesk";
  if (/^\/placements/.test(h)) return "placements";
  return "other";
}

/** In-app notification for each user, plus an email when `email` is set. Failures never propagate. */
export async function notifyUsers(userIds: string[], alert: Alert) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (!ids.length) return;
  try {
    await db.notification.createMany({ data: ids.map((userId) => ({ userId, title: alert.title.slice(0, 190), body: alert.body ?? null, href: alert.href ?? null })) });
    if (alert.email) {
      const kind = alertKind(alert.href);
      // People who switched email off for this kind of alert still get it in the app.
      const users = (await db.user.findMany({ where: { id: { in: ids }, isActive: true }, select: { email: true, prefs: true } }))
        .filter((u) => !((u.prefs as { mutedEmail?: string[] } | null)?.mutedEmail ?? []).includes(kind));
      await Promise.all(users.map((u) => sendMail({ to: u.email, subject: alert.title, text: alert.body ?? alert.title, link: alert.href ? { label: "Open in the portal", url: appUrl(alert.href) } : undefined })));
    }
  } catch (e) {
    console.error("notify failed", e);
  }
}

/** Notifies a student, their linked parent accounts, and the guardian email on record. */
export async function notifyStudents(studentIds: string[], alert: Alert | ((s: { name: string; rollNo: string }) => Alert)) {
  try {
    const students = await db.student.findMany({
      where: { id: { in: studentIds } },
      select: { rollNo: true, guardianEmail: true, userId: true, user: { select: { name: true } }, parents: { select: { userId: true } } },
    });
    for (const s of students) {
      const a = typeof alert === "function" ? alert({ name: s.user.name, rollNo: s.rollNo }) : alert;
      await notifyUsers([s.userId, ...s.parents.map((p) => p.userId)], a);
      if (a.email && s.guardianEmail) await sendMail({ to: s.guardianEmail, subject: a.title, text: a.body ?? a.title, link: a.href ? { label: "Open in the portal", url: appUrl(a.href) } : undefined });
    }
  } catch (e) {
    console.error("notify students failed", e);
  }
}

/** Everyone holding one of these roles (e.g. tell the office a certificate was requested). */
export async function notifyRoles(roles: ("ADMIN" | "ACCOUNTANT" | "HOD" | "OFFICE")[], alert: Alert, departmentId?: string | null) {
  const users = await db.user.findMany({ where: { role: { in: roles }, isActive: true, ...(departmentId && { OR: [{ role: { not: "HOD" } }, { faculty: { departmentId } }] }) }, select: { id: true } });
  await notifyUsers(users.map((u) => u.id), alert);
}
