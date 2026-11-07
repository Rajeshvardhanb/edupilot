import { test, type Page } from "@playwright/test";
import { ok, reseed, session } from "./helpers";

// Opens every page each role can reach from its menu, plus the first record on each list, and checks that
// none of them fails; then checks that every menu page fits a phone screen. Independent of the other files.

test.beforeAll(() => reseed());
test.use({ actionTimeout: 20_000 });

/** Some pages send a role on to its own record just after loading (a student's hall ticket); wait for that to finish. */
async function settle(p: Page) {
  await p.waitForTimeout(300);
  await p.waitForLoadState("load");
}

/** Opens every folded menu group. Each click shrinks the list of folded ones, so always open the first. */
async function openAllGroups(p: Page) {
  const folded = p.locator("aside nav button[aria-expanded=false]:visible");
  for (let i = 0; i < 12 && (await folded.count()); i++) await folded.first().click();
}

const ROLES = ["admin", "hod.cse", "faculty", "accounts", "office", "student", "parent"].map((r) => `${r}@edupilot.edu`);
/** Links that download a file or deliberately fail are not pages to open. */
const NOT_A_PAGE = /export|\.csv|\/pdf|\/file|template|download|test-error|\/logout|^\/pay\//;

test("smoke: every page on every role's menu opens without an error, and so does the first record on each list", async ({ browser }) => {
  test.setTimeout(1_800_000);
  for (const email of ROLES) {
    const p = await session(browser, email);
    p.setDefaultNavigationTimeout(30_000);
    await openAllGroups(p);
    const menu = await p.locator("aside nav a:visible").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!))]);
    const visited = new Set<string>();
    const open = async (href: string) => {
      if (visited.has(href)) return;
      visited.add(href);
      const started = Date.now();
      const res = await p.goto(href, { waitUntil: "load" }).catch((e: Error) => { ok(`${email} ${href} loads within 30 s (${e.message.split("\n")[0]})`, false); return null; });
      console.log(`${email} ${href} ${res?.status() ?? "-"} ${Date.now() - started}ms`);
      const status = res?.status() ?? 0;
      const broken = await p.getByRole("heading", { name: /^(This page couldn't be loaded|Not found)$/ }).first().isVisible().catch(() => false);
      ok(`${email} ${href} opens (HTTP ${status})`, status < 400 && !broken && !p.url().includes("denied=1"));
    };
    for (const href of menu) {
      await open(href);
      await settle(p);
      const detail = await p.locator(`main a[href^="${href}/"]`).evaluateAll((as) => as.map((a) => a.getAttribute("href")!)).catch(() => []);
      const first = detail.find((h) => !NOT_A_PAGE.test(h) && !h.includes("?"));
      // Tabs at the top of a page must only offer what this role may open.
      const tabs = await p.goto(href, { waitUntil: "load" }).then(async () => {
        await settle(p);
        return p.locator("main nav a").evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
      }, () => [] as string[]);
      for (const t of tabs.filter((h) => h.startsWith("/") && !NOT_A_PAGE.test(h))) await open(t);
      if (first) await open(first);
    }
    ok(`${email}: visited ${visited.size} pages`, visited.size >= menu.length);
    await p.context().close();
  }
});

test("smoke on a phone: every menu page fits a phone screen without sideways scrolling", async ({ browser }) => {
  test.setTimeout(1_200_000);
  for (const email of ["admin@edupilot.edu", "student@edupilot.edu", "parent@edupilot.edu", "faculty@edupilot.edu"]) {
    const p = await session(browser, email, { viewport: { width: 360, height: 760 } });
    p.setDefaultNavigationTimeout(30_000);
    await p.click('button[aria-label="Open menu"]');
    await openAllGroups(p);
    const menu = await p.locator("aside nav a:visible").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!))]);
    for (const href of menu) {
      if (!(await p.goto(href, { waitUntil: "load" }).then(() => true, () => false))) { ok(`${email} ${href} loads on a phone`, false); continue; }
      await settle(p);
      ok(`${email} ${href} stays open on a phone (ended at ${p.url()})`, !p.url().includes("denied=1"));
      const wide = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth).catch(async () => {
        await p.waitForLoadState("load");
        return p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      });
      ok(`${email} ${href} fits 360px (overflow ${wide}px)`, wide <= 1);
    }
    await p.context().close();
  }
});
