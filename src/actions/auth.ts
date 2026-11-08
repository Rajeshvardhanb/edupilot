"use server";

import bcrypt from "bcryptjs";
import { notifyAcademic } from "@/lib/academic-email";
import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { PENDING_COOKIE, PENDING_TTL_SECONDS, SESSION_COOKIE, SESSION_TTL_SECONDS, signPending, signSession, verifyPending } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { appUrl, mailConfigured, sendMail } from "@/lib/mail";
import { CODE_MAX_TRIES, CODE_MINUTES, LOCK_MINUTES, MAX_FAILED, RESET_MINUTES, clientIp, ipBlocked, newCode, newToken, passwordChangedNow, passwordProblem, sha256 } from "@/lib/security";
import type { ActionState } from "@/lib/action-state";

// Compared against when the account doesn't exist, so response time doesn't reveal which emails are registered.
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8rT7yR3n7B0iQeF8yq3mM8mQ1x5y6e";

const cookieBase = () => ({ httpOnly: true, sameSite: "lax" as const, secure: (process.env.APP_URL ?? "").startsWith("https://"), path: "/" });

async function startSession(user: { id: string; role: Parameters<typeof signSession>[0]["role"]; name: string }) {
  const token = await signSession({ sub: user.id, role: user.role, name: user.name });
  (await cookies()).set(SESSION_COOKIE, token, { ...cookieBase(), maxAge: SESSION_TTL_SECONDS });
}

const LoginSchema = z.object({ email: z.email(), password: z.string().min(1) });

export async function login(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const email = parsed.data.email.toLowerCase();
  const ip = await clientIp();
  if (await ipBlocked(ip)) return { error: "Too many failed sign-in attempts from this network. Please wait 15 minutes and try again." };

  const user = await db.user.findUnique({ where: { email } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return { error: `This account is locked after too many wrong passwords. Try again in ${mins} minute${mins === 1 ? "" : "s"}, or use “Forgot password”.` };
  }
  const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    await db.loginAttempt.create({ data: { email: email.slice(0, 190), ip, success: false } });
    if (user) {
      const failed = user.failedLogins + 1;
      const lock = failed >= MAX_FAILED;
      await db.user.update({ where: { id: user.id }, data: { failedLogins: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null } });
      if (lock) {
        await audit(user.id, "LOCKED", "User", user.id, `${MAX_FAILED} wrong passwords from ${ip}`);
        return { error: `Too many wrong passwords. This account is locked for ${LOCK_MINUTES} minutes.` };
      }
      if (MAX_FAILED - failed <= 2) return { error: `Invalid email or password. ${MAX_FAILED - failed} attempt${MAX_FAILED - failed === 1 ? "" : "s"} left before the account is locked.` };
    }
    return { error: "Invalid email or password." };
  }
  if (!user.isActive) return { error: "Your account is disabled. Contact the administrator." };

  const next = String(formData.get("next") ?? "");
  const dest = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  if (user.twoStep) {
    // Password accepted: the session starts only after the emailed code is entered.
    if (!await sendLoginCode(user)) return { error: "The sign-in code could not be sent. Contact the administrator or try again later." };
    (await cookies()).set(PENDING_COOKIE, await signPending(user.id), { ...cookieBase(), maxAge: PENDING_TTL_SECONDS });
    redirect(`/login/verify${dest === "/dashboard" ? "" : `?next=${encodeURIComponent(dest)}`}`);
  }
  await finishLogin(user, ip);
  redirect(user.mustChangePassword ? "/change-password" : dest);
}

async function finishLogin(user: { id: string; email: string; role: Parameters<typeof signSession>[0]["role"]; name: string }, ip: string) {
  await startSession(user);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await db.loginAttempt.create({ data: { email: user.email, ip, success: true } });
  await audit(user.id, "LOGIN", "User", user.id);
}

// ── Two-step sign-in ──

const DEV_CODE_COOKIE = "edupilot_dev_code";
/** True when codes can't be emailed and we're not in production: the code is then shown on screen so the flow can be tried. */
const showCodeOnScreen = () => process.env.NODE_ENV !== "production" && !mailConfigured();

