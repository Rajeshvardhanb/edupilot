import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ auth: vi.fn(), current: vi.fn(), userUpdate: vi.fn(), studentUpdate: vi.fn(), audit: vi.fn(), compare: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: m.auth }));
vi.mock("@/lib/db", () => ({ db: { user: { findUniqueOrThrow: m.current }, $transaction: async (fn: (tx: unknown) => unknown) => fn({ user: { update: m.userUpdate }, student: { update: m.studentUpdate }, auditLog: { create: m.audit } }) } }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
vi.mock("bcryptjs", () => ({ default: { compare: m.compare } }));
import { updateMyProfile } from "@/actions/profile";
import { personalProfileSchema } from "@/lib/profile-validation";
function form(extra: Record<string, string> = {}) {
 const values = { name: "LANKE SANDHYA", email: "student@edupilot.edu", phone: "9876543210", dob: "2004-01-01", gender: "FEMALE", bloodGroup: "", address: "Updated address", guardianName: "", guardianPhone: "", guardianEmail: "", about: "", skills: "", linkedin: "", github: "", ...extra };
 const fd = new FormData(); Object.entries(values).forEach(([k,v])=>fd.set(k,v)); return fd;
}
beforeEach(() => { vi.clearAllMocks(); m.auth.mockResolvedValue({ id:"owner", role:"STUDENT", studentId:"owner-student" }); m.current.mockResolvedValue({ email:"student@edupilot.edu", passwordHash:"hash" }); m.compare.mockResolvedValue(false); });
describe("profile ownership and validation", () => {
 it("uses the authenticated student and ignores forged role, student ID and academic fields", async () => {
  const result=await updateMyProfile({},form({id:"victim",studentId:"victim-student",role:"ADMIN",rollNo:"FORGED",batchId:"wrong"}));
  expect(result.ok).toBe(true);
  expect(m.userUpdate).toHaveBeenCalledWith({where:{id:"owner"},data:{name:"LANKE SANDHYA",email:"student@edupilot.edu",phone:"9876543210"}});
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
 it.each<Record<string, string>>([{dob:"2099-01-01"},{dob:"2026-02-30"},{github:"javascript:alert(1)"},{phone:"bad"},{guardianEmail:"bad"}])("rejects invalid personal details %j",async extra=>{
  expect((await updateMyProfile({},form(extra))).error).toBeTruthy();expect(m.userUpdate).not.toHaveBeenCalled();
 });
 it("clears optional details rather than retaining old values",()=>{
  const data=personalProfileSchema.parse(Object.fromEntries(form({dob:"",address:"",github:""})));
  expect(data.dob).toBeNull();expect(data.address).toBeNull();expect(data.github).toBeNull();
 });
});
