// Update existing supplied students' login emails only. No seeding or password reset.
import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @param {{rollNo:string,name:string,email:string}[]} identities
 * @param {{id:string,userId:string,rollNo:string,user:{name:string,email:string,role:string}}[]} records
 */
export function emailPlan(identities, records) {
 if(identities.length!==21||new Set(identities.map(s=>s.rollNo)).size!==21||new Set(identities.map(s=>s.email)).size!==21)
  throw Error('Expected 21 unique supplied identities and usernames.');
 return identities.map(identity=>{
  if(!/^[a-z]+\.[a-z]+@edupilot\.edu$/.test(identity.email))throw Error('Invalid first.last username.');
  const matches=records.filter(s=>s.rollNo===identity.rollNo);
  if(matches.length!==1||matches[0].user.role!=='STUDENT')throw Error('Missing or ambiguous student identity.');
  const s=matches[0];
  const legacy=[identity.email,`${identity.rollNo.toLowerCase()}@student.edupilot.edu`,...(identity.rollNo==='24MQ5A0509'?['student@edupilot.edu']:[])];
  if(!legacy.includes(s.user.email))throw Error('A student already has a custom login. Review it before updating.');
  return {id:s.id,userId:s.userId,rollNo:s.rollNo,name:s.user.name,oldEmail:s.user.email,email:identity.email,changed:s.user.email!==identity.email};
 });
}

async function main(){
 try{loadEnvFile('.env');}catch{}
 const {PrismaClient}=createRequire(resolve('package.json'))('@prisma/client');const db=new PrismaClient();
 const identities=JSON.parse(readFileSync(new URL('../college-data.json',import.meta.url),'utf8')).students;
 try{
  const result=await db.$transaction(async tx=>{
   const rows=await tx.student.findMany({where:{rollNo:{in:identities.map(s=>s.rollNo)}},include:{user:{select:{name:true,email:true,role:true,passwordHash:true,isActive:true}}}});
   const plan=emailPlan(identities,rows);const changes=plan.filter(s=>s.changed);
   for(const p of plan){const owner=await tx.user.findUnique({where:{email:p.email},select:{id:true}});if(owner&&owner.id!==p.userId)throw Error('Username collision; no changes made.');}
   const count=async()=>({students:await tx.student.count(),users:await tx.user.count(),marks:await tx.mark.count(),attendance:await tx.attendanceRecord.count(),results:await tx.subjectResult.count()});
   const before=await count();
   if(!process.argv.includes('--apply')||!changes.length)return {mode:process.argv.includes('--apply')?'already-current':'dry-run',changed:changes.length,counts:before,logins:plan.map(p=>({rollNo:p.rollNo,name:p.name,email:p.email}))};
   const folder=process.env.STUDENT_EMAIL_BACKUP_DIR||join('backups',`student-emails-${new Date().toISOString().replaceAll(':','-')}`);
   mkdirSync(folder,{recursive:true,mode:0o700});writeFileSync(join(folder,'student-emails.before.json'),JSON.stringify({before,plan},null,2),{mode:0o600,flag:'wx'});
   for(const p of changes){const change=await tx.user.updateMany({where:{id:p.userId,email:p.oldEmail},data:{email:p.email}});if(change.count!==1)throw Error('Account changed concurrently; rolling back.');}
   const userIds=changes.map(p=>p.userId);
   await tx.passwordResetToken.deleteMany({where:{userId:{in:userIds}}});
   await tx.loginCode.deleteMany({where:{userId:{in:userIds}}});
   for(const original of rows){const current=await tx.student.findUniqueOrThrow({where:{id:original.id},include:{user:true}});const expected=plan.find(p=>p.id===original.id);if(current.userId!==original.userId||current.rollNo!==original.rollNo||current.user.email!==expected.email||current.user.name!==original.user.name||current.user.passwordHash!==original.user.passwordHash||current.user.isActive!==original.user.isActive)throw Error('Account preservation check failed.');}
   const after=await count();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Academic counts changed.');
   await tx.auditLog.create({data:{action:'STUDENT_LOGIN_EMAILS_UPDATED',entity:'Student',details:`Updated ${changes.length} supplied students to firstname.lastname login IDs. Passwords, names, IDs and academic records preserved. No mail sent.`}});
   return {mode:'applied',changed:changes.length,counts:after,passwordsPreserved:true,academicRecordsPreserved:true,emailsSent:0,logins:plan.map(p=>({rollNo:p.rollNo,name:p.name,email:p.email}))};
  },{timeout:30000});console.log(JSON.stringify(result,null,2));
 }finally{await db.$disconnect();}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{console.error('Student email sync stopped; no partial transaction committed. Check mapping, collisions and backup directory securely.');process.exitCode=1;});
