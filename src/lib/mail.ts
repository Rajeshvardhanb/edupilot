import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { db } from "./db";
import { getInstitution } from "./institution";

/**
 * Email goes out through any SMTP server (Gmail, Outlook, your host…) set in .env:
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM. Without those, messages are
 * recorded in the outbox (Administration → Email outbox) but not delivered.
 */
export const mailConfigured = () => !!process.env.SMTP_HOST;

let transporter: Transporter | null = null;
function transport() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const isRealAddress = (to: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to);

export type Mail = { to: string; subject: string; text: string; link?: { label: string; url: string } };

/** Sends one email and always writes it to the outbox. Never throws: alerts must not break the action that triggered them. */
export async function sendMail(mail: Mail): Promise<"SENT" | "FAILED" | "NOT_CONFIGURED"> {
  let status: "SENT" | "FAILED" | "NOT_CONFIGURED" = "NOT_CONFIGURED";
  let error: string | null = null;
  const body = mail.link ? `${mail.text}\n\n${mail.link.label}: ${mail.link.url}` : mail.text;
  try {
    if (mailConfigured() && isRealAddress(mail.to)) {
      const inst = await getInstitution();
      const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;color:#0f172a">
        <div style="background:${inst.brandColor};color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-weight:600">${escapeHtml(inst.name)}</div>
        <div style="border:1px solid #e5e9f0;border-top:0;padding:20px;border-radius:0 0 12px 12px">
          <h2 style="margin:0 0 12px;font-size:17px">${escapeHtml(mail.subject)}</h2>
          <p style="white-space:pre-line;line-height:1.6;margin:0">${escapeHtml(mail.text)}</p>
          ${mail.link ? `<p style="margin:20px 0 0"><a href="${escapeHtml(mail.link.url)}" style="background:${inst.brandColor};color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${escapeHtml(mail.link.label)}</a></p>` : ""}
        </div>
        <p style="color:#64748b;font-size:12px;margin-top:12px">This is an automated message from ${escapeHtml(inst.name)}.</p></div>`;
      await transport().sendMail({ from: process.env.SMTP_FROM ?? `"${inst.shortName}" <${process.env.SMTP_USER}>`, to: mail.to, subject: mail.subject, text: body, html });
      status = "SENT";
    }
  } catch (e) {
    status = "FAILED";
    error = e instanceof Error ? e.message.slice(0, 500) : String(e);
  }
  try {
    await db.emailLog.create({ data: { to: mail.to, subject: mail.subject.slice(0, 190), body, status, error } });
  } catch (e) {
    console.error("email log failed", e);
  }
  return status;
}

/** Absolute URL for links inside emails. Set APP_URL in production. */
export function appUrl(path: string) {
  return `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;
}
