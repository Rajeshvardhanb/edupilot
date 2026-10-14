import "server-only";
import { cloneElement, Fragment, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { getT } from "@/lib/i18n-server";
import * as ui from "./ui";

/**
 * The same building blocks as ./ui, but any plain-text title, label or heading is shown in the
 * signed-in person's language when the dictionary has it. Server Components use these;
 * Client Components keep using ./ui (they cannot read the language cookie).
 */
const tr = async (v: ReactNode) => (typeof v === "string" ? (await getT())(v) : v);

export async function PageHeader(p: ComponentProps<typeof ui.PageHeader>) {
  return <ui.PageHeader {...p} title={(await getT())(p.title)} subtitle={await tr(p.subtitle)} eyebrow={p.eyebrow ? (await getT())(p.eyebrow) : undefined} />;
}
export async function StatCard(p: ComponentProps<typeof ui.StatCard>) {
  return <ui.StatCard {...p} label={(await getT())(p.label)} hint={await tr(p.hint)} />;
}
export async function Card(p: ComponentProps<typeof ui.Card>) {
  return <ui.Card {...p} title={await tr(p.title)} />;
}
export async function Th(p: ComponentProps<typeof ui.Th>) {
  return <ui.Th {...p}>{await tr(p.children)}</ui.Th>;
}
export async function EmptyState(p: ComponentProps<typeof ui.EmptyState>) {
  return <ui.EmptyState {...p} title={(await getT())(p.title)} />;
}
export async function Tabs(p: ComponentProps<typeof ui.Tabs>) {
  const t = await getT();
  return <ui.Tabs {...p} items={p.items.map((i) => ({ ...i, label: t(i.label) }))} />;
}

type El = ReactElement<{ children?: ReactNode; colSpan?: number }>;
/** Children as a flat list of elements: arrays and fragments opened up, empty values dropped. */
function flat(node: ReactNode): El[] {
  if (Array.isArray(node)) return node.flatMap(flat);
  if (!isValidElement(node)) return [];
  const el = node as El;
  return el.type === Fragment ? flat(el.props.children) : [el];
}
const textOf = (node: ReactNode): string => (typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node) ? node.map(textOf).join("") : "");

/**
 * A table that turns into a list of cards on a phone. Each body cell is given its column heading
 * (data-label), which the phone layout in globals.css prints in front of the value. Done here on the
 * server, so nothing changes in the page after it loads. Keys are positional: after flattening, the
 * keys the page gave its rows are no longer guaranteed unique.
 */
export async function Table({ children, stack = true }: ComponentProps<typeof ui.Table>) {
  if (!stack) return <ui.Table stack={false}>{children}</ui.Table>;
  const t = await getT();
  const sections = flat(children);
  const headRow = flat(sections.find((s) => s.type === "thead")?.props.children)[0];
  const heads = headRow ? flat(headRow.props.children).flatMap((th) => Array.from({ length: th.props.colSpan ?? 1 }, () => t(textOf(th.props.children).trim()))) : [];
  if (!heads.some(Boolean)) return <ui.Table>{children}</ui.Table>;
  const labelled = sections.map((section, i) => {
    if (section.type !== "tbody" && section.type !== "tfoot") return cloneElement(section, { key: `s${i}` });
    const rows = flat(section.props.children).map((row, r) => {
      if (row.type !== "tr") return cloneElement(row, { key: `r${r}` });
      let col = 0;
      const cells = flat(row.props.children).map((cell, c) => {
        const span = cell.props.colSpan ?? 1, label = span === 1 ? heads[col] : "";
        col += span;
        return cloneElement(cell as ReactElement<Record<string, unknown>>, { key: `c${c}`, ...(label && { "data-label": label }) });
      });
      return cloneElement(row, { key: `r${r}` }, cells);
    });
    return cloneElement(section, { key: `s${i}` }, rows);
  });
  return <ui.Table>{labelled}</ui.Table>;
}
