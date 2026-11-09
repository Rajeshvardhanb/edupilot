import { z } from "zod";

const text = z.string().trim().min(1).max(255);
const email = z.email().toLowerCase();
const optionalText = z.string().trim().max(1000).nullable().optional();

export const collegeDataSchema = z.object({
  schemaVersion: z.literal(1),
  instructions: z.array(z.string()),
  sources: z.object({ cseFaculty: z.url(), governingBody: z.url(), checkedOn: text }).strict(),
  college: z.object({
    name: text, shortName: text, tagline: text, affiliation: text, address: text,
    phone: text, email, principalName: text, brandColor: z.string().regex(/^#[\da-f]{6}$/i),
  }).strict(),
  departments: z.array(z.object({
    code: text, name: text,
    // null means leave an existing head assignment alone (unverified departments).
    hodEmployeeId: text.nullable(),
  }).strict()).min(1),
  accounts: z.array(z.object({
    key: text, matchEmail: email, email, name: text,
    role: z.enum(["ADMIN", "ACCOUNTANT", "OFFICE", "PARENT"]),
    phone: optionalText,
  }).strict()),
  demoLogins: z.object({
    adminAccountKey: text, accountsAccountKey: text, officeAccountKey: text,
    parentAccountKey: text, hodEmployeeId: text, facultyEmployeeId: text, studentRollNo: text,
  }).strict(),
  faculty: z.array(z.object({
    employeeId: text, name: text, email, departmentCode: text,
    qualification: text, designation: text, phone: optionalText,
  }).strict()),
  students: z.array(z.object({
    rollNo: text, name: text, email, phone: optionalText,
    address: optionalText, guardianName: optionalText, guardianPhone: optionalText,
    guardianEmail: email.nullable().optional(),
  }).strict()).min(1),
}).strict().superRefine((data, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  const unique = (values: string[], label: string) => {
    if (new Set(values.map(v => v.toLowerCase())).size !== values.length) fail(`Duplicate ${label}.`);
  };
  unique(data.departments.map(d => d.code), "department code");
  unique(data.faculty.map(f => f.employeeId), "faculty employee ID");
  unique(data.students.map(s => s.rollNo), "student roll number");
  unique(data.accounts.map(a => a.key), "account key");
  unique(data.accounts.map(a => a.matchEmail), "account matching email");
  unique([...data.accounts, ...data.faculty, ...data.students].map(u => u.email), "login email");
  for (const f of data.faculty) {
    if (!data.departments.some(d => d.code === f.departmentCode)) fail(`Unknown department for ${f.employeeId}.`);
  }
  for (const d of data.departments) {
    if (d.hodEmployeeId && !data.faculty.some(f => f.employeeId === d.hodEmployeeId && f.departmentCode === d.code))
      fail(`HOD for ${d.code} must be a faculty member of that department.`);
  }
  const demo = data.demoLogins;
  for (const [key, role] of [[demo.adminAccountKey, "ADMIN"], [demo.accountsAccountKey, "ACCOUNTANT"],
    [demo.officeAccountKey, "OFFICE"], [demo.parentAccountKey, "PARENT"]]) {
    if (!data.accounts.some(a => a.key === key && a.role === role)) fail(`Invalid demo account reference: ${key}.`);
  }
  if (!data.departments.some(d => d.hodEmployeeId === demo.hodEmployeeId)) fail("Demo HOD must head a department.");
  if (!data.faculty.some(f => f.employeeId === demo.facultyEmployeeId)) fail("Demo faculty reference is missing.");
  if (!data.students.some(s => s.rollNo === demo.studentRollNo)) fail("Default demo student reference is missing.");
});

export type CollegeData = z.infer<typeof collegeDataSchema>;
