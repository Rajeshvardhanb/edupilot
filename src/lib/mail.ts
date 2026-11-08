import "server-only";
import { createHash } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";
import { z } from "zod";
import { db } from "./db";
import { getInstitution } from "./institution";
import { renderEmail, type EmailContent } from "./email-template";

export const mailConfigured = () => !!process.env.SMTP_HOST?.trim();
let transporter: Transporter | null = null;
function transport() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST?.trim(), port, secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER.trim(), pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    });
  }
  return transporter;
}
export type Mail = EmailContent & { to: string; /** Stable event key prevents duplicate sends, including concurrent requests. */ key?: string; /** Codes and reset tokens must not remain in the outbox. */ logText?: string };
export type MailStatus = "SENT" | "FAILED" | "NOT_CONFIGURED" | "SKIPPED";
export const PRIVATE_EMAIL_LOG = "[PRIVATE CONTENT OMITTED]";

/** Reserve an outbox row before SMTP; mail failures never undo the academic operation. */
export async function sendMail(mail: Mail): Promise<MailStatus> {
  const to = mail.to.trim().toLowerCase();
  const id = mail.key ? `mail_${createHash("sha256").update(`${mail.key}:${to}`).digest("hex")}` : undefined;
  let row: { id: string };
  try {
    row = await db.emailLog.create({ data: { ...(id ? { id } : {}), to, subject: mail.subject.slice(0, 190), body: mail.logText ? `${PRIVATE_EMAIL_LOG}\n${mail.logText}` : [mail.text, ...(mail.details ?? []).map(d => `${d.label}: ${d.value}`), ...(mail.link ? [`${mail.link.label}: ${mail.link.url}`] : [])].join("\n"), status: "SENDING" } });
  } catch (e) {
    if (id && typeof e === "object" && e !== null && "code" in e && e.code === "P2002") return "SKIPPED";
    console.error("Email could not be recorded; delivery was not attempted.");
    return "FAILED";
  }
  let status: Exclude<MailStatus, "SKIPPED"> = "NOT_CONFIGURED";
  let error: string | null = null;
  try {
    if (!z.email().safeParse(to).success || /[\r\n]/.test(mail.subject)) throw new Error("Invalid recipient address or subject.");
    if (mailConfigured()) {
      const inst = await getInstitution();
      const rendered = renderEmail(mail, inst);
      const result = await transport().sendMail({ from: process.env.SMTP_FROM?.trim() || `"${inst.shortName}" <${process.env.SMTP_USER}>`, to, subject: mail.subject, ...rendered });
      if (!result.accepted?.length || result.rejected?.length) throw new Error("SMTP server did not accept the recipient.");
      status = "SENT";
    }
  } catch (e) {
    status = "FAILED";
    error = e instanceof Error ? e.message.slice(0, 500) : "Email delivery failed.";
    if (process.env.SMTP_PASS) error = error.replaceAll(process.env.SMTP_PASS, "[redacted]");
  }
  try { await db.emailLog.update({ where: { id: row.id }, data: { status, error } }); }
  catch { console.error("Email outcome could not be recorded; check the SENDING outbox row before resending."); }
  return status;
}

export function appUrl(path: string) {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
}
