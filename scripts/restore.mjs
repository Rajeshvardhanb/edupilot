// Restores a database backup made by `npm run db:backup` (or the nightly backup service).
//   npm run db:restore -- backups/edupilot-2026-10-12-06-18.sql.gz --yes
// This REPLACES everything in the database named in DATABASE_URL. It is how the system is moved to
// another server: copy the newest backup file across, set DATABASE_URL there, and run this.
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { loadEnvFile } from "node:process";

try { loadEnvFile(".env"); } catch { /* variables may come from the environment */ }
const [file, ...flags] = process.argv.slice(2);
const url = new URL(process.env.DATABASE_URL ?? "");
const database = url.pathname.slice(1);
if (!file || !existsSync(file)) { console.error("Give the backup file to restore, for example: npm run db:restore -- backups/<file>.sql.gz --yes"); process.exit(1); }
if (!flags.includes("--yes")) {
  console.error(`This will REPLACE every record in the database "${database}" on ${url.hostname}:${url.port || 3306} with the contents of ${file}.\nMake a backup first (npm run db:backup), then run the same command again with --yes at the end.`);
  process.exit(1);
}
const mysql = spawn("mysql", ["--protocol=TCP", "-h", url.hostname, "-P", url.port || "3306", "-u", decodeURIComponent(url.username), database], { env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) }, stdio: ["pipe", "inherit", "pipe"] });
let stderr = "";
mysql.stderr.on("data", (d) => { stderr += d; });
mysql.on("error", (e) => { console.error(e.code === "ENOENT" ? "The mysql command was not found. Install the MySQL client tools." : e.message); process.exit(1); });
const source = file.endsWith(".gz") ? createReadStream(file).pipe(createGunzip()) : createReadStream(file);
source.on("error", (e) => { console.error(`Could not read ${file}: ${e.message}`); process.exit(1); });
source.pipe(mysql.stdin);
mysql.on("close", (code) => {
  if (code !== 0) { console.error(`Restore failed:\n${stderr.trim()}`); process.exit(1); }
  console.log(`Restored ${file} into "${database}". Restart the app so it picks up the restored data, and ask everyone to sign in again.`);
});
