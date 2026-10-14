import "server-only";
import type { PlacementDrive, ProgramLevel } from "@prisma/client";

type Candidate = { status: string; batch: { currentSemester: number; program: { level: ProgramLevel; totalSemesters: number } } };
type Standing = { cgpa: number; backlogs: number };

/**
 * Returns null when eligible, otherwise the reason. `semestersLeft` is the college's rule for how close to
 * finishing a student must be: 3 (the default) means pre-final and final year, 1 means final year only.
 */
export function ineligibility(drive: Pick<PlacementDrive, "eligibleLevels" | "minCgpa" | "maxBacklogs">, s: Candidate, st: Standing, semestersLeft = 3): string | null {
  if (s.status !== "ACTIVE") return "Not an active student";
  if (!drive.eligibleLevels.split(",").includes(s.batch.program.level)) return `Open to ${drive.eligibleLevels.replace(",", ", ")} only`;
  if (s.batch.program.totalSemesters - s.batch.currentSemester > semestersLeft) return semestersLeft <= 1 ? "Open to final year only" : semestersLeft <= 3 ? "Open to pre-final & final year" : "Not yet open to your year";
  if (st.cgpa < drive.minCgpa) return `CGPA ${st.cgpa.toFixed(2)} < ${drive.minCgpa}`;
  if (st.backlogs > drive.maxBacklogs) return `${st.backlogs} backlog(s), max ${drive.maxBacklogs}`;
  return null;
}
