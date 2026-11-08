import type { Instrumentation } from "next";

/** Start daily security cleanup and optional backups. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __edupilotScheduler?: boolean };
  if (g.__edupilotScheduler) return;
  g.__edupilotScheduler = true;
  const tick = async () => {
    try {
      const { runDailyJobs } = await import("@/lib/scheduler");
      await runDailyJobs();
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
