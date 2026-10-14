import "server-only";
import { redirect } from "next/navigation";
import type { CurrentUser } from "./auth";

/** The student whose records a student/parent is viewing; sends an unlinked parent back to the dashboard. */
export function learnerId(user: CurrentUser): string {
  if (!user.studentId) redirect("/dashboard");
  return user.studentId;
}
