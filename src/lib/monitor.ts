import "server-only";
import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { db } from "./db";
import { mailConfigured, sendMail } from "./mail";

let lastAlertAt = 0;

/**
 * Stores a server error. The same message on the same route is one row with a counter, so a broken
 * page that is hit a thousand times is one entry, not a thousand. The administrators are emailed the
 * first time an error appears (at most one email an hour) when a mail server is set up.
 */
export async function recordError(err: unknown, request: { path: string; method: string }, context: { routePath?: string; routeType?: string }) {
  try {
    const digest = typeof err === "object" && err !== null && "digest" in err ? String((err as { digest: unknown }).digest) : undefined;
    // Redirects and "not found" travel as thrown values inside Next.js; they are not failures.
    if (digest && /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK|DYNAMIC_SERVER_USAGE)/.test(digest)) return;
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 2000) || "Unknown error";
    const route = context.routePath ?? request.path.split("?")[0];
    const signature = createHash("sha1").update(`${route}|${message.replace(/[0-9a-f]{8,}|\d+/gi, "#")}`).digest("hex");
    const existing = await db.errorLog.findUnique({ where: { signature }, select: { id: true } });
    await db.errorLog.upsert({
      where: { signature },
      create: { signature, message, stack: err instanceof Error ? err.stack?.slice(0, 6000) : null, path: request.path.slice(0, 190), method: request.method, routeType: context.routeType ?? "render", digest },
      update: { count: { increment: 1 }, lastAt: new Date(), resolvedAt: null, path: request.path.slice(0, 190) },
    });
    if (!existing && mailConfigured() && Date.now() - lastAlertAt > 3600_000) {
      lastAlertAt = Date.now();
      const admins = await db.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { email: true } });
      await Promise.all(admins.map((a) => sendMail({ to: a.email, subject: "A page in the college system reported an error", text: `Something went wrong on ${route} (${request.method}).\n\n${message}\n\nIt is listed under Administration → System health, where repeats are counted. You will get at most one of these emails an hour.` })));
    }
  } catch (e) {
    console.error("could not record error", e, err);
  }
}

/** Newest database backups in the backups folder (written by `npm run db:backup` or the backup service). */
export function recentBackups(dir = process.env.BACKUP_DIR ?? "backups") {
  try {
    return readdirSync(/*turbopackIgnore: true*/ dir).filter((f) => f.endsWith(".sql.gz")).map((f) => { const st = statSync(/*turbopackIgnore: true*/ join(/*turbopackIgnore: true*/ dir, f)); return { file: f, at: st.mtime, size: st.size }; }).sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 5);
  } catch {
    return [];
  }
}

/** Size of the database on disk, in megabytes. */
export async function databaseSize() {
  const rows = await db.$queryRaw<{ mb: number; tables: bigint }[]>`SELECT ROUND(SUM(data_length + index_length) / 1048576, 1) AS mb, COUNT(*) AS tables FROM information_schema.tables WHERE table_schema = DATABASE()`;
  return { mb: Number(rows[0]?.mb ?? 0), tables: Number(rows[0]?.tables ?? 0) };
}
