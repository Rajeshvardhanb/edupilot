"use client";
import { useEffect } from "react";

/** Retire the previous offline feature and its private cached pages. */
export function BrowserCleanup() {
  useEffect(() => {
    async function clean() {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.filter((r) => [r.active, r.waiting, r.installing].some((w) => w && new URL(w.scriptURL).pathname === "/sw.js")).map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k.startsWith("edupilot-")).map((k) => caches.delete(k)));
      }
      localStorage.removeItem("edupilot-attendance-queue");
    }
    clean().catch(() => {});
  }, []);
  return null;
}
