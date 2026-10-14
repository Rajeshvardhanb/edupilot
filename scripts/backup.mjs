// Database backup: `npm run db:backup`. Writes backups/edupilot-<date>-<time>.sql.gz and keeps the newest 14.
// Restore with: gunzip -c backups/<file>.sql.gz | mysql -h <host> -P <port> -u <user> -p <database>
import { spawn } from "node:child_process";
import { copyFileSync, createWriteStream, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { createGzip } from "node:zlib";
import { loadEnvFile } from "node:process";

try { loadEnvFile(".env"); } catch { /* variables may come from the environment */ }
const url = new URL(process.env.DATABASE_URL ?? "");
const database = url.pathname.slice(1);
const dir = process.env.BACKUP_DIR ?? "backups";
const keep = Number(process.env.BACKUP_KEEP ?? 14);
mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
const file = join(dir, `${database}-${stamp}.sql.gz`);
// The password goes through the environment, not the command line, so it is not visible in the process list.
const dump = spawn("mysqldump", ["--protocol=TCP", "-h", url.hostname, "-P", url.port || "3306", "-u", decodeURIComponent(url.username), "--single-transaction", "--no-tablespaces", "--routines", "--hex-blob", database],
  { env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) }, stdio: ["ignore", "pipe", "pipe"] });

let stderr = "";
dump.stderr.on("data", (d) => { stderr += d; });
dump.on("error", (e) => { console.error(e.code === "ENOENT" ? "mysqldump was not found. Install the MySQL client tools." : e.message); process.exit(1); });
const out = createWriteStream(file);
dump.stdout.pipe(createGzip()).pipe(out);

dump.on("close", (code) => {
  out.on("finish", () => {
    if (code !== 0) { try { unlinkSync(file); } catch {} console.error(`Backup failed:\n${stderr.trim()}`); process.exit(1); }
    console.log(`Backup written: ${file} (${(statSync(file).size / 1e6).toFixed(1)} MB)`);
    const old = readdirSync(dir).filter((f) => f.startsWith(`${database}-`) && f.endsWith(".sql.gz")).sort().reverse().slice(keep);
    for (const f of old) unlinkSync(join(dir, f));
    if (old.length) console.log(`Removed ${old.length} older backup(s); keeping the newest ${keep}.`);
    // A second copy somewhere else (another disk, a NAS, a cloud-synced folder) survives the loss of this machine.
    const mirror = process.env.BACKUP_MIRROR_DIR;
    if (mirror) {
      try { mkdirSync(mirror, { recursive: true }); copyFileSync(file, join(mirror, basename(file))); console.log(`Copied to ${mirror}`); }
      catch (e) { console.error(`Could not copy the backup to ${mirror}: ${e.message}`); process.exitCode = 1; }
    }
  });
});
