import { gzipSync } from "node:zlib";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getInstitution } from "@/lib/institution";

// Sign-in secrets and short-lived security records have no place in an archive.
const SKIP = new Set(["LoginCode", "PasswordResetToken", "LoginAttempt", "ErrorLog"]);

/**
 * A readable copy of every record in the college, one list per table, as a compressed JSON file.
 * Meant as a year-end archive or for analysis elsewhere. Passwords, photos and uploaded files are
 * left out, so this is not a way to move the system to another server: use the database backup for that.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  const inst = await getInstitution();
  const tables: Record<string, unknown[]> = {};
  for (const model of Prisma.dmmf.datamodel.models) {
    if (SKIP.has(model.name)) continue;
    const key = model.name[0].toLowerCase() + model.name.slice(1);
    const rows = await (db as unknown as Record<string, { findMany: (a?: object) => Promise<Record<string, unknown>[]> }>)[key].findMany();
    tables[model.name] = model.name === "User" ? rows.map(({ passwordHash: _hidden, ...rest }) => { void _hidden; return rest; }) : rows;
  }
  const body = JSON.stringify({ format: "edupilot-archive-1", exportedAt: new Date().toISOString(), college: inst.name, counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])), tables });
  await audit(user.id, "EXPORT", "Archive", undefined, `${Object.values(tables).reduce((t, v) => t + v.length, 0)} records`);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(gzipSync(body)), { headers: { "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="edupilot-archive-${day}.json.gz"`, "Cache-Control": "no-store" } });
}
