import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), current: vi.fn(), userUpdate: vi.fn(), studentUpdate: vi.fn(), audit: vi.fn(), compare: vi.fn(), revalidate: vi.fn(), check: vi.fn(), consume: vi.fn(), issue: vi.fn(), reset: vi.fn(), notify: vi.fn() }));
vi.mock("@/lib/academic-email", () => ({ notifyAcademic: m.notify }));
vi.mock("@/lib/email-verification", () => ({ checkEmailChallenge: m.check, consumeEmailChallenge: m.consume, issueEmailChallenge: m.issue, maskEmail: (s: string) => s, VerificationError: class extends Error {} }));
vi.mock("@/lib/auth", () => ({ requireUser: m.auth }));
vi.mock("@/lib/db", () => ({ db: { user: { findUniqueOrThrow: m.current }, $transaction: async (fn: (tx: unknown) => unknown) => fn({ user: { findUniqueOrThrow: m.current, update: m.userUpdate }, passwordResetToken: { updateMany: m.reset }, loginCode: { updateMany: m.reset }, accountSetupToken: { updateMany: m.reset }, student: { update: m.studentUpdate }, auditLog: { create: m.audit } }) } }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("bcryptjs", () => ({ default: { compare: m.compare } }));
import { updateMyProfile } from "@/actions/profile";
import { personalProfileSchema } from "@/lib/profile-validation";
function form(extra: Record<string, string> = {}) {
 const values = { name: "LANKE SANDHYA", email: "sandhya.lanke@edupilot.edu", phone: "9876543210", dob: "2004-01-01", gender: "FEMALE", bloodGroup: "", address: "Updated address", guardianName: "", guardianPhone: "", guardianEmail: "", about: "", skills: "", linkedin: "", github: "", ...extra };
 const fd = new FormData(); Object.entries(values).forEach(([k,v])=>fd.set(k,v)); return fd;
}
beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ id:"owner", role:"STUDENT", studentId:"owner-student" }); m.current.mockResolvedValue({ name: "LANKE SANDHYA", phone: "9876543210", email:"sandhya.lanke@edupilot.edu", emailVerifiedAt: null, updatedAt: new Date("2026-01-01"), passwordHash:"hash", student: personalProfileSchema.parse(Object.fromEntries(form())) }); m.check.mockResolvedValue(true); m.compare.mockResolvedValue(false); });
describe("profile ownership and validation", () => {
 it("uses the authenticated student and ignores forged role, student ID and academic fields", async () => {
  const result=await updateMyProfile({},form({id:"victim",studentId:"victim-student",role:"ADMIN",rollNo:"FORGED",batchId:"wrong"}));
  expect(result.ok).toBe(true);
  expect(m.userUpdate).toHaveBeenCalledWith({where:{id:"owner"},data:{name:"LANKE SANDHYA",email:"sandhya.lanke@edupilot.edu",phone:"9876543210"}});
  expect(m.studentUpdate.mock.calls[0][0].where).toEqual({id:"owner-student",userId:"owner"});
  expect(m.studentUpdate.mock.calls[0][0].data).not.toHaveProperty("rollNo");
  expect(m.studentUpdate.mock.calls[0][0].data.guardianName).toBeNull();
 });
 it("requires the current password before changing login email", async()=>{
  expect((await updateMyProfile({},form({email:"new@example.org"}))).error).toContain("current password");
  expect(m.userUpdate).not.toHaveBeenCalled();
  m.compare.mockResolvedValue(true);
  expect((await updateMyProfile({},form({email:"new@example.org",currentPassword:"correct"}))).ok).toBe(true);
 });
 it("parents can edit their own account but cannot edit their child's record", async()=>{
  m.auth.mockResolvedValue({id:"parent",role:"PARENT",studentId:"child"});
  expect((await updateMyProfile({},form())).ok).toBe(true);
  expect(m.userUpdate.mock.calls[0][0].where).toEqual({id:"parent"});expect(m.studentUpdate).not.toHaveBeenCalled();
 });
 it("blocks major details without a valid OTP and never writes changes", async () => {
  m.check.mockResolvedValue(false);
  expect((await updateMyProfile({},form({phone:"9999999999"}))).error).toContain("OTP");
  expect(m.userUpdate).not.toHaveBeenCalled(); expect(m.studentUpdate).not.toHaveBeenCalled();
 });
 it("binds sensitive updates to the authenticated user and consumes the challenge", async () => {
  const result = await updateMyProfile({},form({name:"LANKE SANDHYA UPDATED",challengeId:"challenge",verificationCode:"123456"}));
  expect(result.ok).toBe(true);
  expect(m.check.mock.calls[0][1]).toMatchObject({ userId:"owner",purpose:"PROFILE",targetEmail:"sandhya.lanke@edupilot.edu",code:"123456" });
  expect(m.consume).toHaveBeenCalled();expect(m.notify).toHaveBeenCalled();
 });
 it.each<Record<string, string>>([{dob:"2099-01-01"},{dob:"2026-02-30"},{github:"javascript:alert(1)"},{phone:"bad"},{guardianEmail:"bad"}])("rejects invalid personal details %j",async extra=>{
  expect((await updateMyProfile({},form(extra))).error).toBeTruthy();expect(m.userUpdate).not.toHaveBeenCalled();
 });
 it("clears optional details rather than retaining old values",()=>{
  const data=personalProfileSchema.parse(Object.fromEntries(form({dob:"",address:"",github:""})));
  expect(data.dob).toBeNull();expect(data.address).toBeNull();expect(data.github).toBeNull();
 });
});
