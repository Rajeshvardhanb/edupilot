import type { Role } from "@prisma/client";
import {
  LayoutDashboard, GraduationCap, Users, Building2, CalendarDays, ClipboardCheck, FileSpreadsheet, Award, Wallet, Briefcase,
  Megaphone, ShieldCheck, UserCircle, CalendarRange, UserPlus, Plane, FolderOpen, ListChecks, CalendarClock, Ticket, RotateCcw,
  Shapes, Target, MessageSquareHeart, HandCoins, Library, BedDouble, Bus, ScrollText, LifeBuoy, IdCard, ContactRound, Medal, BarChart3, SearchCheck, Boxes, DoorOpen,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; roles: Role[]; group: string; hint?: string };

const STAFF: Role[] = ["ADMIN", "HOD", "FACULTY"];
const ALL: Role[] = ["ADMIN", "HOD", "FACULTY", "STUDENT", "ACCOUNTANT", "PARENT", "OFFICE"];

export const NAV: NavItem[] = [
  { group: "Overview", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL, hint: "Home, KPIs and insights" },
  { group: "Overview", href: "/notices", label: "Notices", icon: Megaphone, roles: ALL, hint: "Circulars and announcements" },
  { group: "Overview", href: "/calendar", label: "Calendar", icon: CalendarRange, roles: ALL, hint: "Holidays, exams and events" },

  { group: "People", href: "/students", label: "Students", icon: GraduationCap, roles: ["ADMIN", "HOD", "FACULTY", "ACCOUNTANT", "OFFICE"], hint: "Admissions, profiles, import/export" },
  { group: "People", href: "/faculty", label: "Faculty", icon: Users, roles: ["ADMIN", "HOD"], hint: "Staff profiles and workload" },
  { group: "People", href: "/admissions", label: "Admissions", icon: UserPlus, roles: ["ADMIN", "OFFICE"], hint: "Enquiry pipeline and follow-ups" },
  { group: "People", href: "/staff", label: "Staff", icon: ContactRound, roles: ["ADMIN", "HOD", "FACULTY", "ACCOUNTANT", "OFFICE"], hint: "Staff attendance, leave, appraisal, swaps" },
  { group: "People", href: "/alumni", label: "Alumni", icon: Medal, roles: ["ADMIN", "HOD"], hint: "Graduates and where they are now" },

  { group: "Academics", href: "/academics", label: "Academics", icon: Building2, roles: ["ADMIN", "HOD"], hint: "Departments, programmes, curriculum" },
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

  { group: "Campus", href: "/fees", label: "Fees", icon: Wallet, roles: ["ADMIN", "ACCOUNTANT", "STUDENT", "PARENT"], hint: "Invoices, collections, receipts" },
  { group: "Campus", href: "/scholarships", label: "Scholarships", icon: HandCoins, roles: ["ADMIN", "ACCOUNTANT"], hint: "Scheme claims and status" },
  { group: "Campus", href: "/placements", label: "Placements", icon: Briefcase, roles: ["ADMIN", "HOD", "STUDENT"], hint: "Drives, applications, offers" },
  { group: "Campus", href: "/library", label: "Library", icon: Library, roles: ["ADMIN", "OFFICE", "FACULTY", "STUDENT"], hint: "Books, issues and returns" },
  { group: "Campus", href: "/hostel", label: "Hostel", icon: BedDouble, roles: ["ADMIN", "OFFICE", "STUDENT"], hint: "Rooms and allocation" },
  { group: "Campus", href: "/transport", label: "Transport", icon: Bus, roles: ["ADMIN", "OFFICE", "STUDENT"], hint: "Routes, stops and passes" },

  { group: "Campus", href: "/inventory", label: "Inventory", icon: Boxes, roles: ["ADMIN", "HOD", "OFFICE"], hint: "Lab equipment and assets" },

  { group: "Services", href: "/gate", label: "Gate pass", icon: DoorOpen, roles: ["ADMIN", "OFFICE", "STUDENT"], hint: "Visitors and student gate passes" },
  { group: "Services", href: "/certificates", label: "Certificates", icon: ScrollText, roles: ["ADMIN", "OFFICE", "STUDENT"], hint: "Bonafide, study, transfer" },
  { group: "Services", href: "/helpdesk", label: "Helpdesk", icon: LifeBuoy, roles: ALL, hint: "Grievances and support" },
  { group: "Services", href: "/id-card", label: "ID card", icon: IdCard, roles: ["STUDENT"], hint: "Digital identity card" },

  { group: "System", href: "/reports", label: "Reports", icon: BarChart3, roles: ["ADMIN", "HOD", "ACCOUNTANT"], hint: "Report builder, accreditation, schedules" },
  { group: "System", href: "/admin", label: "Administration", icon: ShieldCheck, roles: ["ADMIN"], hint: "Users, branding, audit log" },
  { group: "System", href: "/profile", label: "My Profile", icon: UserCircle, roles: ALL, hint: "Photo, language and password" },
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
