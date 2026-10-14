"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useToast } from "./toast";

const KEY = "edupilot-attendance-queue";
export type QueuedAttendance = { offeringId: string; date: string; period: number; topic: string; marks: Record<string, string>; label: string };

export function queueAttendance(item: QueuedAttendance) {
  const q: QueuedAttendance[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  // Latest entry wins for the same class.
  const rest = q.filter((x) => !(x.offeringId === item.offeringId && x.date === item.date && x.period === item.period));
  localStorage.setItem(KEY, JSON.stringify([...rest, item]));
  window.dispatchEvent(new Event("edupilot:queue"));
}

// One upload at a time: page load and the "online" event can both trigger a flush.
let flushing = false;

/** Registers the service worker (production) and uploads attendance saved while offline. */
export function OfflineSync() {
  const { toast } = useToast();
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const count = () => { try { setPending(JSON.parse(localStorage.getItem(KEY) ?? "[]").length); } catch {} };
    async function flush() {
      setOffline(!navigator.onLine);
      count();
      if (!navigator.onLine || flushing) return;
      flushing = true;
      try { await upload(); } finally { flushing = false; }
    }
    async function upload() {
      let q: QueuedAttendance[] = [];
      try { q = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch {}
      if (!q.length) return;
      const left: QueuedAttendance[] = [];
      for (const item of q) {
        try {
          const r = await fetch("/attendance/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
          const j = await r.json();
          if (r.ok && j.ok) toast({ message: `Synced offline attendance · ${item.label}`, tone: "success" });
          else if (r.status >= 500 || r.status === 401) left.push(item);
          else toast({ message: `Could not sync ${item.label}: ${j.error ?? "rejected"}`, tone: "error" }, 8000);
        } catch { left.push(item); }
      }
      localStorage.setItem(KEY, JSON.stringify(left));
      count();
    }
    flush();
    window.addEventListener("online", flush);
    window.addEventListener("offline", flush);
    window.addEventListener("edupilot:queue", count);
    return () => { window.removeEventListener("online", flush); window.removeEventListener("offline", flush); window.removeEventListener("edupilot:queue", count); };
  }, [toast]);

  if (!offline && !pending) return null;
  return (
    <div className="no-print fixed top-20 left-1/2 z-[65] flex -translate-x-1/2 items-center gap-2 rounded-full border border-warning/40 bg-warning-soft px-4 py-1.5 text-xs font-medium text-warning shadow-lift">
      <WifiOff className="size-3.5" />
      {offline ? "You're offline" : "Syncing"}{pending > 0 && ` · ${pending} attendance sheet${pending > 1 ? "s" : ""} waiting to upload`}
    </div>
  );
}
