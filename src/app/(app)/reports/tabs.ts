import type { Role } from "@prisma/client";

const TABS: { href: string; label: string; roles?: Role[] }[] = [
  { href: "/reports", label: "Report builder" },
  // Academic figures for NAAC/NBA files: the accounts office has no use for them (and the page does not let it in).
  { href: "/reports/accreditation", label: "Accreditation data", roles: ["ADMIN", "HOD"] },
  { href: "/reports/schedules", label: "Scheduled emails" },
];

/** The Reports tabs this role may open. */
export const reportTabs = (role: Role) => TABS.filter((t) => !t.roles || t.roles.includes(role));
