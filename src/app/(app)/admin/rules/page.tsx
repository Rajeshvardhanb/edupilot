import { requireUser } from "@/lib/auth";
import { getRules } from "@/lib/rules";
import { DEFAULT_RULES } from "@/lib/grading";
import { resetGradeScale } from "@/actions/admin";
import { ActionButton } from "@/components/forms";
import { RulesForm } from "./form";
import { Card, PageHeader, Tabs } from "@/components/ui-server";
import { ADMIN_TABS } from "../tabs";

export const metadata = { title: "Academic rules" };

/** The college's own regulations: attendance thresholds, pass marks and the grade scale. */
export default async function RulesPage() {
  await requireUser(["ADMIN"]);
  const r = await getRules();
  const custom = JSON.stringify(r.gradeScale) !== JSON.stringify(DEFAULT_RULES.gradeScale);
  return (
    <>
      <PageHeader title="Administration" subtitle="Your university's regulations: attendance, pass marks and grades" />
      <Tabs active="/admin/rules" items={ADMIN_TABS} />
      <div className="grid gap-6 lg:grid-cols-3">
        <RulesForm rules={{ ...r, gradeScale: [...r.gradeScale] }} custom={custom} />
            <div className="space-y-6">
              <Card title="What changes when you save">
                <ul className="space-y-3 text-sm text-muted">
                  <li><b className="text-fg">Straight away:</b> dashboards, the shortage report, attendance badges, reminder messages and hall-ticket eligibility.</li>
                  <li><b className="text-fg">From the next publish:</b> grades, pass or fail, SGPA and CGPA for results that are not yet published.</li>
                  <li><b className="text-fg">Not changed:</b> results already published. Republish a course to apply new rules to it.</li>
                </ul>
              </Card>
              {custom && (
                <Card title="Standard scale">
                  <p className="mb-3 text-sm text-muted">Go back to O, A+, A, B+, B, C, P, F with points 10 to 0.</p>
                  <ActionButton action={resetGradeScale} fields={{}} size="md" confirm="Replace your grade scale with the standard 10-point scale?">Reset grade scale</ActionButton>
                </Card>
              )}
            </div>
      </div>
    </>
  );
}
