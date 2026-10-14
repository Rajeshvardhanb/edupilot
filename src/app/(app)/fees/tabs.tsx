import { Tabs } from "@/components/ui-server";

export function FeeTabs({ active }: { active: string }) {
  return <Tabs active={active} items={[{ href: "/fees", label: "Invoices & dues" }, { href: "/fees/payments", label: "Payment ledger" }, { href: "/fees/closing", label: "Day closing" }, { href: "/fees/structures", label: "Fee structures" }]} />;
}