/** Emails a fresh six-digit code. Only its hash is stored; earlier unused codes stop working. */
async function sendLoginCode(user: { id: string; email: string; name: string }) {
  const code = newCode();
  await db.loginCode.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  await db.loginCode.create({ data: { userId: user.id, codeHash: sha256(`${user.id}:${code}`), expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000) } });
  const status = await sendMail({ to: user.email, category: "security", subject: "Your sign-in verification code", code, logText: "A sign-in verification code was requested. The code is not stored in this outbox.", text: `Hello ${user.name},\n\nUse the code below to complete sign-in. It works once and expires in ${CODE_MINUTES} minutes.\n\nIf you did not try to sign in, contact the college administrator and change your password.` });
  if (showCodeOnScreen()) (await cookies()).set(DEV_CODE_COOKIE, code, { ...cookieBase(), maxAge: CODE_MINUTES * 60 });
  return status === "SENT" || showCodeOnScreen();
}

/** Checks a code for this user. Each wrong try is counted; after five the code is dead. */
async function codeIsValid(userId: string, input: string) {
  const row = await db.loginCode.findFirst({ where: { userId, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!row || row.attempts >= CODE_MAX_TRIES) return false;
  if (row.codeHash !== sha256(`${userId}:${input.replace(/\D/g, "")}`)) {
    await db.loginCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  await db.loginCode.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return true;
}

/** For the verify page: who is mid-sign-in, and (development without a mail server only) the code to show. */
export async function pendingLogin() {
  const jar = await cookies();
  const userId = await verifyPending(jar.get(PENDING_COOKIE)?.value);
  if (!userId) return null;
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return null;
  const [name, domain] = user.email.split("@");
  return { maskedEmail: `${name.slice(0, 2)}${"•".repeat(Math.max(2, name.length - 2))}@${domain}`, devCode: showCodeOnScreen() ? jar.get(DEV_CODE_COOKIE)?.value ?? null : null };
}

export async function verifyLoginCode(_: ActionState, formData: FormData): Promise<ActionState> {
  const jar = await cookies();
  const userId = await verifyPending(jar.get(PENDING_COOKIE)?.value);
  if (!userId) redirect("/login?expired=1");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) redirect("/login");
  const ip = await clientIp();
  if (!(await codeIsValid(user.id, String(formData.get("code") ?? "")))) {
    await db.loginAttempt.create({ data: { email: user.email, ip, success: false } });
    return { error: "That code is not correct or has expired. Check the latest email, or send a new code." };
  }
  jar.delete(PENDING_COOKIE);
  jar.delete(DEV_CODE_COOKIE);
  await finishLogin(user, ip);
  const next = String(formData.get("next") ?? "");
  redirect(user.mustChangePassword ? "/change-password" : next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function resendLoginCode(): Promise<ActionState> {
  const userId = await verifyPending((await cookies()).get(PENDING_COOKIE)?.value);
  if (!userId) redirect("/login?expired=1");
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if ((await db.loginCode.count({ where: { userId, createdAt: { gte: new Date(Date.now() - CODE_MINUTES * 60_000) } } })) >= 4) return { error: "Too many codes requested. Wait a few minutes and try again." };
  if (!await sendLoginCode(user)) return { error: "The sign-in code could not be sent. Contact the administrator or try again later." };
  return { ok: true, message: "A new code has been sent." };
}

/** Step 1 of turning it on: prove the email address works by sending a code to it. */
export async function startTwoStep(): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me) redirect("/session/expired");
  if (me.role === "STUDENT" || me.role === "PARENT") return { error: "Two-step sign-in is for staff accounts." };
  if (!mailConfigured() && process.env.NODE_ENV === "production") return { error: "Email is not set up on this server yet, so codes could not reach you. Ask the administrator to connect a mail account first." };
  if ((await db.loginCode.count({ where: { userId: me.id, createdAt: { gte: new Date(Date.now() - CODE_MINUTES * 60_000) } } })) >= 4) return { error: "Too many codes requested. Wait a few minutes and try again." };
  if (!await sendLoginCode(me)) return { error: "The verification code could not be sent. Check email configuration before enabling two-step sign-in." };
  const dev = showCodeOnScreen() ? ` (No mail server is configured, so here is the code for testing: ${(await cookies()).get(DEV_CODE_COOKIE)?.value})` : "";
  return { ok: true, message: `We sent a six-digit code to ${me.email}. Enter it below to turn two-step sign-in on.${dev}` };
}

/** Step 2: the code arrived, so it is safe to require one at every sign-in. */
export async function confirmTwoStep(_: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me) redirect("/session/expired");
  if (!(await codeIsValid(me.id, String(formData.get("code") ?? "")))) return { error: "That code is not correct or has expired." };
  await db.user.update({ where: { id: me.id }, data: { twoStep: true } });
  (await cookies()).delete(DEV_CODE_COOKIE);
  await audit(me.id, "TWO_STEP_ON", "User", me.id);
  notifyAcademic({ type: "security", id: me.id, action: "Two-step sign-in was enabled for your account.", version: String(Date.now()) });
  revalidatePath("/profile");
  return { ok: true, message: "Two-step sign-in is on. You'll be asked for an emailed code each time you sign in." };
}

export async function disableTwoStep(_: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me) redirect("/session/expired");
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(String(formData.get("current") ?? ""), user.passwordHash))) return { fieldErrors: { current: ["Password is incorrect"] } };
  await db.user.update({ where: { id: me.id }, data: { twoStep: false } });
  await audit(me.id, "TWO_STEP_OFF", "User", me.id);
  notifyAcademic({ type: "security", id: me.id, action: "Two-step sign-in was disabled for your account.", version: String(Date.now()) });
  revalidatePath("/profile");
  return { ok: true, message: "Two-step sign-in is off." };
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

