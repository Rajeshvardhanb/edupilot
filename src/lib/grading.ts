export type GradeRow = { min: number; grade: string; point: number };

// 10-point relative-free grading used by most AICTE/UGC affiliated universities.
export const GRADE_SCALE: readonly GradeRow[] = [
  { min: 90, grade: "O", point: 10 },
  { min: 80, grade: "A+", point: 9 },
  { min: 70, grade: "A", point: 8 },
  { min: 60, grade: "B+", point: 7 },
  { min: 55, grade: "B", point: 6 },
  { min: 50, grade: "C", point: 5 },
  { min: 40, grade: "P", point: 4 },
  { min: 0, grade: "F", point: 0 },
];

/** Academic rules a college can change. `minExternalPercent` is the share of the end-semester exam needed to pass, independent of the total. */
export type Rules = { attendanceRequired: number; attendanceCondonable: number; passPercent: number; minExternalPercent: number; gradeScale: readonly GradeRow[] };
export const DEFAULT_RULES: Rules = { attendanceRequired: 75, attendanceCondonable: 65, passPercent: 40, minExternalPercent: 35, gradeScale: GRADE_SCALE };

/**
 * Checks a grade scale entered by the college and returns it sorted highest first, or null if it can't be used:
 * it needs at least two rows, unique grades, points from 0 to 10 that never rise as marks fall, and a row starting at 0.
 */
export function parseGradeScale(input: unknown): GradeRow[] | null {
  if (!Array.isArray(input) || input.length < 2 || input.length > 15) return null;
  const rows: GradeRow[] = [];
  for (const r of input) {
    const min = Number(r?.min), point = Number(r?.point), grade = String(r?.grade ?? "").trim();
    if (!grade || grade.length > 4 || !Number.isFinite(min) || !Number.isFinite(point) || min < 0 || min > 100 || point < 0 || point > 10) return null;
    rows.push({ min, grade, point });
  }
  rows.sort((a, b) => b.min - a.min);
  if (rows[rows.length - 1].min !== 0) return null;
  if (new Set(rows.map((r) => r.grade)).size !== rows.length || new Set(rows.map((r) => r.min)).size !== rows.length) return null;
  if (rows.some((r, i) => i > 0 && r.point > rows[i - 1].point)) return null;
  return rows;
}

export function gradeFor(percent: number, scale: readonly GradeRow[] = GRADE_SCALE) {
  return scale.find((g) => percent >= g.min) ?? scale[scale.length - 1];
}

type AssessmentLite = { id: string; type: string; maxMarks: number };
type MarkLite = { assessmentId: string; marks: number | null; isAbsent: boolean };

