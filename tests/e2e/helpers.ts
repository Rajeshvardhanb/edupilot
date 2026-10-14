import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { expect, type Browser, type Page } from "@playwright/test";
import { TEST_DATABASE_URL } from "../../playwright.config";

export const db = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
export const PASSWORD = "password123";

/** Resets the test database to the demo college. Each spec file starts from this known state. */
export function reseed() {
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL }, stdio: "pipe" });
}

/** Records the seed uses throughout: the demo student, one of the demo teacher's courses, and so on. */
export async function fixtures() {
  const student = await db.student.findFirstOrThrow({ where: { user: { email: "student@edupilot.edu" } } });
  const offering = await db.courseOffering.findFirstOrThrow({ where: { batchId: student.batchId, term: { isCurrent: true }, faculty: { user: { email: "faculty@edupilot.edu" } } } });
  const invoice = await db.feeInvoice.findFirstOrThrow({ where: { studentId: student.id } });
  return { studentId: student.id, batchId: student.batchId, offeringId: offering.id, invoiceId: invoice.id };
}

export async function fresh(browser: Browser, viewport = { width: 1400, height: 900 }) {
  const page = await (await browser.newContext({ viewport })).newPage();
  // A thrown error in the page is a bug even if the flow still completes.
  page.on("pageerror", (e) => { if (!/negative time stamp/.test(e.message)) expect.soft(e.message, `page error at ${page.url()}`).toBe(""); });
  return page;
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
}

/** Signs in and dismisses the first-login tour. */
export async function session(browser: Browser, email: string, opts: { viewport?: { width: number; height: number }; keepTour?: boolean } = {}) {
  const page = await fresh(browser, opts.viewport);
  await signIn(page, email);
  await page.waitForURL("**/dashboard", { timeout: 90_000 });
  if (!opts.keepTour) {
    const skip = page.getByRole("dialog", { name: "Guided tour" }).getByRole("button", { name: "Skip" });
    await skip.waitFor({ timeout: 5000 }).then(() => skip.click(), () => {});
  }
  return page;
}

export const go = async (page: Page, path: string) => { await page.goto(path); await page.waitForLoadState("networkidle").catch(() => {}); };
export const seen = (page: Page, text: string | RegExp, ms = 15_000) => page.getByText(text).first().waitFor({ timeout: ms }).then(() => true, () => false);
/** Soft check: the flow carries on and every failed check is reported at the end. */
export const ok = (name: string, cond: unknown) => expect.soft(!!cond, name).toBe(true);
/** Presses the confirm button of the in-app confirmation dialog. */
export async function confirm(page: Page) {
  const b = page.getByRole("alertdialog").getByRole("button").last();
  await b.waitFor({ timeout: 8000 });
  await b.click();
}