/** Used both from My Profile and from the forced first-login screen. */
export async function changePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me) redirect("/session/expired");
  const current = String(formData.get("current") ?? ""), password = String(formData.get("password") ?? ""), confirm = String(formData.get("confirm") ?? "");
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(current, user.passwordHash))) return { fieldErrors: { current: ["Current password is incorrect"] } };
  if (password !== confirm) return { fieldErrors: { confirm: ["Passwords do not match"] } };
  if (password === current) return { fieldErrors: { password: ["Choose a password different from the current one"] } };
  const problem = passwordProblem(password, [user.email.split("@")[0], user.name.split(" ")[0]]);
  if (problem) return { fieldErrors: { password: [problem] } };

  await db.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: false, passwordChangedAt: passwordChangedNow() } });
  await startSession(user); // other devices are signed out; this one continues
  await audit(me.id, "CHANGE_PASSWORD", "User", me.id);
  notifyAcademic({ type: "security", id: me.id, action: "Your account password was changed.", version: String(Date.now()) });
  if (formData.get("forced")) redirect("/dashboard");
  return { ok: true, message: "Password updated. Other devices have been signed out." };
}

/** Always answers the same way, so it can't be used to discover which emails have accounts. */
export async function forgotPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { error: "Enter your email address." };
  const ip = await clientIp();
  if (await ipBlocked(ip)) return { error: "Too many attempts from this network. Please try again later." };
  const done: ActionState = { ok: true, message: "If an account exists for that email, a reset link has been sent. It is valid for 30 minutes." };

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return done;
  const recent = await db.passwordResetToken.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (recent >= 3) return done; // at most three links an hour per account

  const token = newToken();
  await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) } });
  const url = appUrl(`/reset-password?token=${token}`);
  await sendMail({ to: user.email, category: "security", logText: "A password reset was requested. The single-use link is hidden from the outbox.", subject: "Reset your password", text: `Hello ${user.name},\n\nWe received a request to reset your password. The link below works once and expires in ${RESET_MINUTES} minutes.\n\nIf you didn't ask for this, you can ignore this email.`, link: { label: "Choose a new password", url } });
  await audit(user.id, "RESET_REQUESTED", "User", user.id, ip);
  // Local development without a mail server: show the link so the flow can be tried end to end.
  if (process.env.NODE_ENV !== "production" && !mailConfigured()) return { ...done, message: `${done.message} (No mail server is configured, so here is the link for testing: ${url})` };
  return done;
}

export async function resetPassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const token = String(formData.get("token") ?? ""), password = String(formData.get("password") ?? ""), confirm = String(formData.get("confirm") ?? "");
  const row = token ? await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } }) : null;
  if (!row || row.usedAt || row.expiresAt < new Date()) return { error: "This reset link is invalid or has expired. Request a new one." };
  if (password !== confirm) return { fieldErrors: { confirm: ["Passwords do not match"] } };
  const problem = passwordProblem(password, [row.user.email.split("@")[0], row.user.name.split(" ")[0]]);
  if (problem) return { fieldErrors: { password: [problem] } };
  await db.$transaction([
    db.user.update({ where: { id: row.userId }, data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: false, passwordChangedAt: passwordChangedNow(), failedLogins: 0, lockedUntil: null } }),
    db.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  await audit(row.userId, "RESET_PASSWORD", "User", row.userId);
  notifyAcademic({ type: "security", id: row.userId, action: "Your password was changed using a recovery link.", version: row.id });
  redirect("/login?reset=1");
}
