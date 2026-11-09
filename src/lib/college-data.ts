// Server/maintenance imports only. Pass only demo emails to the client login form.
import data from "../../college-data.json";
import { collegeDataSchema } from "./college-data-schema";

export const COLLEGE_DATA = collegeDataSchema.parse(data);

export function demoLoginEmails() {
  const { demoLogins: demo, accounts, faculty, students } = COLLEGE_DATA;
  const account = (key: string) => accounts.find(a => a.key === key)!.email;
  return {
    admin: account(demo.adminAccountKey),
    hod: faculty.find(f => f.employeeId === demo.hodEmployeeId)!.email,
    faculty: faculty.find(f => f.employeeId === demo.facultyEmployeeId)!.email,
    accounts: account(demo.accountsAccountKey), office: account(demo.officeAccountKey),
    student: students.find(s => s.rollNo === demo.studentRollNo)!.email,
    parent: account(demo.parentAccountKey),
  };
}
