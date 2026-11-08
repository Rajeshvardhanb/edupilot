// Preserve student identities and academic links; move the demo sign-in to its owner.
import { createRequire } from "node:module";
import { loadEnvFile } from "node:process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
try { loadEnvFile('.env'); } catch {}
const { PrismaClient } = createRequire(resolve('package.json'))('@prisma/client');
const db = new PrismaClient();
try {
 const result = await db.$transaction(async tx => {
  const target = await tx.student.findUniqueOrThrow({where:{rollNo:'24MQ5A0509'},include:{user:true}});
  if(target.user.name !== 'LANKE SANDHYA' || target.user.role !== 'STUDENT')throw Error('Owner mismatch');
  const current = await tx.user.findUniqueOrThrow({where:{email:'student@edupilot.edu'},include:{student:true}});
  if(current.id===target.userId)return {mode:'already-current',name:target.user.name,rollNo:target.rollNo};
  if(current.student?.rollNo!=='23MQ1A05B5' || current.passwordHash!==target.user.passwordHash)throw Error('Default account changed; review before proceeding');
  const email = current.student.rollNo.toLowerCase()+'@student.edupilot.edu';
  if(await tx.user.findUnique({where:{email}}))throw Error('Email conflict');
  const parent=await tx.user.findUnique({where:{email:'parent@edupilot.edu'},include:{children:true}});
  if(!process.argv.includes('--apply'))return {mode:'dry-run',name:target.user.name,rollNo:target.rollNo,academicRecordsPreserved:true};
  const folder=process.env.STUDENT_SYNC_BACKUP_DIR;
  if(!folder)throw Error('Specify a verified backup directory');
  mkdirSync(folder,{recursive:true,mode:0o700});
  writeFileSync(join(folder,'default-student.before.json'),JSON.stringify({previous:{id:current.id,email:current.email},owner:{id:target.userId,email:target.user.email},parent:parent?{id:parent.id,children:parent.children}:null},null,2),{mode:0o600,flag:'wx'});
  await tx.user.update({where:{id:current.id},data:{email}});
  await tx.user.update({where:{id:target.userId},data:{email:'student@edupilot.edu'}});
  if(parent){
   await tx.parentLink.upsert({where:{userId_studentId:{userId:parent.id,studentId:target.id}},create:{userId:parent.id,studentId:target.id},update:{}});
   await tx.parentLink.deleteMany({where:{userId:parent.id,studentId:current.student.id}});
  }
  await tx.auditLog.create({data:{action:'DEFAULT_STUDENT_UPDATED',entity:'Student',entityId:target.id,details:'Demo sign-in now belongs to LANKE SANDHYA. Student IDs, passwords and academic records preserved.'}});
  return {mode:'applied',name:target.user.name,rollNo:target.rollNo,academicRecordsPreserved:true,emailsSent:0};
 },{timeout:30000});
 console.log(JSON.stringify(result,null,2));
} catch {console.error('Default-student update stopped; no partial transaction committed. Check account mapping and verified backup directory.');process.exitCode=1;}
finally{await db.$disconnect();}
