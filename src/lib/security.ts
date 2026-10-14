import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { headers } from "next/headers";
import { db } from "./db";

export const MAX_FAILED = 5;          // wrong passwords before an account locks
export const LOCK_MINUTES = 15;
export const IP_WINDOW_MINUTES = 15;
export const IP_MAX_FAILED = 30;      // failures from one address across all accounts
export const RESET_MINUTES = 30;
export const CODE_MINUTES = 10;        // life of a two-step sign-in code
export const CODE_MAX_TRIES = 5;

/**
 * Timestamp for "password changed now", rounded down to the second. Session tokens carry their
 * issue time in whole seconds, so a session is valid only if issued at or after this moment.
 */
export const passwordChangedNow = () => new Date(Math.floor(Date.now() / 1000) * 1000);

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
/** Six random digits, e.g. "048213". */
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim().slice(0, 60);
}

/** Too many recent failures from this address, regardless of which account was tried. */
export async function ipBlocked(ip: string) {
  const since = new Date(Date.now() - IP_WINDOW_MINUTES * 60_000);
  return (await db.loginAttempt.count({ where: { ip, success: false, createdAt: { gte: since } } })) >= IP_MAX_FAILED;
}

/** Returns a message when the password is too weak, otherwise null. */
export function passwordProblem(password: string, context: string[] = []): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return "Use both letters and numbers.";
  const lower = password.toLowerCase();
  if (["password", "12345678", "qwerty", "welcome"].some((w) => lower.includes(w))) return "That password is too common.";
  if (context.some((c) => c && c.length >= 4 && lower.includes(c.toLowerCase()))) return "Don't use your name, email or ID in the password.";
  return null;
}
