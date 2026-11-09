import type { Role } from "@prisma/client";
// Section destinations avoid stale IDs and routes removed from the current application.
const staff: Role[] = ["ADMIN", "HOD", "FACULTY"];
const all: Role[] = [...staff, "STUDENT", "PARENT", "OFFICE", "ACCOUNTANT"];
const destinations: [string, Role[]][] = [
  ["/exams/hall-tickets", ["ADMIN", "HOD", "STUDENT"]],
  ["/exams/revaluation", ["ADMIN", "HOD", "STUDENT"]],
  ["/exams/supplementary", ["ADMIN", "STUDENT"]],
  ["/exams/electives", ["ADMIN", "HOD", "STUDENT"]],
  ["/exams/schedule", [...staff, "STUDENT", "PARENT"]],
  ["/exams/outcomes", staff], ["/exams", staff],
  ["/staff/swaps", staff], ["/leave", [...staff, "STUDENT"]],
  ["/materials", [...staff, "STUDENT"]], ["/results", ["ADMIN", "HOD", "STUDENT", "PARENT"]],
  ["/attendance", [...staff, "STUDENT", "PARENT"]], ["/timetable", all],
  ["/placements", ["ADMIN", "HOD", "STUDENT"]], ["/profile", all],
  ["/students", [...staff, "OFFICE", "ACCOUNTANT"]], ["/calendar", all], ["/dashboard", all],
];
export function notificationTarget(href: string | null | undefined, role: Role): string | null {
  if (!href?.startsWith("/") || href.startsWith("//")) return null;
  try {
    const url = new URL(href, "https://notification.local");
    if (url.origin !== "https://notification.local") return null;
    const match = destinations.find(([path]) => url.pathname === path || url.pathname.startsWith(path + "/"));
    return match && match[1].includes(role) ? match[0] : null;
  } catch { return null; }
}
