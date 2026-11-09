// One command for a native Windows/Node/MySQL presentation installation.
import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { randomUUID } from "node:crypto";

/** @param {Record<string, string | undefined>} env */
export function findMysqlDump(env = process.env, platform = process.platform) {
  if (env.MYSQLDUMP_PATH) {
    if (!existsSync(env.MYSQLDUMP_PATH)) throw new Error("MYSQLDUMP_PATH does not point to an installed mysqldump executable.");
    return env.MYSQLDUMP_PATH;
  }
  if (platform === "win32") {
    for (const root of [env.ProgramFiles, env["ProgramFiles(x86)"]].filter(Boolean)) {
      const mysql = join(root, "MySQL");
      if (!existsSync(mysql)) continue;
      const versions = readdirSync(mysql).filter(name => name.startsWith("MySQL Server ")).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      for (const version of versions) {
        const candidate = join(mysql, version, "bin", "mysqldump.exe");
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  return platform === "win32" ? "mysqldump.exe" : "mysqldump";
}

/** A completed SQL backup is required before the import is allowed to run. */
export async function backupCollegeDatabase(url, folder, executable, spawnDump = spawn) {
  mkdirSync(folder, { recursive: true, mode: 0o700 });
  const file = join(folder, `college-before-update-${new Date().toISOString().replaceAll(":", "-")}-${randomUUID().slice(0, 8)}.sql.gz`);
  const args = ["--protocol=TCP", "-h", url.hostname, "-P", url.port || "3306", "-u", decodeURIComponent(url.username),
    "--single-transaction", "--quick", "--no-tablespaces", "--hex-blob", url.pathname.slice(1)];
  const dump = spawnDump(executable, args, { env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) }, stdio: ["ignore", "pipe", "pipe"] });
  // Drain diagnostics without printing database connection information or credentials.
  dump.stderr.resume();
  const exited = new Promise((resolveExit, reject) => {
    dump.once("error", () => reject(new Error("Cannot run mysqldump. Install the MySQL Server command-line tools, or set MYSQLDUMP_PATH to mysqldump.exe.")));
    dump.once("close", code => code === 0 ? resolveExit() : reject(new Error("Database backup failed. Check that MySQL is running and the .env database account has backup access.")));
  });
  const output = createWriteStream(file, { mode: 0o600, flags: "wx" });
  const streamed = pipeline(dump.stdout, createGzip(), output);
  const results = await Promise.allSettled([exited, streamed]);
  const failed = results.find(result => result.status === "rejected");
  if (failed || !existsSync(file) || statSync(file).size <= 20) {
    try { unlinkSync(file); } catch { /* failed/partial files are not valid backups */ }
    throw failed?.status === "rejected" ? failed.reason : new Error("The backup file is empty. No data has been imported.");
  }
  return file;
}

export async function requireStoppedApp(port) {
  await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", () => reject(new Error(`Port ${port} is in use. In the app's running PowerShell window, press Ctrl+C, then run npm.cmd run college:update again.`)));
    server.listen(port, "127.0.0.1", () => server.close(error => error ? reject(error) : resolvePort()));
  });
}

/** Kept separate so failure ordering can be verified without touching a database or starting a server. */
export async function runCollegeUpdate(steps) {
  await steps.validate();
  await steps.ensureStopped();
  await steps.preview();
  await steps.backup();
  // Build first: a compilation failure must not apply the new database values.
  await steps.build();
  await steps.apply();
  await steps.start();
}

function command(root, args, label, env, allowStop = false) {
  console.log(`\n${label}`);
  return new Promise((resolveCommand, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env, stdio: "inherit", shell: false });
    child.once("error", () => reject(new Error(`${label} could not start. Check the Node.js installation.`)));
    child.once("close", (code, signal) => {
      const interrupted = signal === "SIGINT" || code === 130;
      if (code === 0 || (allowStop && interrupted)) resolveCommand();
      else reject(new Error(`${label} failed. Stop here and share the error shown above with the project maintainer.`));
    });
  });
}

async function main() {
  if (process.argv.length > 2) throw new Error("Run npm.cmd run college:update without extra arguments.");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  try { loadEnvFile(join(root, ".env")); } catch (error) { if (error.code !== "ENOENT") throw new Error("Cannot read .env. Check its format."); }
  let url;
  try { url = new URL(process.env.DATABASE_URL); } catch { throw new Error("Set DATABASE_URL in .env before running this command."); }
  if (url.protocol !== "mysql:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !url.pathname.slice(1))
    throw new Error("This command updates a local laptop installation. DATABASE_URL must point to its local MySQL database.");
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a number from 1 to 65535.");
  if (process.env.NEXT_OUTPUT === "standalone") throw new Error("Use this command with the native Windows installation, without NEXT_OUTPUT=standalone.");
  const env = { ...process.env, COLLEGE_IMPORT_PASSWORD: process.env.COLLEGE_IMPORT_PASSWORD || "password123" };
  const importer = ["--import", "tsx", join(root, "scripts", "college-data.mts")];
  const next = join(root, "node_modules", "next", "dist", "bin", "next");
  let applied = false;
  console.log("Updating college data. Keep this window open. Existing passwords, marks and attendance will be preserved.");
  try {
    await runCollegeUpdate({
      validate: () => command(root, [...importer, "--validate"], "1/6 Checking college-data.json...", env),
      ensureStopped: () => requireStoppedApp(port),
      preview: () => command(root, importer, "2/6 Checking database changes...", env),
      backup: async () => {
        console.log("\n3/6 Backing up the database...");
        const file = await backupCollegeDatabase(url, resolve(root, process.env.BACKUP_DIR || "backups"), findMysqlDump(env));
        console.log(`Database backup saved: ${file}`);
      },
      build: () => command(root, [next, "build", "--webpack"], "4/6 Preparing the updated application (this may take a few minutes)...", env),
      apply: async () => {
        await command(root, [...importer, "--apply"], "5/6 Applying college details...", env);
        applied = true;
      },
      start: async () => {
        console.log(`\nUpdate complete. Open http://localhost:${port}/login. Keep this window open; press Ctrl+C to stop the app.`);
        if (!process.env.COLLEGE_IMPORT_PASSWORD) console.log("New faculty demo accounts use password123. Existing passwords are unchanged.");
        await command(root, [next, "start", "--hostname", "127.0.0.1", "--port", String(port)], "6/6 Starting the application...", env, true);
      },
    });
  } catch (error) {
    console.error(applied ? "The data was updated, but the application could not start. The database backup is in backups/." : "Update stopped. Do not reseed or reset the database. No completed import was reported.");
    throw error;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
