import "server-only";
import { sha256 } from "./security";

export const MAJOR_PROFILE_FIELDS = ["dob", "gender", "bloodGroup", "address", "guardianName", "guardianPhone", "guardianEmail"];
const normal = (v: unknown) => v instanceof Date ? v.toISOString() : v ?? null;
export function profileNeedsVerification(current: { name: string; email: string; phone: string | null; student?: object | null }, account: { name: string; email: string; phone: string | null }, personal: object | null) {
  if (["name", "email", "phone"].some(k => normal(current[k as keyof typeof current]) !== normal(account[k as keyof typeof account]))) return true;
  return !!personal && MAJOR_PROFILE_FIELDS.some(k => normal((current.student as Record<string, unknown> | null)?.[k]) !== normal((personal as Record<string, unknown>)[k]));
}
export const profileChangeHash = (id: string, updatedAt: Date, account: object, personal: object | null) => sha256(JSON.stringify({ id, base: updatedAt.toISOString(), account, personal }));
export const demoEmailBootstrap = (current: { email: string; emailVerifiedAt: Date | null }, nextEmail: string) => !current.emailVerifiedAt && current.email.endsWith("@edupilot.edu") && nextEmail !== current.email;