export type ComputedResult = {
  internal: number;
  external: number;
  total: number;
  percent: number;
  grade: string;
  gradePoint: number;
  passed: boolean;
  complete: boolean; // every assessment has an entry
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeResult(
  subject: { internalMax: number; externalMax: number },
  assessments: AssessmentLite[],
  marks: MarkLite[],
  rules: Pick<Rules, "passPercent" | "minExternalPercent" | "gradeScale"> = DEFAULT_RULES,
): ComputedResult {
  const byId = new Map(marks.map((m) => [m.assessmentId, m]));
  const internals = assessments.filter((a) => a.type !== "END_SEM");
  const externals = assessments.filter((a) => a.type === "END_SEM");

  const scaled = (list: AssessmentLite[], outOf: number) => {
    const max = list.reduce((s, a) => s + a.maxMarks, 0);
    if (max === 0 || outOf === 0) return 0;
    const got = list.reduce((s, a) => s + (byId.get(a.id)?.marks ?? 0), 0);
    return (got / max) * outOf;
  };

  const internal = round1(scaled(internals, subject.internalMax));
  const external = round1(scaled(externals, subject.externalMax));
  const total = round1(internal + external);
  const outOf = subject.internalMax + subject.externalMax;
  const percent = outOf ? round1((total / outOf) * 100) : 0;
  const absentInFinal = externals.some((a) => byId.get(a.id)?.isAbsent);
  const externalOk = subject.externalMax === 0 || external >= (subject.externalMax * rules.minExternalPercent) / 100;
  const passed = !absentInFinal && externalOk && percent >= rules.passPercent;
  const g = passed ? gradeFor(percent, rules.gradeScale) : { grade: absentInFinal ? "AB" : "F", point: 0 };

  return {
    internal,
    external,
    total,
    percent,
    grade: g.grade,
    gradePoint: g.point,
    passed,
    complete: assessments.length > 0 && assessments.every((a) => byId.has(a.id)),
  };
}

/**
 * Grade for already-scaled internal and end-semester marks. Used when a published result is revised
 * (revaluation) or moderated (grace marks), where the marks are known and only the grade must follow.
 */
export function regrade(subject: { internalMax: number; externalMax: number }, internal: number, external: number, rules: Pick<Rules, "passPercent" | "minExternalPercent" | "gradeScale"> = DEFAULT_RULES) {
  const total = round1(internal + external);
  const outOf = subject.internalMax + subject.externalMax;
  const percent = outOf ? round1((total / outOf) * 100) : 0;
  const externalOk = subject.externalMax === 0 || external >= (subject.externalMax * rules.minExternalPercent) / 100;
  const passed = externalOk && percent >= rules.passPercent;
  const g = passed ? gradeFor(percent, rules.gradeScale) : { grade: "F", point: 0 };
  return { total, percent, grade: g.grade, gradePoint: g.point, passed };
}

/**
 * The fewest extra end-semester marks (whole marks, up to `max`) that would turn a fail into a pass,
 * or null if `max` is not enough. Grace is added to the end-semester mark.
 */
export function graceNeeded(subject: { internalMax: number; externalMax: number }, internal: number, external: number, max: number, rules: Pick<Rules, "passPercent" | "minExternalPercent" | "gradeScale"> = DEFAULT_RULES) {
  if (regrade(subject, internal, external, rules).passed) return 0;
  for (let g = 1; g <= max; g++) if (external + g <= subject.externalMax && regrade(subject, internal, external + g, rules).passed) return g;
  return null;
}

type ResultLite = { gradePoint: number; credits: number; passed: boolean; subjectId: string; termId: string };

/** Credit-weighted grade point average. Failed subjects count with 0 points. */
export function gpa(rows: { gradePoint: number; credits: number }[]) {
  const credits = rows.reduce((s, r) => s + r.credits, 0);
  if (!credits) return 0;
  return Math.round((rows.reduce((s, r) => s + r.gradePoint * r.credits, 0) / credits) * 100) / 100;
}

/**
 * Academic standing from all published results. A later pass in the same subject
 * clears a backlog; CGPA uses the best attempt per subject.
 */
export function standing(results: ResultLite[]) {
  const best = new Map<string, ResultLite>();
  for (const r of results) {
    const prev = best.get(r.subjectId);
    if (!prev || r.gradePoint > prev.gradePoint) best.set(r.subjectId, r);
  }
  const finals = [...best.values()];
  const byTerm = new Map<string, ResultLite[]>();
  for (const r of results) byTerm.set(r.termId, [...(byTerm.get(r.termId) ?? []), r]);
  return {
    cgpa: gpa(finals),
    backlogs: finals.filter((r) => !r.passed).length,
    creditsEarned: finals.filter((r) => r.passed).reduce((s, r) => s + r.credits, 0),
    sgpaByTerm: new Map([...byTerm].map(([t, rows]) => [t, gpa(rows)])),
  };
}

/** Classes in a row a student must attend to bring attendance up to `required` percent. Infinity if it can never be reached (a 100% rule after an absence). */
export function classesToReach(required: number, attended: number, total: number) {
  // Smallest n with (attended + n) / (total + n) >= required / 100, worked in whole numbers to avoid rounding (1 - 0.8 is not exactly 0.2).
  const short = required * total - 100 * attended;
  if (short <= 0) return 0;
  if (required >= 100) return Infinity;
  return Math.ceil(short / (100 - required));
}
