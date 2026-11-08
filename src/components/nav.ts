import type { Role } from "@prisma/client";
import {
  Award, Briefcase, Building2, CalendarClock, CalendarDays, CalendarRange, ClipboardCheck,
  FileSpreadsheet, FolderOpen, GraduationCap, LayoutDashboard, ListChecks, Medal, MessageSquareHeart,
  Plane, RotateCcw, SearchCheck, Shapes, ShieldCheck, Target, Ticket,
  UserCircle, Users,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; roles: Role[]; group: string; hint?: string };

const STAFF: Role[] = ["ADMIN", "HOD", "FACULTY"];
const ALL: Role[] = ["ADMIN", "HOD", "FACULTY", "STUDENT", "ACCOUNTANT", "PARENT", "OFFICE"];

export const NAV: NavItem[] = [
  { group: "Overview", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL, hint: "Home, KPIs and insights" },
  { group: "Overview", href: "/calendar", label: "Calendar", icon: CalendarRange, roles: ALL, hint: "Holidays, exams and events" },

  { group: "People", href: "/students", label: "Students", icon: GraduationCap, roles: ["ADMIN", "HOD", "FACULTY", "ACCOUNTANT", "OFFICE"], hint: "Admissions, profiles, import/export" },
  { group: "People", href: "/alumni", label: "Alumni", icon: Medal, roles: ["ADMIN", "HOD"], hint: "Graduates and where they are now" },

  { group: "Academics", href: "/academics", label: "Academics", icon: Building2, roles: ["ADMIN", "HOD"], hint: "Departments, programmes, curriculum" },
  { group: "Academics", href: "/academics/teachers", label: "Teacher accounts", icon: Users, roles: ["ADMIN", "HOD"], hint: "Basic accounts for academic activities" },
  { group: "Academics", href: "/staff/swaps", label: "Class swaps", icon: CalendarClock, roles: STAFF },
  { group: "Academics", href: "/timetable", label: "Timetable", icon: CalendarDays, roles: ALL, hint: "Weekly class schedule" },
  { group: "Academics", href: "/attendance", label: "Attendance", icon: ClipboardCheck, roles: [...STAFF, "STUDENT", "PARENT"], hint: "Mark and track attendance" },
  { group: "Academics", href: "/leave", label: "Leave & OD", icon: Plane, roles: [...STAFF, "STUDENT"], hint: "Leave and on-duty requests" },
  { group: "Academics", href: "/materials", label: "Study material", icon: FolderOpen, roles: [...STAFF, "STUDENT"], hint: "Notes and assignments" },
  { group: "Academics", href: "/syllabus", label: "Syllabus", icon: ListChecks, roles: STAFF, hint: "Lesson plan and coverage" },

  { group: "Examinations", href: "/exams", label: "Marks entry", icon: FileSpreadsheet, roles: STAFF, hint: "Assessments and marks" },
  { group: "Examinations", href: "/exams/schedule", label: "Exam schedule", icon: CalendarClock, roles: [...STAFF, "STUDENT", "PARENT"], hint: "Dates, rooms and seating" },
  { group: "Examinations", href: "/exams/hall-tickets", label: "Hall tickets", icon: Ticket, roles: ["ADMIN", "HOD", "STUDENT"], hint: "Eligibility and admit cards" },
  { group: "Examinations", href: "/results", label: "Results", icon: Award, roles: ["ADMIN", "HOD", "STUDENT", "PARENT"], hint: "SGPA, CGPA and grade cards" },
  { group: "Examinations", href: "/exams/revaluation", label: "Revaluation", icon: SearchCheck, roles: ["ADMIN", "HOD", "STUDENT"], hint: "Re-check requests and grace marks" },
  { group: "Examinations", href: "/exams/supplementary", label: "Supplementary", icon: RotateCcw, roles: ["ADMIN", "STUDENT"], hint: "Backlog exam registration" },
  { group: "Examinations", href: "/exams/electives", label: "Electives", icon: Shapes, roles: ["ADMIN", "HOD", "STUDENT"], hint: "Elective selection" },
  { group: "Examinations", href: "/exams/outcomes", label: "Outcomes (CO-PO)", icon: Target, roles: STAFF, hint: "Attainment for accreditation" },
  { group: "Examinations", href: "/feedback", label: "Feedback", icon: MessageSquareHeart, roles: [...STAFF, "STUDENT"], hint: "Course feedback" },

  { group: "Campus", href: "/placements", label: "Placements", icon: Briefcase, roles: ["ADMIN", "HOD", "STUDENT"], hint: "Drives, applications, offers" },



  { group: "System", href: "/admin", label: "Administration", icon: ShieldCheck, roles: ["ADMIN"], hint: "Users, branding, audit log" },
  { group: "System", href: "/profile", label: "My Profile", icon: UserCircle, roles: ALL, hint: "Photo and password" },
];

/** The nav entry whose href is the longest prefix of the current path (so /exams/schedule beats /exams). */
export function activeHref(pathname: string, items: NavItem[]) {
  return items.filter((i) => pathname === i.href || pathname.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administrator",
  HOD: "Head of Department",
  FACULTY: "Faculty",
  STUDENT: "Student",
  ACCOUNTANT: "Accounts Officer",
  PARENT: "Parent",
  OFFICE: "Office Staff",
};
