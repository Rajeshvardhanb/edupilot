import "server-only";
import { after } from "next/server";
import { createHash } from "node:crypto";
import { db } from "./db";
import { appUrl, sendMail } from "./mail";
import type { EmailContent } from "./email-template";
import { sendAccountSetup } from "./account-setup";
import { ineligibility } from "./placements";
import { studentStandings } from "./results";
import { getRules } from "./rules";
import { attendanceSummary } from "./attendance";

export type AcademicEvent =
  | { type: "account"; id: string }
  | { type: "parent-link"; id: string; studentId: string }
  | { type: "results" | "material" | "submission" | "graded" | "exam" | "supplementary" | "elective" | "condonation-decision" | "leave-request" | "leave-decision" | "revaluation-request" | "revaluation-decision" | "placement-open" | "placement-application" | "placement-status" | "substitution" | "swap-request" | "swap-decision" | "course-allocation" | "timetable" | "invigilation"; id: string }
  | { type: "attendance"; id: string; date: string }
  | { type: "student-update"; id: string; studentIds: string[]; message: string }
  | { type: "security"; id: string; action: string; version: string };

type Notice = EmailContent & { key: string };
const learnerLink = (path: string) => ({ label: "Open student portal", url: appUrl(path) });
const version = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 24);
const date = (d: Date) => d.toISOString().slice(0, 10);

/** One recipient per envelope. Normalize/deduplicate; never expose class email lists. */
export async function emailUsers(ids: string[], notice: Notice) {
  const users = await db.user.findMany({ where: { id: { in: [...new Set(ids)] }, isActive: true }, select: { id: true, email: true } });
  // Independent of SMTP: the portal remains the source of truth for every recipient.
  let href: string | undefined;
  if (notice.link) {
    const url = new URL(notice.link.url), base = new URL(appUrl("/"));
    if (url.origin === base.origin) href = url.pathname + url.search;
  }
  if (users.length) await db.notification.createMany({ data: users.map(user => ({
    id: "notice_" + createHash("sha256").update(`${notice.key}:${user.id}`).digest("hex").slice(0, 40),
    userId: user.id, title: notice.subject, body: [notice.text, ...(notice.details ?? []).map(d => `${d.label}: ${d.value}`)].join("\n"), href,
    category: (notice.category ?? "system").toUpperCase(),
    priority: notice.category === "security" || /needs review/.test(notice.subject) ? "HIGH" : "NORMAL",
    entityType: notice.key.split(":")[0], entityId: notice.key.split(":")[1],
  })), skipDuplicates: true });
  if (process.env.ACADEMIC_EMAILS_ENABLED === "0" && notice.category !== "security") return;
  const recipients = [...new Set(users.map(u => u.email.trim().toLowerCase()))];
  // Sequential delivery keeps Gmail SMTP connections bounded, even for a large class.
  for (const to of recipients) await sendMail({ ...notice, to });
}
export async function emailStudents(ids: string[], notice: Notice, parents = false) {
  const students = await db.student.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { userId: true } });
  const links = parents ? await db.parentLink.findMany({ where: { studentId: { in: ids } }, select: { userId: true } }) : [];
  await emailUsers(students.map(s => s.userId), notice);
  if (links.length) await emailUsers(links.map(p => p.userId), { ...notice, text: notice.text + "\n\nThis update concerns a linked student. Select the relevant child in the parent dashboard. Contact the college for request details.", link: learnerLink("/dashboard") });
}
async function reviewers(studentId: string, notice: Notice) {
  const s = await db.student.findUniqueOrThrow({ where: { id: studentId }, select: { batch: { select: { program: { select: { departmentId: true } } } } } });
  const users = await db.user.findMany({ where: { isActive: true, OR: [{ role: "ADMIN" }, { role: "HOD", faculty: { departmentId: s.batch.program.departmentId } }] }, select: { id: true } });
  await emailUsers(users.map(u => u.id), notice);
}
async function course(offeringId: string) {
  const o = await db.courseOffering.findUniqueOrThrow({ where: { id: offeringId }, include: { subject: true } });
  const students = await db.student.findMany({ where: { batchId: o.batchId, status: "ACTIVE", entrySemester: { lte: o.subject.semester } }, select: { id: true } });
  return { o, ids: students.map(s => s.id) };
}

