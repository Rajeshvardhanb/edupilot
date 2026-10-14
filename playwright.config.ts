import { defineConfig } from "@playwright/test";
import { loadEnvFile } from "node:process";

try { loadEnvFile(".env"); } catch { /* CI can supply the variables directly */ }

export const TEST_PORT = 3100;
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
    command: `npx prisma migrate deploy && npx next dev -p ${TEST_PORT}`,
    url: `http://localhost:${TEST_PORT}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      NEXT_DIST_DIR: ".next-test",
      APP_URL: `http://localhost:${TEST_PORT}`,
      // No mail server or payment keys: emails go to the outbox and payments use the test checkout.
      SMTP_HOST: "", RAZORPAY_KEY_ID: "", RAZORPAY_KEY_SECRET: "",
    },
  },
});
