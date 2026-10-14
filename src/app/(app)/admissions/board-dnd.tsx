"use client";

import { useRef, useTransition, type DragEvent, type ReactNode } from "react";
import { moveEnquiry } from "@/actions/campus";
import { useToast } from "@/components/toast";

const LABEL: Record<string, string> = { ENQUIRY: "Enquiry", APPLIED: "Applied", DOCUMENTS: "Documents verified", ADMITTED: "Admitted" };

/**
 * Makes the admissions board draggable: a card (data-enquiry) can be dropped on any column
 * (data-drop-stage). The buttons on each card still work, and are the way to do it on a touch screen.
 */
export function BoardDnD({ children }: { children: ReactNode }) {
  const dragging = useRef<{ id: string; from: string; name: string } | null>(null);
  const [pending, start] = useTransition();
  const { toast } = useToast();
  const column = (e: DragEvent) => (e.target as HTMLElement).closest<HTMLElement>("[data-drop-stage]");
  const clear = (root: HTMLElement) => root.querySelectorAll("[data-drop-over]").forEach((c) => c.removeAttribute("data-drop-over"));

  return (
    <div
      aria-busy={pending}
      className={pending ? "opacity-70 transition" : "transition"}
      onDragStart={(e) => {
        const card = (e.target as HTMLElement).closest<HTMLElement>("[data-enquiry]");
        if (!card) return;
        dragging.current = { id: card.dataset.enquiry!, from: card.dataset.stage!, name: card.dataset.name ?? "" };
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", card.dataset.enquiry!);
      }}
      onDragOver={(e) => {
        const col = column(e);
        if (!dragging.current || !col || col.dataset.dropStage === dragging.current.from) return;
        e.preventDefault();
        if (!col.hasAttribute("data-drop-over")) { clear(e.currentTarget); col.setAttribute("data-drop-over", ""); }
      }}
      onDragEnd={(e) => { clear(e.currentTarget); dragging.current = null; }}
      onDrop={(e) => {
        const col = column(e), d = dragging.current;
        clear(e.currentTarget);
        dragging.current = null;
        if (!d || !col || col.dataset.dropStage === d.from) return;
        e.preventDefault();
        const stage = col.dataset.dropStage!;
        const fd = new FormData();
        fd.set("id", d.id); fd.set("stage", stage);
        start(async () => {
          const r = await moveEnquiry({}, fd);
          toast(r.ok ? { message: `${d.name} moved to ${LABEL[stage] ?? stage}.`, tone: "success" } : { message: r.error ?? "Could not move the card.", tone: "error" });
        });
      }}
    >
      {children}
    </div>
  );
}