/** Only called after the action has committed; all recipient selection stays server-side. */
export async function dispatchAcademicEmail(event: AcademicEvent) {
  const key = `${event.type}:${event.id}`;
  if (event.type === "account") {
    await sendAccountSetup(event.id);
  } else if (event.type === "condonation-decision") {
    const r = await db.attendanceCondonation.findUniqueOrThrow({ where: { id: event.id }, include: { term: true } });
    await emailStudents([r.studentId], { key: `${key}:${r.updatedAt.toISOString()}`, category: "academic", subject: "Your hall ticket eligibility has been reviewed", text: `Attendance condonation for ${r.term.name}: ${r.status.toLowerCase()}. Review your current hall ticket eligibility in the portal. Contact Administration for questions. This approval does not record a fee or payment.`, link: learnerLink("/exams/hall-tickets") }, true);
  } else if (event.type === "parent-link") {
    await emailUsers([event.id], { key: event.type === "parent-link" ? `${key}:${event.studentId}` : key, category: "account", subject: "A student has been linked to your parent account", text: "Your college portal access has been updated. Sign in using the credentials supplied separately by the college. If you do not know your password, use Forgot password on the sign-in screen. Never share your password.", link: { label: "Sign in to the college portal", url: appUrl("/login") } });
  } else if (event.type === "security") {
    await emailUsers([event.id], { key: `${key}:${event.action}:${event.version}`, category: "security", subject: "Your account security settings changed", text: `${event.action}\n\nIf you did not expect this change, contact the college administrator promptly. No password is included in this message.`, link: learnerLink("/profile") });
  } else if (event.type === "student-update") {
    await emailStudents(event.studentIds, { key: `${key}:${version(event.message)}`, category: "academic", subject: "Your academic record has been updated", text: event.message + "\n\nSign in to review the current record. Parents with multiple linked children should select the relevant child.", link: learnerLink("/dashboard") }, true);
  } else if (event.type === "results") {
    const results = await db.subjectResult.findMany({ where: { offeringId: event.id, offering: { resultsPublished: true } }, select: { id: true, studentId: true, offering: { select: { subject: { select: { name: true } } } } } });
    if (results.length) await emailStudents(results.map(r => r.studentId), { key: `${key}:${results[0].id}`, category: "academic", subject: "Your course results are available", text: `Results for ${results[0].offering.subject.name} have been published. View your grade card securely in the portal. Marks are not included in this email. Parents should select the relevant child.`, link: learnerLink("/results") }, true);
  } else if (event.type === "leave-request" || event.type === "leave-decision") {
    const r = await db.leaveRequest.findUniqueOrThrow({ where: { id: event.id }, include: { student: { select: { rollNo: true, user: { select: { name: true } } } } } });
    const notice: Notice = { key: `${key}:${r.status}`, category: "request", subject: event.type === "leave-request" ? "A student leave request needs review" : "Your leave request has been reviewed", text: event.type === "leave-request" ? `A student submitted a leave or on-duty request${r.student ? `: ${r.student.user.name} (${r.student.rollNo})` : ""}, for ${date(r.fromDate)} to ${date(r.toDate)}. Open the authorized review screen for the details.` : `Your request for ${date(r.fromDate)} to ${date(r.toDate)} is ${r.status.toLowerCase()}. Sign in to read the decision. Personal or medical reasons are not included in this email.`, link: learnerLink("/leave") };
    if (event.type === "leave-request") {
      await reviewers(r.studentId, notice);
      await emailStudents([r.studentId], { ...notice, key: key + ":receipt", subject: "Your leave request was received", text: "Your leave or on-duty request has been submitted. You can track the decision in the portal." });
    } else await emailStudents([r.studentId], notice, true);
  } else if (event.type === "material") {
    const m = await db.material.findUniqueOrThrow({ where: { id: event.id } });
    const { o, ids } = await course(m.offeringId);
    await emailStudents(ids, { key, category: "learning", subject: m.kind === "ASSIGNMENT" ? "A new assignment is available" : "New course material is available", text: `${m.title}\n${o.subject.name}\n\nOpen the portal to view the material${m.kind === "ASSIGNMENT" ? " and submit your work" : ""}.`, details: m.dueDate ? [{ label: "Due date", value: date(m.dueDate) }] : [], link: learnerLink("/materials") });
  } else if (event.type === "submission" || event.type === "graded") {
    const s = await db.submission.findUniqueOrThrow({ where: { id: event.id }, include: { material: { include: { offering: true } } } });
    await emailStudents([s.studentId], { key: `${key}:${version(event.type === "graded" ? [s.marks, s.feedback] : s.submittedAt)}`, category: "learning", subject: event.type === "graded" ? "Your assignment feedback is ready" : "Your assignment submission was received", text: `${s.material.title}\n\n${event.type === "graded" ? "Sign in to review your marks and feedback." : "Your work has been saved. Check the portal for your latest submission."}`, link: learnerLink("/materials") });
  } else if (event.type === "exam") {
    const ex = await db.examSchedule.findUniqueOrThrow({ where: { id: event.id }, include: { subject: true } });
    const offerings = await db.courseOffering.findMany({ where: { subjectId: ex.subjectId, termId: ex.termId }, select: { batchId: true } });
    const students = await db.student.findMany({ where: { batchId: { in: offerings.map(o => o.batchId) }, status: "ACTIVE", entrySemester: { lte: ex.subject.semester } }, select: { id: true } });
    await emailStudents(students.map(s => s.id), { key: `${key}:${date(ex.date)}:${ex.session}`, category: "academic", subject: "Your examination schedule has been updated", text: `Check the current schedule for ${ex.subject.name} and your hall ticket in the portal.`, details: [{ label: "Date", value: date(ex.date) }, { label: "Session", value: ex.session }], link: learnerLink("/exams/hall-tickets") });
  } else if (event.type === "supplementary") {
    const r = await db.supplementaryRegistration.findUniqueOrThrow({ where: { id: event.id }, include: { subject: true } });
    await emailStudents([r.studentId], { key, category: "request", subject: "Supplementary examination registration confirmed", text: `Your registration for ${r.subject.name} has been recorded. Check the portal for the current schedule.`, link: learnerLink("/exams/supplementary") });
  } else if (event.type === "elective") {
    const c = await db.electiveChoice.findUniqueOrThrow({ where: { id: event.id }, include: { option: { include: { subject: true } } } });
    await emailStudents([c.studentId], { key: `${key}:${c.optionId}`, category: "academic", subject: "Your elective selection is confirmed", text: `Your selected elective is ${c.option.subject.name}. Review the current choice in the portal.`, link: learnerLink("/exams/electives") });
  } else if (event.type === "revaluation-request" || event.type === "revaluation-decision") {
    const r = await db.revaluationRequest.findUniqueOrThrow({ where: { id: event.id }, include: { offering: { include: { subject: true } } } });
    const notice: Notice = { key: `${key}:${r.status}`, category: "request", subject: event.type === "revaluation-request" ? "A revaluation request needs review" : "Your revaluation outcome is available", text: `${r.offering.subject.name}\n\n${event.type === "revaluation-request" ? "A student requested a review. Open the portal for the authorized details." : "Your request has been reviewed. Open the portal for the decision and latest result."}`, link: learnerLink("/exams/revaluation") };
    if (event.type === "revaluation-request") {
      await reviewers(r.studentId, notice);
      await emailStudents([r.studentId], { ...notice, key: key + ":receipt", subject: "Your revaluation request was received", text: "Your request has been recorded. Track the review in the portal." });
    } else await emailStudents([r.studentId], notice);
  } else if (event.type === "placement-open") {
    const drive = await db.placementDrive.findUniqueOrThrow({ where: { id: event.id }, include: { company: true } });
    if (drive.status !== "OPEN") return;
    const students = await db.student.findMany({ where: { status: "ACTIVE", user: { isActive: true } }, include: { batch: { include: { program: true } } } });
    const standings = await studentStandings(students.map(s => s.id));
    const rules = await getRules();
    const ids = students.filter(s => { const st = standings.get(s.id); return st && !ineligibility(drive, s, st, rules.placementSemestersLeft); }).map(s => s.id);
    await emailStudents(ids, { key, category: "placement", subject: "A placement opportunity is open", text: `${drive.company.name} — ${drive.role}\n\nYou meet the current portal eligibility rules. Check the drive details and apply if interested. Eligibility is rechecked when applying.`, details: [{ label: "Drive date", value: date(drive.driveDate) }], link: learnerLink("/placements") });
  } else if (event.type === "placement-application" || event.type === "placement-status") {
    const a = await db.placementApplication.findUniqueOrThrow({ where: { id: event.id }, include: { drive: { include: { company: true } } } });
    await emailStudents([a.studentId], { key: `${key}:${a.status}:${a.roundNo}`, category: "placement", subject: event.type === "placement-application" ? "Your placement application was received" : "Your placement application has an update", text: `${a.drive.company.name} — ${a.drive.role}\n\nSign in to review your application${event.type === "placement-status" ? " status and interview progress" : ""}.`, link: learnerLink("/placements") });
  } else if (event.type === "substitution") {
    const s = await db.substitution.findUniqueOrThrow({ where: { id: event.id }, include: { faculty: true, offering: { include: { subject: true } } } });
    await emailUsers([s.faculty.userId], { key: `${key}:${s.facultyId}`, category: "learning", subject: "You have been assigned a substitute class", text: `${s.offering.subject.name}\n\nReview the class and record attendance through your assigned-course screen.`, details: [{ label: "Date", value: date(s.date) }, { label: "Period", value: String(s.period) }], link: learnerLink("/attendance") });
  } else if (event.type === "swap-request" || event.type === "swap-decision") {
    const s = await db.swapRequest.findUniqueOrThrow({ where: { id: event.id }, include: { from: true, to: true } });
    await emailUsers([event.type === "swap-request" ? s.to.userId : s.from.userId], { key: `${key}:${s.status}`, category: "request", subject: event.type === "swap-request" ? "A colleague requested a class swap" : "Your class swap request was reviewed", text: `Class date: ${date(s.date)}. Open the portal to ${event.type === "swap-request" ? "review the request" : "see the current decision"}.`, link: learnerLink("/staff/swaps") });
  } else if (event.type === "course-allocation") {
    const o = await db.courseOffering.findUniqueOrThrow({ where: { id: event.id }, include: { faculty: true, subject: true } });
    if (o.faculty) await emailUsers([o.faculty.userId], { key: `${key}:${o.facultyId}`, category: "learning", subject: "A course has been assigned to you", text: `${o.subject.name}\n\nYour teaching assignment is available in the portal.`, link: learnerLink("/timetable") });
  } else if (event.type === "timetable") {
    const slots = await db.timetableSlot.findMany({ where: { batchId: event.id, offering: { term: { isCurrent: true } } }, select: { dayOfWeek: true, period: true, offeringId: true, room: true } });
    const students = await db.student.findMany({ where: { batchId: event.id, status: "ACTIVE" }, select: { id: true } });
    await emailStudents(students.map(s => s.id), { key: `${key}:${version(slots.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.period - b.period))}`, category: "academic", subject: "Your class timetable has been updated", text: "Review the latest periods, course assignments and rooms before attending class.", link: learnerLink("/timetable") });
  } else if (event.type === "invigilation") {
    const duty = await db.invigilationDuty.findUniqueOrThrow({ where: { id: event.id }, include: { faculty: true, room: true } });
    await emailUsers([duty.faculty.userId], { key: `invigilation:${duty.facultyId}:${date(duty.date)}:${duty.session}:${duty.roomId}`, category: "academic", subject: "Your examination duty is available", text: "You have been assigned an invigilation duty. Review the current roster in the portal.", details: [{ label: "Date", value: date(duty.date) }, { label: "Session", value: duty.session }, { label: "Hall", value: duty.room.name }], link: learnerLink("/exams/schedule") });
  } else if (event.type === "attendance") {
    // Never email historical data entry. One absence notice per course/student/day;
    // a separate shortage summary is limited to one per student/term/week.
    if (event.date !== date(new Date())) return;
    const { o } = await course(event.id);
    const absent = await db.attendanceRecord.findMany({ where: { status: "ABSENT", session: { offeringId: event.id, date: new Date(`${event.date}T00:00:00Z`) } }, distinct: ["studentId"], select: { studentId: true } });
    const required = (await getRules()).attendanceRequired;
    for (const { studentId } of absent) {
      await emailStudents([studentId], { key: `${key}:${event.date}:${studentId}`, category: "academic", subject: "An absence was recorded today", text: `An absence was recorded for ${o.subject.name} on ${event.date}. Please check the portal for the latest attendance status and contact the teacher if it needs correction.`, link: learnerLink("/attendance") }, true);
      const offerings = await db.courseOffering.findMany({ where: { batchId: o.batchId, termId: o.termId }, select: { id: true } });
      const summary = await attendanceSummary({ studentIds: [studentId], offeringIds: offerings.map(x => x.id) });
      const totals = [...summary.values()].reduce((a, r) => ({ attended: a.attended + r.attended, total: a.total + r.total }), { attended: 0, total: 0 });
      if (totals.total >= 10 && totals.attended * 100 / totals.total < required) await emailStudents([studentId], { key: `shortage:${studentId}:${o.termId}:${Math.floor(Date.now() / (7 * 864e5))}`, category: "academic", subject: "Please review your attendance eligibility", text: `Your recorded overall attendance is below the configured ${required}% requirement. Review your attendance report and discuss any corrections or approved on-duty entries with the department.`, link: learnerLink("/attendance") }, true);
    }
  }
}

/** Next.js tracks this post-response work. It is not a durable background queue. */
export function notifyAcademic(event: AcademicEvent) {
  after(async () => {
    try { await dispatchAcademicEmail(event); }
    catch { console.error(`Academic email preparation failed (${event.type}); the saved academic record is unaffected.`); }
  });
}
