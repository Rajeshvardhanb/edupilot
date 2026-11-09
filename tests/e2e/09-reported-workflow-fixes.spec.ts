import { expect, test } from "@playwright/test";
import { db, fixtures, reseed, session, confirm } from "./helpers";
test.beforeAll(() => reseed());

test("marks entry lists enrolled courses and always explains result publication", async ({ browser }) => {
 const f=await fixtures(), admin=await session(browser,"admin@edupilot.edu");
 await admin.goto("/exams");await expect(admin.getByRole("heading",{name:"Marks entry",exact:true})).toBeVisible();
 const rows=admin.locator("tbody tr");expect(await rows.count()).toBeGreaterThan(0);
 for(const row of await rows.all()) expect(Number(await row.locator("td").nth(3).textContent())).toBeGreaterThan(0);
 await admin.getByRole("combobox",{name:"Batch",exact:true}).selectOption(f.batchId);
 await expect(admin.getByRole("link",{name:"Enter marks →",exact:true}).first()).toBeVisible();
 await db.assessment.deleteMany({where:{offeringId:f.offeringId}});
 await admin.goto(`/exams/${f.offeringId}`);
 const grid=admin.getByRole("region",{name:"Marks",exact:true});await expect(grid.getByText("LANKE SANDHYA",{exact:true})).toBeVisible();
 await expect(admin.getByRole("button",{name:"Publish final results",exact:true})).toBeDisabled();
 await expect(admin.getByText(/Add an assessment above to create marks columns/)).toBeVisible();
 const assessment=admin.locator("form").filter({has:admin.locator('input[name=name]')});
 await assessment.locator('[name=name]').fill("End semester workflow test");await assessment.locator('[name=type]').selectOption("END_SEM");await assessment.locator('[name=maxMarks]').fill("60");await assessment.getByRole("button",{name:"Add",exact:true}).click();
 await expect(grid.locator('input[name^="m_"]').first()).toBeVisible();await expect(admin.getByRole("button",{name:"Publish final results",exact:true})).toBeDisabled();
 for(const cell of await grid.locator('input[name^="m_"]').all())await cell.fill("50");
 await admin.getByRole("button",{name:"Save marks",exact:true}).click();await expect(admin.getByRole("button",{name:"Publish final results",exact:true})).toBeEnabled();
 await admin.getByRole("button",{name:"Publish final results",exact:true}).click();await confirm(admin);await expect.poll(async()=>(await db.courseOffering.findUniqueOrThrow({where:{id:f.offeringId}})).resultsPublished).toBe(true);
 const teacher=await session(browser,"faculty@edupilot.edu");await teacher.goto(`/exams/${f.offeringId}`);await expect(teacher.getByRole("button",{name:"Publish final results",exact:true})).toHaveCount(0);
 await teacher.context().close();await admin.context().close();
});

test("old notifications have no broken links and retained updates open their current section", async({browser})=>{
 const owner=await db.user.findUniqueOrThrow({where:{email:"admin@edupilot.edu"}});
 await db.notification.createMany({data:[{userId:owner.id,title:"Legacy fee update test",href:"/fees"},{userId:owner.id,title:"Old leave deep link test",href:"/leave/deleted-request"}]});
 const admin=await session(browser,"admin@edupilot.edu");await admin.goto("/notifications");
 const legacy=admin.locator("section").filter({has:admin.getByRole("heading",{name:"Legacy fee update test",exact:true})});
 await expect(legacy.getByRole("link",{name:"View details",exact:true})).toHaveCount(0);await expect(legacy.getByText("This older update has no available screen.",{exact:true})).toBeVisible();
 const retained=admin.locator("section").filter({has:admin.getByRole("heading",{name:"Old leave deep link test",exact:true})});
 await retained.getByRole("link",{name:"View details",exact:true}).click();await expect(admin).toHaveURL(/\/leave$/);await expect(admin.getByRole("heading",{name:"Not found",exact:true})).toHaveCount(0);
 await admin.context().close();
});

