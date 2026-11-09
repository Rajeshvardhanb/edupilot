import { describe, expect, it } from "vitest";
import identities from "../../prisma/sviet-students.json";
import { emailPlan } from "../../scripts/sync-student-emails.mjs";
const records=()=>identities.map((s,i)=>({id:`s${i}`,userId:`u${i}`,rollNo:s.rollNo,user:{role:"STUDENT",name:s.name,email:s.rollNo==="24MQ5A0509"?"student@edupilot.edu":`${s.rollNo.toLowerCase()}@student.edupilot.edu`}}));
describe("firstname.lastname student login migration",()=>{
 it("assigns 21 unique usernames and Sandhya remains the default identity",()=>{
  const plan=emailPlan(identities,records());expect(plan).toHaveLength(21);expect(new Set(plan.map(p=>p.email)).size).toBe(21);
  expect(plan.every(p=>/^[a-z]+\.[a-z]+@edupilot\.edu$/.test(p.email))).toBe(true);
  expect(plan.find(p=>p.rollNo==='24MQ5A0509')).toMatchObject({email:'sandhya.lanke@edupilot.edu',userId:'u5',id:'s5'});
 });
 it("preserves edited display names and record IDs",()=>{
  const rows=records();rows[1].user.name="Client updated display name";const plan=emailPlan(identities,rows);
  expect(plan[1]).toMatchObject({id:'s1',userId:'u1',name:'Client updated display name',email:'abhinaya.borra@edupilot.edu'});
 });
 it("is idempotent",()=>{
  const rows=records();rows.forEach((s,i)=>s.user.email=identities[i].email);expect(emailPlan(identities,rows).every(p=>!p.changed)).toBe(true);
 });
 it("rejects missing records, duplicated logins and unrelated roles",()=>{
  expect(()=>emailPlan(identities,records().slice(1))).toThrow();
  expect(()=>emailPlan(identities.map((s,i)=>i===0?{...s,email:identities[1].email}:s),records())).toThrow();
  const rows=records();rows[0].user.role="ADMIN";expect(()=>emailPlan(identities,rows)).toThrow();
 });
 it("stops rather than overwriting a custom email without review",()=>{
  const rows=records();rows[0].user.email="custom@example.org";expect(()=>emailPlan(identities,rows)).toThrow(/custom login/);
 });
});
