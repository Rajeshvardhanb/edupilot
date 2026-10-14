"use client";

import { MessageCircle } from "lucide-react";
import { logParentContact } from "@/actions/contacts";

/**
 * Opens WhatsApp with a pre-written message to this number. Renders nothing without a usable link.
 * With `log`, pressing it also records the reminder in that student's parent contact log.
 */
export function WhatsAppButton({ href, text, label = "WhatsApp", log }: {
  /** wa.me link built on the server with waLink(). */
  href: string | null; text: string; label?: string;
  log?: { studentId: string; purpose: "ATTENDANCE" | "FEES" | "RESULTS" | "CONDUCT" | "GENERAL" };
}) {
  if (!href) return null;
  function record() {
    if (!log) return;
    const fd = new FormData();
    fd.set("studentId", log.studentId); fd.set("channel", "WHATSAPP"); fd.set("purpose", log.purpose); fd.set("message", text);
    void logParentContact({}, fd).catch(() => {});
  }
  return (
    <a href={href} onClick={record} target="_blank" rel="noopener noreferrer" title="Opens WhatsApp with this message ready to send" className="no-print inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1 text-xs font-medium text-success hover:bg-success-soft">
      <MessageCircle className="size-3.5" /> {label}
    </a>
  );
}
