import { requireUser } from "@/lib/auth";

export const metadata = { title: "Test error" };

/** Fails on purpose, so the administrator can check that errors are recorded (and emailed, when mail is set up). */
export default async function TestErrorPage() {
  await requireUser(["ADMIN"]);
  throw new Error("Test error raised from Administration → System health. Nothing is wrong.");
}
