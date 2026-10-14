import "server-only";
import { cache } from "react";
import { getInstitution } from "./institution";
import { DEFAULT_RULES, parseGradeScale, type Rules } from "./grading";

/**
 * The college's academic rules: attendance thresholds, pass marks and the grade scale.
 * Set under Administration → Rules; anything not set falls back to the built-in defaults.
 */
/** Academic rules plus the two policies that are not about grading: who is promoted and who may sit placements. */
export type CollegeRules = Rules & { promoteMaxBacklogs: number | null; placementSemestersLeft: number };

export const getRules = cache(async (): Promise<CollegeRules> => {
  const i = await getInstitution();
  return {
    attendanceRequired: i.attendanceRequired,
    attendanceCondonable: Math.min(i.attendanceCondonable, i.attendanceRequired),
    passPercent: i.passPercent,
    minExternalPercent: i.minExternalPercent,
    gradeScale: parseGradeScale(i.gradeScale) ?? DEFAULT_RULES.gradeScale,
    promoteMaxBacklogs: i.promoteMaxBacklogs,
    placementSemestersLeft: i.placementFromSemestersLeft,
  };
});

/** Colour for an attendance percentage under these rules. */
export const toneFor = (r: Pick<Rules, "attendanceRequired" | "attendanceCondonable">) => (p: number) =>
  p >= r.attendanceRequired ? ("success" as const) : p >= r.attendanceCondonable ? ("warning" as const) : ("danger" as const);