test("permanent deletion removes owned data, preserves other users and permits the same email and roll", async({browser})=>{
 const f=await fixtures(), owner=await db.student.findUniqueOrThrow({where:{id:f.studentId},include:{user:true}}), email="reuse-deleted@example.invalid";
 const user=await db.user.create({data:{name:"Delete Reuse Test",email,role:"STUDENT",passwordHash:owner.user.passwordHash,student:{create:{rollNo:"REUSE2026",batchId:f.batchId,admissionDate:new Date("2026-08-01")}}},include:{student:true}}), sid=user.student!.id;
 const assessment=await db.assessment.findFirstOrThrow({where:{offeringId:f.offeringId}}), att=await db.attendanceSession.findFirstOrThrow({where:{offeringId:f.offeringId}});
 await db.mark.create({data:{assessmentId:assessment.id,studentId:sid,marks:5}});await db.attendanceRecord.create({data:{sessionId:att.id,studentId:sid,status:"PRESENT"}});
 await db.subjectResult.create({data:{studentId:sid,offeringId:f.offeringId,internal:1,external:1,total:2,grade:"F",gradePoint:0,credits:3,passed:false}});
 const parent=await db.user.findUniqueOrThrow({where:{email:"parent@edupilot.edu"}});await db.parentLink.create({data:{studentId:sid,userId:parent.id}});
 const invoice=await db.feeInvoice.create({data:{studentId:sid,invoiceNo:"DELETE-TEST-INV",title:"Legacy deletion fixture",amount:100,dueDate:new Date("2026-10-01")}});
 const pay=await db.payment.create({data:{invoiceId:invoice.id,receiptNo:"DELETE-PAY",amount:100,mode:"CASH"}});await db.payment.create({data:{invoiceId:invoice.id,receiptNo:"DELETE-REFUND",amount:-25,mode:"CASH",refundOfId:pay.id}});
 await db.accountSetupToken.create({data:{userId:user.id,tokenHash:"deletion-fixture-token",expiresAt:new Date(Date.now()+3600000)}});
 const oldSession=await session(browser,email), admin=await session(browser,"admin@edupilot.edu");await admin.goto("/students?q=REUSE2026");await admin.getByRole("button",{name:"Delete",exact:true}).filter({visible:true}).first().click();await expect(admin.getByRole("alertdialog")).toContainText("permanently removes");await confirm(admin);
 await expect.poll(()=>db.user.findUnique({where:{id:user.id}})).toBeNull();expect(await db.student.findUnique({where:{id:sid}})).toBeNull();expect(await db.mark.count({where:{studentId:sid}})).toBe(0);expect(await db.attendanceRecord.count({where:{studentId:sid}})).toBe(0);expect(await db.subjectResult.count({where:{studentId:sid}})).toBe(0);expect(await db.feeInvoice.count({where:{id:invoice.id}})).toBe(0);expect(await db.payment.count({where:{invoiceId:invoice.id}})).toBe(0);expect(await db.accountSetupToken.count({where:{userId:user.id}})).toBe(0);
 expect(await db.user.findUnique({where:{id:parent.id}})).not.toBeNull();expect(await db.parentLink.findUnique({where:{userId_studentId:{userId:parent.id,studentId:f.studentId}}})).not.toBeNull();
 await oldSession.goto("/profile");await expect(oldSession).toHaveURL(/login|session\/expired/);
 await admin.goto("/students/new");await admin.locator('[name=name]').fill("Re-registered Student");await admin.locator('[name=email]').fill(email);await admin.locator('[name=rollNo]').fill("REUSE2026");await admin.locator('[name=batchId]').selectOption(f.batchId);await admin.getByRole("button",{name:"Admit student",exact:true}).click();await expect(admin).toHaveURL(/created=1/);
 const fresh=await db.user.findUniqueOrThrow({where:{email},include:{student:true}});expect(fresh.id).not.toBe(user.id);expect(fresh.student!.id).not.toBe(sid);expect(fresh.mustChangePassword).toBe(true);expect(await db.mark.count({where:{studentId:fresh.student!.id}})).toBe(0);
 await admin.context().close();await oldSession.context().close();
});

test("re-registering an archived identity is atomic and never replaces an active identity", async({browser})=>{
 const f=await fixtures(), source=await db.user.findUniqueOrThrow({where:{email:"sandhya.lanke@edupilot.edu"}}), email="legacy-archived@example.invalid";
 const archived=await db.user.create({data:{name:"Previously Deleted Student",email,role:"STUDENT",passwordHash:source.passwordHash,isActive:false,student:{create:{rollNo:"ARCHIVED2026",batchId:f.batchId,admissionDate:new Date("2026-08-01"),archivedAt:new Date()}}},include:{student:true}});
 const admin=await session(browser,"admin@edupilot.edu");await admin.goto("/students/new");await admin.locator('[name=name]').fill("Fresh Archived Replacement");await admin.locator('[name=email]').fill(email);await admin.locator('[name=rollNo]').fill("ARCHIVED2026");await admin.locator('[name=batchId]').evaluate(el=>{const option=new Option("Invalid batch fixture","missing-batch");el.append(option);(el as HTMLSelectElement).value="missing-batch";});
 await admin.getByRole("button",{name:"Admit student",exact:true}).click();await expect(admin.getByText("Could not save the student.",{exact:true})).toBeVisible();expect(await db.user.findUnique({where:{id:archived.id}})).not.toBeNull();
 await admin.locator('[name=batchId]').selectOption(f.batchId);await admin.getByRole("button",{name:"Admit student",exact:true}).click();await expect(admin).toHaveURL(/created=1/);expect(await db.user.findUnique({where:{id:archived.id}})).toBeNull();const replacement=await db.user.findUniqueOrThrow({where:{email}});expect(replacement.id).not.toBe(archived.id);
 await admin.goto("/students/new");await admin.locator('[name=name]').fill("Active Email Collision");await admin.locator('[name=email]').fill(email);await admin.locator('[name=rollNo]').fill("COLLISION2026");await admin.locator('[name=batchId]').selectOption(f.batchId);await admin.getByRole("button",{name:"Admit student",exact:true}).click();await expect(admin.getByText("This email is already registered",{exact:true})).toBeVisible();expect((await db.user.findUniqueOrThrow({where:{email}})).id).toBe(replacement.id);
 await admin.context().close();
});
