import type { Role } from "@prisma/client";

const TEACHING: Role[] = ["ADMIN", "HOD", "FACULTY"];
const TABS: { href: string; label: string; roles?: Role[] }[] = [
  { href: "/staff", label: "Attendance" },
  { href: "/staff/leave", label: "Leave" },
  // Appraisal records and class swaps are for teaching staff; the pages do not let other roles in.
  { href: "/staff/achievements", label: "Appraisal records", roles: TEACHING },
  { href: "/staff/swaps", label: "Class swaps", roles: TEACHING },
  { href: "/staff/payroll", label: "Payroll" },
];

/** The Staff tabs this role may open. */
export const staffTabs = (role: Role) => TABS.filter((t) => !t.roles || t.roles.includes(role));
