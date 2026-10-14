import type { Instrumentation } from "next";

/**
 * Runs once when the server starts. Starts the hourly check that emails scheduled reports and,
 * once a day, brings late fines up to date and clears expired sign-in records.
 * (When the app is hosted somewhere that stops idle servers, call GET /reports/cron?key=CRON_SECRET
 * from an external scheduler instead.)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __edupilotScheduler?: boolean };
  if (g.__edupilotScheduler) return;
  g.__edupilotScheduler = true;
  const tick = async () => {
    try {
      const { runDailyJobs, runDueSchedules } = await import("@/lib/scheduler");
      await runDailyJobs();
      await runDueSchedules();
    } catch (e) {
      console.error("scheduler tick failed", e);
    }
  };
  setTimeout(tick, 90_000).unref?.();
  setInterval(tick, 3600_000).unref?.();
}

/** Every server error (page render, action or route) is written to the error log shown under Administration → System health. */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordError } = await import("@/lib/monitor");
  await recordError(err, request, context);
};
