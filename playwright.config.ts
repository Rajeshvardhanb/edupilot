import { defineConfig } from "@playwright/test";
import { loadEnvFile } from "node:process";

try { loadEnvFile(".env"); } catch { /* CI can supply the variables directly */ }

export const TEST_PORT = 3100;
/** E2E_PROD=1 runs the tests against a production build: a few minutes to build, then every page opens at once
 *  instead of compiling on first visit (the full run, with its every-page smoke test, needs this). */
const PROD = process.env.E2E_PROD === "1";
const MAIL_TEST = process.env.E2E_SMTP_TEST === "1";
const WEBPACK = process.env.E2E_WEBPACK === "1" ? " --webpack" : "";
/** Same MySQL server as development, but a separate database, so tests never touch real data. */
export const TEST_DATABASE_URL = (process.env.DATABASE_URL ?? "").replace(/\/[^/?]+(\?.*)?$/, "/edupilot_test$1");

if (!TEST_DATABASE_URL.includes("/edupilot_test")) throw new Error("Refusing to run: the test database URL does not point at edupilot_test.");

export default defineConfig({
  testDir: "tests/e2e",
  // The flows share one database and build on each other, so they run one at a time, in file order.
  workers: 1,
  fullyParallel: false,
  timeout: 240_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${TEST_PORT}`, viewport: { width: 1400, height: 900 }, trace: "retain-on-failure" },
  webServer: {
    // Creates the test database on first run and brings its tables up to date, then starts the app on it.
    command: PROD
      ? `npx prisma migrate deploy && npx next build${WEBPACK} && ${MAIL_TEST ? "node scripts/test-smtp.mjs node node_modules/next/dist/bin/next" : "npx next"} start -p ${TEST_PORT}`
      : `npx prisma migrate deploy && ${MAIL_TEST ? "node scripts/test-smtp.mjs node node_modules/next/dist/bin/next" : "npx next"} dev${WEBPACK} -p ${TEST_PORT}`,
    url: `http://localhost:${TEST_PORT}/login`,
    reuseExistingServer: process.env.E2E_REUSE_SERVER === "1",
    timeout: PROD ? 600_000 : 180_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      NEXT_DIST_DIR: ".next-test",
      APP_URL: `http://localhost:${TEST_PORT}`,
      // Test security mail goes to the local outbox, never to a real mailbox.
      SMTP_HOST: MAIL_TEST ? "127.0.0.1" : "",
      SMTP_PORT: MAIL_TEST ? "2525" : "587",
      SMTP_USER: "",
      SMTP_PASS: "",
      SMTP_FROM: MAIL_TEST ? "SVIET Test <sender@example.invalid>" : "",
    },
  },
});
