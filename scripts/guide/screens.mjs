// Captures every screen of the app for the screens atlas (docs/EduPilot-All-Screens.pdf).
// Usage: node scripts/guide/screens.mjs [baseUrl]   (default http://127.0.0.1:3300, demo data, password123)
// For each role: every menu page, every tab on it, the first record of each list, and a few forms the menu
// does not link to directly. Then phone views for the roles that use phones most. Writes JPEG slices sized for
// an A4 landscape page and docs/screens/manifest.json, which scripts/guide/screens-pdf.mjs turns into the PDF.
import { chromium } from "@playwright/test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

const B = process.argv[2] ?? "http://127.0.0.1:3300";
const OUT = "docs/screens";
const W = 1280, SLICE = 822, MAX_SLICES = 5; // 1280 × 822 fills the image area of an A4 landscape page
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/img`, { recursive: true });

const ROLES = [
  ["Administrator", "admin@edupilot.edu", "all"],
  ["Head of Department", "hod.cse@edupilot.edu", "new"],
  ["Faculty", "faculty@edupilot.edu", "all"],
  ["Accounts Officer", "accounts@edupilot.edu", "new"],
  ["Office Staff", "office@edupilot.edu", "new"],
  ["Student", "student@edupilot.edu", "all"],
  ["Parent", "parent@edupilot.edu", "all"],
];
// Pages that are opened from a button rather than a menu or list link.
const EXTRA = { "admin@edupilot.edu": ["/dashboard?view=insights", "/students/new", "/students/import", "@first-student/edit", "@first-student/id-card", "/notifications"] };
// Links that download a file, deliberately fail, or leave the app are not screens.
const NOT_A_SCREEN = /export|\.csv|\/pdf|\/file|template|download|test-error|\/logout|^\/pay\/|\?/;

const manifest = { generated: new Date().toISOString(), screens: [] };
const seenByAdmin = new Set();
let n = 0;
const br = await chromium.launch();

async function signIn(email, viewport) {
  const ctx = await br.newContext({ viewport, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(`${B}/login`);
  await p.fill("#email", email);
  await p.fill("#password", "password123");
  await Promise.all([p.waitForURL(/dashboard/, { timeout: 60_000 }), p.click("button[type=submit]")]);
  const skip = p.getByRole("dialog", { name: "Guided tour" }).getByRole("button", { name: "Skip" });
  await skip.waitFor({ timeout: 4000 }).then(() => skip.click(), () => {});
  return p;
}

async function openAllGroups(p) {
  const folded = p.locator("aside nav button[aria-expanded=false]:visible");
  for (let i = 0; i < 12 && (await folded.count()); i++) await folded.first().click();
}

// Pages whose heading is a greeting or a slogan rather than a name.
const NAMES = { "/login": "Sign in", "/dashboard": "Dashboard", "/forgot-password": "Forgot password" };

/** A name that tells screens apart: "Staff › Payroll" for a tab, "Study material › Physics Lab" for a record. */
async function screenTitle(p) {
  const fixed = NAMES[new URL(p.url()).pathname];
  if (fixed) {
    const tab = (await p.locator('main nav a[aria-current="page"]').first().textContent({ timeout: 500 }).catch(() => null))?.trim();
    return tab ? `${fixed} › ${tab}` : fixed;
  }
  const h1 = (await p.locator("main h1").first().textContent({ timeout: 2000 }).catch(() => null))?.trim() || (await p.title()).replace(/ · .*$/, "");
  const tab = (await p.locator('main nav a[aria-current="page"]').first().textContent({ timeout: 500 }).catch(() => null))?.trim();
  if (tab && tab !== h1) return `${h1} › ${tab}`;
  const crumbs = await p.locator('nav[aria-label="Breadcrumb"] a, nav[aria-label="Breadcrumb"] span > span').allTextContents().catch(() => []);
  const trail = crumbs.map((c) => c.trim()).filter((c) => c && c !== h1 && !h1.startsWith(c) && !c.startsWith(h1));
  if (trail.length) return [...trail, h1].join(" › ");
  const section = { materials: "Study material", syllabus: "Syllabus", exams: "Marks entry", attendance: "Attendance", fees: "Fees", students: "Student", placements: "Placement drive", certificates: "Certificate", helpdesk: "Helpdesk ticket" }[new URL(p.url()).pathname.split("/")[1]];
  // Only single records (an id in the address) get their section in front; list pages keep their own heading.
  const isRecord = /\/c[a-z0-9]{20,}/.test(new URL(p.url()).pathname);
  return section && isRecord && !h1.startsWith(section) ? `${section} › ${h1}` : h1;
}

/** Opens a page and saves it as one or more slices; returns false if it is not a screen to show. */
async function capture(p, role, href, kind) {
  const res = await p.goto(B + href, { waitUntil: "networkidle", timeout: 60_000 }).catch(() => null);
  if (!res || res.status() >= 400) return false;
  await p.waitForTimeout(400); // let the short fade-in finish
  if (p.url().includes("denied=1")) return false;
  const path = new URL(p.url()).pathname;
  const title = await screenTitle(p);
  const height = await p.evaluate(() => document.documentElement.scrollHeight);
  // A leftover strip of a few pixels below the last full slice is dropped (it holds only page padding).
  const slices = Math.max(1, Math.min(MAX_SLICES, Math.ceil((height - 40) / SLICE)));
  const files = [];
  const id = String(++n).padStart(3, "0");
  for (let i = 0; i < slices; i++) {
    const file = `img/${id}-${i + 1}.jpg`;
    await p.screenshot({ path: `${OUT}/${file}`, type: "jpeg", quality: 72, fullPage: true, clip: { x: 0, y: i * SLICE, width: W, height: Math.min(SLICE, height - i * SLICE) } });
    files.push(file);
  }
  manifest.screens.push({ id, role, path, title, kind, files, truncated: height > MAX_SLICES * SLICE });
  console.log(`${id} ${role.padEnd(18)} ${path} — ${title} (${files.length})`);
  return path;
}

// Before signing in: the public pages.
{
  const ctx = await br.newContext({ viewport: { width: W, height: SLICE } });
  const p = await ctx.newPage();
  for (const href of ["/login", "/forgot-password"]) await capture(p, "Before signing in", href, "desktop");
  await ctx.close();
}

for (const [role, email, scope] of ROLES) {
  const p = await signIn(email, { width: W, height: SLICE });
  await openAllGroups(p);
  const menu = await p.locator("aside nav a:visible").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
  const done = new Set();
  const take = async (href, kind = "desktop") => {
    if (done.has(href) || NOT_A_SCREEN.test(href)) return null;
    // Office, accounts and HOD mostly see the administrator's screens with less in them: show only their own.
    if (scope === "new" && href !== "/dashboard" && seenByAdmin.has(href)) return null;
    done.add(href);
    const path = await capture(p, role, href, kind);
    if (path) { done.add(path); if (scope === "all" && role === "Administrator") seenByAdmin.add(path); }
    return path;
  };
  for (const href of menu) {
    if (!(await take(href))) continue;
    const links = await p.locator("main a").evaluateAll((as) => as.map((a) => a.getAttribute("href")).filter(Boolean)).catch(() => []);
    const tabs = await p.locator("main nav a").evaluateAll((as) => as.map((a) => a.getAttribute("href"))).catch(() => []);
    const first = links.find((h) => h.startsWith(href + "/") && !NOT_A_SCREEN.test(h) && !/\/(new|import|edit)$/.test(h));
    for (const t of tabs) if (t?.startsWith("/")) await take(t);
    if (first) await take(first);
  }
  for (const extra of EXTRA[email] ?? []) {
    let href = extra;
    if (extra.startsWith("@first-student")) {
      await p.goto(`${B}/students`, { waitUntil: "networkidle" });
      const s = await p.locator('main tbody a[href^="/students/c"]').first().getAttribute("href").catch(() => null);
      if (!s) continue;
      href = extra.replace("@first-student", s);
    }
    if (href.includes("?")) { if (!done.has(href)) { done.add(href); await capture(p, role, href, "desktop"); } } // a tab kept in the address
    else await take(href);
  }
  await p.context().close();
}

// Phone views for the people who mostly use phones.
for (const [role, email] of [["Student", "student@edupilot.edu"], ["Parent", "parent@edupilot.edu"], ["Faculty", "faculty@edupilot.edu"]]) {
  const p = await signIn(email, { width: 390, height: 844 });
  await p.click('button[aria-label="Open menu"]');
  await openAllGroups(p);
  await p.waitForTimeout(300);
  const id = String(++n).padStart(3, "0");
  await p.screenshot({ path: `${OUT}/img/${id}-1.jpg`, type: "jpeg", quality: 75 });
  manifest.screens.push({ id, role, path: "(menu)", title: "Menu", kind: "phone", files: [`img/${id}-1.jpg`] });
  const menu = await p.locator("aside nav a:visible").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
  await p.keyboard.press("Escape");
  for (const href of menu) {
    const res = await p.goto(B + href, { waitUntil: "networkidle" }).catch(() => null);
    if (!res || p.url().includes("denied=1")) continue;
    await p.waitForTimeout(400);
    const title = await screenTitle(p);
    const pid = String(++n).padStart(3, "0");
    await p.screenshot({ path: `${OUT}/img/${pid}-1.jpg`, type: "jpeg", quality: 75 });
    manifest.screens.push({ id: pid, role, path: new URL(p.url()).pathname, title, kind: "phone", files: [`img/${pid}-1.jpg`] });
    console.log(`${pid} ${role.padEnd(18)} ${href} (phone)`);
  }
  await p.context().close();
}

await br.close();
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 1));
console.log(`${manifest.screens.length} screens captured`);
