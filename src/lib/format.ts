export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "—";

export const fmtDateTime = (d: Date | string) =>
  new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** yyyy-mm-dd for <input type="date"> (dates are stored as UTC midnight). */
export const isoDate = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export const pct = (num: number, den: number) => (den === 0 ? 0 : Math.round((num / den) * 1000) / 10);

export const titleCase = (s: string) =>
  s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const yearOfSemester = (sem: number) => Math.ceil(sem / 2);

export function batchLabel(b: { admissionYear: number; section: string; program: { code: string } }) {
  return `${b.program.code} ${b.admissionYear}-${b.section}`;
}

/** Date `n` days before now (request time on the server). */
export const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);

/** Indian-English amount in words, e.g. "Ninety Eight Thousand Five Hundred Rupees Only". */
export function inWords(n: number) {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number) => (x < 20 ? a[x] : `${b[Math.floor(x / 10)]} ${a[x % 10]}`.trim());
  const three = (x: number) => (x >= 100 ? `${a[Math.floor(x / 100)]} Hundred ${two(x % 100)}` : two(x)).trim();
  let r = Math.round(n);
  if (!r) return "Zero Rupees Only";
  const parts: string[] = [];
  for (const [div, name] of [[1e7, "Crore"], [1e5, "Lakh"], [1e3, "Thousand"]] as const) {
    if (r >= div) { parts.push(`${three(Math.floor(r / div))} ${name}`); r %= div; }
  }
  if (r) parts.push(three(r));
  return `${parts.join(" ")} Rupees Only`;
}

/** Whole and fractional years from a date until now. */
export const yearsSince = (d: Date | null | undefined) => (d ? (Date.now() - d.getTime()) / (365.25 * 864e5) : 0);
