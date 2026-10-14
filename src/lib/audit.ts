import "server-only";
import { db } from "./db";

export async function audit(userId: string | null, action: string, entity: string, entityId?: string, details?: string) {
  try {
    await db.auditLog.create({ data: { userId, action, entity, entityId, details } });
  } catch (e) {
    console.error("audit log failed", e);
  }
}
