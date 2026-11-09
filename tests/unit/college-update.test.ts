import { afterEach, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gunzipSync } from "node:zlib";
import { backupCollegeDatabase, findMysqlDump, runCollegeUpdate } from "../../scripts/college-update.mjs";

const folders: string[] = [];
const temporary = () => { const dir = mkdtempSync(join(tmpdir(), "college update test ")); folders.push(dir); return dir; };
afterEach(() => { folders.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })); });
const fakeDump = (source: string) => (() => spawn(process.execPath, ["-e", source], { stdio: ["ignore", "pipe", "pipe"] })) as unknown as typeof spawn;

describe("single command college update", () => {
  const order = ["validate", "ensureStopped", "preview", "backup", "build", "apply", "start"];
  it("requires a backup and successful build before importing or starting", async () => {
    const called: string[] = [];
    const steps = Object.fromEntries(order.map(name => [name, async () => { called.push(name); }]));
    await runCollegeUpdate(steps);
    expect(called).toEqual(order);
  });
  it.each(order)("stops after a failed %s step", async failed => {
    const called: string[] = [];
    const steps = Object.fromEntries(order.map(name => [name, async () => {
      called.push(name);
      if (name === failed) throw new Error("Failed step");
    }]));
    await expect(runCollegeUpdate(steps)).rejects.toThrow("Failed step");
    expect(called).toEqual(order.slice(0, order.indexOf(failed) + 1));
  });
  it("finds MySQL on Windows even when the installation path has spaces", () => {
    const root = temporary();
    const bin = join(root, "MySQL", "MySQL Server 8.4", "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, "mysqldump.exe"), "fixture");
    expect(findMysqlDump({ ProgramFiles: root }, "win32")).toBe(join(bin, "mysqldump.exe"));
    expect(findMysqlDump({}, "win32")).toBe("mysqldump.exe");
    expect(() => findMysqlDump({ MYSQLDUMP_PATH: join(root, "missing.exe") }, "win32")).toThrow("MYSQLDUMP_PATH");
  });
  it("finishes a readable compressed SQL backup before continuing", async () => {
    const dir = temporary();
    const file = await backupCollegeDatabase(new URL("mysql://test:private-password@localhost/edupilot_test"), dir, "fixture", fakeDump('require("node:fs").writeSync(1, "CREATE TABLE test (id INT); INSERT INTO test VALUES (1);")'));
    expect(gunzipSync(readFileSync(file)).toString()).toContain("INSERT INTO test VALUES (1)");
    expect(readdirSync(dir)).toHaveLength(1);
  });
  it.each(['require("node:fs").writeSync(1, "partial dump"); process.exitCode = 1;', 'process.exitCode = 0;'])("rejects incomplete or empty backups and removes the partial file", async source => {
    const dir = temporary();
    await expect(backupCollegeDatabase(new URL("mysql://test:private-password@localhost/edupilot_test"), dir, "fixture", fakeDump(source))).rejects.toThrow();
    expect(readdirSync(dir)).toHaveLength(0);
  });
  it("keeps the database password out of process arguments", async () => {
    let args: string[] = [];
    const runner = ((_executable: string, input: string[]) => {
      args = input;
      return spawn(process.execPath, ["-e", 'require("node:fs").writeSync(1, "CREATE TABLE test (id INT);")'], { stdio: ["ignore", "pipe", "pipe"] });
    }) as typeof spawn;
    await backupCollegeDatabase(new URL("mysql://test:private-password@localhost/edupilot_test"), temporary(), "fixture", runner);
    expect(args.join(" ")).not.toContain("private-password");
    expect(args).toContain("--single-transaction");
  });
});
