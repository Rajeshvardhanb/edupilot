/** Pay calculation, kept free of database code so it can be unit-tested. */

export type Structure = { basic: number; hra: number; da: number; allowances: number; pfPercent: number; otherDeductions: number };

const round = (n: number) => Math.round(n);

/** Working days in a month: every day except Sundays and the holidays given (as day-of-month numbers). */
export function workingDaysIn(month: string, holidays: number[] = []) {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const off = new Set(holidays);
  let n = 0;
  for (let d = 1; d <= days; d++) if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() !== 0 && !off.has(d)) n++;
  return n;
}

/**
 * One month's pay. Loss-of-pay days (absences not covered by approved leave; a half day counts 0.5)
 * reduce the gross in proportion to the month's working days. Provident fund is a share of basic pay.
 */
export function computePay(s: Structure, workingDays: number, lopDays: number) {
  const gross = s.basic + s.hra + s.da + s.allowances;
  const lop = Math.min(Math.max(0, lopDays), workingDays);
  const lopDeduction = workingDays ? round((gross / workingDays) * lop) : 0;
  const pf = round((s.basic * s.pfPercent) / 100);
  const net = Math.max(0, round(gross - lopDeduction - pf - s.otherDeductions));
  return { gross: round(gross), lopDays: lop, paidDays: workingDays - lop, lopDeduction, pf, otherDeductions: round(s.otherDeductions), net };
}
