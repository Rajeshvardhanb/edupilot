// Load test: many students using the portal at the same time.
//   npm run test:load -- [baseUrl] [users] [seconds]      defaults: http://localhost:3200  200  30
// Run it against a production build (npm run build && npx next start -p 3200), not `npm run dev`:
// the development server compiles pages on demand and is several times slower.
//
// Each simulated student is signed in (a session token is minted with AUTH_SECRET, so the test measures
// page loads, not password hashing) and then opens the pages students use, with a short pause between
// them, until the time is up. Only pages are read; nothing is changed.
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import { loadEnvFile } from "node:process";

try { loadEnvFile(".env"); } catch { /* variables may come from the environment */ }
const [base = "http://localhost:3200", usersArg = "200", secondsArg = "30"] = process.argv.slice(2);
const USERS = Number(usersArg), SECONDS = Number(secondsArg);
const PAGES = ["/dashboard", "/attendance", "/results", "/fees", "/timetable", "/notices"];

const db = new PrismaClient();
const students = await db.user.findMany({ where: { role: "STUDENT", isActive: true, student: { status: "ACTIVE" } }, select: { id: true, name: true }, take: USERS });
await db.$disconnect();
if (!students.length) { console.error("No active students in the database."); process.exit(1); }
const key = new TextEncoder().encode(process.env.AUTH_SECRET);
const cookies = await Promise.all(students.map(async (s) => `edupilot_session=${await new SignJWT({ role: "STUDENT", name: s.name }).setProtectedHeader({ alg: "HS256" }).setSubject(s.id).setIssuedAt().setExpirationTime("1h").sign(key)}`));

const probe = await fetch(base + "/dashboard", { headers: { cookie: cookies[0] }, redirect: "manual" }).catch((e) => ({ status: 0, error: e }));
if (probe.status !== 200) { console.error(`Could not open ${base}/dashboard as a student (status ${probe.status}). Is the server running there, with the same AUTH_SECRET and database?`); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const samples = []; // [page, ms, status]
const until = Date.now() + SECONDS * 1000;
async function student(cookie, i) {
  await sleep((i / cookies.length) * 2000); // arrive over two seconds, not all in the same instant
  while (Date.now() < until) {
    const page = PAGES[Math.floor(Math.random() * PAGES.length)];
    const t0 = performance.now();
    let status = 0;
    try { const r = await fetch(base + page, { headers: { cookie }, redirect: "manual" }); status = r.status; await r.arrayBuffer(); } catch { status = 0; }
    samples.push([page, performance.now() - t0, status]);
    await sleep(300 + Math.random() * 900);
  }
}
console.log(`${cookies.length} students on ${base} for ${SECONDS}s …`);
const started = Date.now();
await Promise.all(cookies.map(student));
const took = (Date.now() - started) / 1000;

const pct = (xs, p) => xs.length ? Math.round(xs[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))]) : 0;
const row = (label, rows) => {
  const ms = rows.map((r) => r[1]).sort((a, b) => a - b), bad = rows.filter((r) => r[2] !== 200).length;
  return `${label.padEnd(14)} ${String(rows.length).padStart(7)} ${String(pct(ms, 50)).padStart(8)} ${String(pct(ms, 95)).padStart(8)} ${String(pct(ms, 99)).padStart(8)} ${String(Math.round(ms.at(-1) ?? 0)).padStart(8)} ${String(bad).padStart(7)}`;
};
console.log(`\n${"page".padEnd(14)} ${"loads".padStart(7)} ${"median".padStart(8)} ${"95%".padStart(8)} ${"99%".padStart(8)} ${"slowest".padStart(8)} ${"failed".padStart(7)}   (times in ms)`);
for (const p of PAGES) console.log(row(p, samples.filter((s) => s[0] === p)));
console.log(row("ALL", samples));
const failed = samples.filter((s) => s[2] !== 200).length;
console.log(`\n${(samples.length / took).toFixed(1)} page loads a second · ${failed} failed of ${samples.length} (${((failed / samples.length) * 100).toFixed(2)}%)`);
process.exit(failed / samples.length > 0.01 ? 1 : 0);
