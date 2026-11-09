// Preserve student identities and academic links; move the demo sign-in to its owner.
import { createRequire } from "node:module";
import { loadEnvFile } from "node:process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
try { loadEnvFile('.env'); } catch {}
const { PrismaClient } = createRequire(resolve('package.json'))('@prisma/client');
const db = new PrismaClient();
const identities=JSON.parse(readFileSync(new URL('../college-data.json',import.meta.url),'utf8')).students;
const ownerEmail=identities.find(s=>s.rollNo==='24MQ5A0509').email;
try {
 const result = await db.$transaction(async tx => {
  const target = await tx.student.findUniqueOrThrow({where:{rollNo:'24MQ5A0509'},include:{user:true}});
  if(target.user.role !== 'STUDENT')throw Error('Owner mismatch');
  if(target.user.email===ownerEmail)return {mode:'already-current',name:target.user.name,rollNo:target.rollNo};
  const current = await tx.user.findUniqueOrThrow({where:{email:'student@edupilot.edu'},include:{student:true}});
  if(current.id!==target.userId && (current.student?.rollNo!=='23MQ1A05B5' || current.passwordHash!==target.user.passwordHash))throw Error('Default account changed; review before proceeding');
  const email = identities.find(s=>s.rollNo===current.student.rollNo)?.email;
  if(!email)throw Error('Unknown previous default identity');
  const collision=await tx.user.findUnique({where:{email}});
  if(collision&&collision.id!==target.userId&&collision.id!==current.id)throw Error('Email conflict');
  const parent=await tx.user.findUnique({where:{email:'parent@edupilot.edu'},include:{children:true}});
  if(!process.argv.includes('--apply'))return {mode:'dry-run',name:target.user.name,rollNo:target.rollNo,academicRecordsPreserved:true};
  const folder=process.env.STUDENT_SYNC_BACKUP_DIR;
  if(!folder)throw Error('Specify a verified backup directory');
  mkdirSync(folder,{recursive:true,mode:0o700});
  writeFileSync(join(folder,'default-student.before.json'),JSON.stringify({previous:{id:current.id,email:current.email},owner:{id:target.userId,email:target.user.email},parent:parent?{id:parent.id,children:parent.children}:null},null,2),{mode:0o600,flag:'wx'});
  if(current.id!==target.userId)await tx.user.update({where:{id:current.id},data:{email}});
  await tx.user.update({where:{id:target.userId},data:{email:ownerEmail}});
  if(parent){
   await tx.parentLink.upsert({where:{userId_studentId:{userId:parent.id,studentId:target.id}},create:{userId:parent.id,studentId:target.id},update:{}});
   if(current.id!==target.userId)await tx.parentLink.deleteMany({where:{userId:parent.id,studentId:current.student.id}});
  }
  await tx.auditLog.create({data:{action:'DEFAULT_STUDENT_UPDATED',entity:'Student',entityId:target.id,details:'Demo sign-in now belongs to LANKE SANDHYA. Student IDs, passwords and academic records preserved.'}});
  return {mode:'applied',name:target.user.name,rollNo:target.rollNo,academicRecordsPreserved:true,emailsSent:0};
 },{timeout:30000});
 console.log(JSON.stringify(result,null,2));
} catch {console.error('Default-student update stopped; no partial transaction committed. Check account mapping and verified backup directory.');process.exitCode=1;}
finally{await db.$disconnect();}
