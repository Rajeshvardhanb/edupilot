import { expect, test, type APIRequestContext } from "@playwright/test";
import { db, fixtures, reseed, session, confirm } from "./helpers";
test.beforeAll(async({request})=>{reseed();if(process.env.E2E_SMTP_TEST==='1')await request.delete('http://127.0.0.1:2526/messages');});
async function resultState(){return JSON.stringify(await db.subjectResult.findMany({orderBy:{id:'asc'}}));}
async function midMailCount(request:APIRequestContext){const res=await request.get('http://127.0.0.1:2526/messages');return (await res.json() as {to:string[];raw:string}[]).filter(m=>m.to.includes('sandhya.lanke@edupilot.edu')&&m.raw.includes('Subject: Your assessment marks are published')).length;}
test("Mid Term 2 can be published without final exams; students/parents see it and GPA stays unchanged",async({browser,request})=>{
 const f=await fixtures(), before=await resultState(), term=await db.term.findFirstOrThrow({where:{isCurrent:true}});
 const admin=await session(browser,'admin@edupilot.edu');await admin.goto(`/exams/${f.offeringId}`);
 const add=admin.locator('form').filter({has:admin.locator('input[name=name]')});await add.locator('[name=name]').fill('Mid Term 2');await add.locator('[name=type]').selectOption('MID_TERM');await add.locator('[name=maxMarks]').fill('30');await add.getByRole('button',{name:'Add',exact:true}).click();
 await expect(admin.getByRole('group',{name:'Mid Term 2 result release',exact:true})).toBeVisible();
 const a=await db.assessment.findFirstOrThrow({where:{offeringId:f.offeringId,name:'Mid Term 2'}});
 const release=admin.getByRole('group',{name:'Mid Term 2 result release',exact:true}).filter({has:admin.getByRole('button',{name:'Publish marks',exact:true})});await expect(release.getByRole('button',{name:'Publish marks',exact:true})).toBeDisabled();
 for(const cell of await admin.locator(`input[name^="m_${a.id}_"]`).all())await cell.fill('11');await admin.getByRole('button',{name:'Save marks',exact:true}).click();await expect(release.getByRole('button',{name:'Publish marks',exact:true})).toBeEnabled();
 expect(await db.assessment.count({where:{offeringId:f.offeringId,type:'END_SEM'}})).toBe(0);await expect(admin.getByRole('button',{name:'Publish final results',exact:true})).toBeDisabled();
 const student=await session(browser,'sandhya.lanke@edupilot.edu'),parent=await session(browser,'parent@edupilot.edu'),teacher=await session(browser,'faculty@edupilot.edu');await teacher.goto(`/exams/${f.offeringId}`);
 await student.goto('/results');await expect(student.getByRole('heading',{name:'Mid exam & internal results',exact:true})).toBeVisible();await expect(student.getByText('Mid Term 2',{exact:true})).toHaveCount(0);
 await release.getByRole('button',{name:'Publish marks',exact:true}).click();await confirm(admin);await expect.poll(async()=>(await db.assessment.findUniqueOrThrow({where:{id:a.id}})).publishedAt).not.toBeNull();
 for(const p of [student,parent]){await p.goto('/results');const card=p.locator('section').filter({has:p.getByRole('heading',{name:'Mid exam & internal results',exact:true})});await expect(card.getByRole('row').filter({hasText:'Mid Term 2'})).toContainText('11 / 30');await expect(card.getByText('Mid Term 1',{exact:true})).toHaveCount(0);}
 expect(await resultState()).toBe(before);expect((await db.courseOffering.findUniqueOrThrow({where:{id:f.offeringId}})).resultsPublished).toBe(false);expect((await db.term.findUniqueOrThrow({where:{id:term.id}})).isCurrent).toBe(true);
 if(process.env.E2E_SMTP_TEST==='1')await expect.poll(()=>midMailCount(request)).toBe(1);
 await student.goto('/notifications');await expect(student.getByRole('heading',{name:'Your assessment marks are published',exact:true}).first()).toBeVisible();
 // The teacher loaded the editor before publication. Its stale form must not overwrite released marks.
 await teacher.locator(`input[name="m_${a.id}_${f.studentId}"]`).fill('29');await teacher.getByRole('button',{name:'Save marks',exact:true}).click();await expect(teacher.getByText(/published and locked/)).toBeVisible();expect((await db.mark.findUniqueOrThrow({where:{assessmentId_studentId:{assessmentId:a.id,studentId:f.studentId}}})).marks).toBe(11);
 await teacher.reload();await expect(teacher.locator(`input[name="m_${a.id}_${f.studentId}"]`)).toBeDisabled();await expect(teacher.getByRole('button',{name:'Publish marks',exact:true})).toHaveCount(0);
 await admin.reload();const withdrawn=admin.getByRole('group',{name:'Mid Term 2 result release',exact:true}).filter({has:admin.getByRole('button',{name:'Withdraw marks',exact:true})});await withdrawn.getByRole('button',{name:'Withdraw marks',exact:true}).click();await confirm(admin);await expect.poll(async()=>(await db.assessment.findUniqueOrThrow({where:{id:a.id}})).publishedAt).toBeNull();await student.goto('/results');await expect(student.getByText('Mid Term 2',{exact:true})).toHaveCount(0);
 await teacher.reload();await teacher.locator(`input[name="m_${a.id}_${f.studentId}"]`).fill('12');await teacher.getByRole('button',{name:'Save marks',exact:true}).click();await expect.poll(async()=>(await db.mark.findUniqueOrThrow({where:{assessmentId_studentId:{assessmentId:a.id,studentId:f.studentId}}})).marks).toBe(12);
 await admin.reload();await admin.getByRole('group',{name:'Mid Term 2 result release',exact:true}).getByRole('button',{name:'Publish marks',exact:true}).click();await confirm(admin);await expect.poll(async()=>(await db.assessment.findUniqueOrThrow({where:{id:a.id}})).publishedAt).not.toBeNull();if(process.env.E2E_SMTP_TEST==='1')await expect.poll(()=>midMailCount(request)).toBe(2);
 expect(await resultState()).toBe(before);for(const p of [admin,student,parent,teacher])await p.context().close();
});
test("HOD can release a complete mid exam even with another incomplete assessment",async({browser})=>{
 const f=await fixtures(), before=await resultState(), quiz=await db.assessment.create({data:{offeringId:f.offeringId,name:'Incomplete quiz fixture',type:'QUIZ',maxMarks:10}});
 const mid=await db.assessment.findFirstOrThrow({where:{offeringId:f.offeringId,name:'Mid Term 1'}}),hod=await session(browser,'hod.cse@edupilot.edu');await hod.goto(`/exams/${f.offeringId}`);
 const row=hod.getByRole('group',{name:'Mid Term 1 result release',exact:true}).filter({has:hod.getByRole('button',{name:'Publish marks',exact:true})});await expect(row.getByRole('button',{name:'Publish marks',exact:true})).toBeEnabled();await row.getByRole('button',{name:'Publish marks',exact:true}).click();await confirm(hod);await expect.poll(async()=>(await db.assessment.findUniqueOrThrow({where:{id:mid.id}})).publishedAt).not.toBeNull();
 expect((await db.assessment.findUniqueOrThrow({where:{id:quiz.id}})).publishedAt).toBeNull();expect(await db.mark.count({where:{assessmentId:quiz.id}})).toBe(0);expect(await resultState()).toBe(before);await hod.context().close();
});
