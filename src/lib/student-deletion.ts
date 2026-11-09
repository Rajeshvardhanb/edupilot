import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
type DeletionTransaction = Pick<typeof db, "user" | "payment" | "auditLog" | "$queryRaw">;
/** Caller checks Admin permission or verifies that this record was already deleted. */
export async function permanentlyDeleteStudent(tx: DeletionTransaction, studentId: string, userId: string) {
  // Clear only this student's legacy payment/refund dependencies; all other
  // owned records cascade from the login/student. Shared parent users remain.
  await tx.payment.updateMany({ where: { invoice: { studentId } }, data: { refundOfId: null } });
  await tx.payment.deleteMany({ where: { invoice: { studentId } } });
  await tx.user.delete({ where: { id: userId, role: "STUDENT" } });
}
/** Register atomically, releasing only identities archived by the previous Delete implementation. */
export async function createStudentAccount(input: Prisma.UserCreateInput, rollNo: string, actorId: string) {
  return db.$transaction(async tx => {
    // Presentation reads deliberately hide archived students; this narrowly scoped
    // maintenance query is parameterized and never selects active identities.
    const archived = await tx.$queryRaw<{ id: string; userId: string; rollNo: string }[]>`
      SELECT s.id, s.userId, s.rollNo FROM Student s JOIN User u ON u.id=s.userId
      WHERE s.archivedAt IS NOT NULL AND u.role='STUDENT'
      AND (u.email=${input.email} OR s.rollNo=${rollNo}) FOR UPDATE`;
    for (const old of archived) {
      await permanentlyDeleteStudent(tx, old.id, old.userId);
      await tx.auditLog.create({ data: { userId: actorId, action: "PURGE_ARCHIVED_STUDENT", entity: "Student", entityId: old.id, details: `Released previously deleted identity ${old.rollNo} during re-registration.` } });
    }
    return tx.user.create({ data: input, include: { student: true } });
  }, { timeout: 15000 });
}
