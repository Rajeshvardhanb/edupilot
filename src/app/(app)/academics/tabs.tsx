import { Tabs } from "@/components/ui-server";

const ITEMS = [
  { href: "/academics", label: "Departments" },
  { href: "/academics/programs", label: "Programmes" },
  { href: "/academics/batches", label: "Batches & sections" },
  { href: "/academics/terms", label: "Academic terms" },
  { href: "/academics/subjects", label: "Subjects / curriculum" },
  { href: "/academics/allocation", label: "Course allocation" },
];

export function AcademicsTabs({ active }: { active: string }) {
  return <Tabs items={ITEMS} active={active} />;
}
