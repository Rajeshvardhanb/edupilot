import { requireUser, isLearner } from "@/lib/auth";
import { EmptyState } from "@/components/ui-server";
import { AdminDashboard } from "./admin";
import { FacultyDashboard } from "./faculty";
import { StudentDashboard } from "./student";
import { AccountsDashboard } from "./accounts";
import { OfficeDashboard } from "./office";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const user = await requireUser();
  const { denied } = await props.searchParams;
  return (
    <>
      {denied && (
        <div className="mb-4 rounded-lg bg-warning-soft px-4 py-2 text-sm text-warning">You don&apos;t have access to that page.</div>
      )}
      {user.role === "PARENT" && !user.studentId ? <EmptyState title="No student is linked to this account yet">Please ask the college office to link your child&apos;s record.</EmptyState> :
        isLearner(user) ? <StudentDashboard user={user} /> :
        user.role === "FACULTY" ? <FacultyDashboard user={user} /> :
        user.role === "ACCOUNTANT" ? <AccountsDashboard user={user} /> :
        user.role === "OFFICE" ? <OfficeDashboard user={user} /> :
        <AdminDashboard user={user} searchParams={await props.searchParams} />}
    </>
  );
}
