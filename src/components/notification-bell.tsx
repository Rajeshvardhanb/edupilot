"use client";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
export function NotificationBell() {
  const [unread, setUnread] = useState(0), pathname = usePathname();
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try { const response = await fetch("/api/notifications/count", { cache: "no-store", signal: controller.signal }); if (response.ok) { const data = await response.json(); setUnread(Number(data.unread) || 0); } } catch { /* Keep the existing count if offline. */ }
    };
    void refresh(); const timer = setInterval(refresh, 30000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [pathname]);
  return <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative grid size-10 place-items-center rounded-xl border border-line bg-surface text-brand shadow-xs"><Bell className="size-5" />{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}</Link>;
}
