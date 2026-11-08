/** Pure, escaped HTML/text rendering for transactional emails. No remote assets required. */
export type EmailCategory = "account" | "security" | "academic" | "request" | "learning" | "placement" | "system";
export type EmailContent = {
  subject: string;
  text: string;
  category?: EmailCategory;
  code?: string;
  link?: { label: string; url: string };
  details?: { label: string; value: string }[];
};
const labels: Record<EmailCategory, string> = { account: "Your account", security: "Account security", academic: "Academic update", request: "Request update", learning: "Teaching & learning", placement: "Placement update", system: "System notification" };
export const escapeEmailHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export function renderEmail(content: EmailContent, college: { name: string; brandColor: string }) {
  const e = escapeEmailHtml;
  const color = /^#[0-9a-f]{6}$/i.test(college.brandColor) ? college.brandColor : "#7135d8";
  const category = labels[content.category ?? "system"];
  let link = content.link;
  if (link) { try { if (!["http:", "https:"].includes(new URL(link.url).protocol)) link = undefined; } catch { link = undefined; } }
  const details = content.details ?? [];
  const text = [college.name, category, "", content.subject, "", content.text, ...(content.code ? ["", `Verification code: ${content.code}`] : []), ...details.map(d => `${d.label}: ${d.value}`), ...(link ? ["", `${link.label}: ${link.url}`] : []), "", `This is an automated message from ${college.name}. Sign in to the student management system to review the latest record.`].join("\n");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(content.subject)}</title></head><body style="margin:0;padding:0;background:#f3effa;color:#202039;font-family:Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${e(content.subject)} — ${e(college.name)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3effa"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;background:#fff;border:1px solid #e5dced;border-radius:16px">
<tr><td style="padding:24px;background:${color};border-radius:16px 16px 0 0;color:#fff"><p style="margin:0 0 8px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase">Student Management System</p><p style="margin:0;font-size:19px;font-weight:bold;line-height:1.4">${e(college.name)}</p></td></tr>
<tr><td style="padding:28px 24px"><p style="margin:0 0 12px;color:${color};font-size:12px;font-weight:bold;text-transform:uppercase">${category}</p><h1 style="margin:0 0 18px;font-size:23px;line-height:1.3">${e(content.subject)}</h1>${content.text.split(/\n\s*\n/).map(p => `<p style="margin:0 0 16px;font-size:15px;line-height:1.7">${e(p).replace(/\n/g, "<br>")}</p>`).join("")}
${content.code ? `<div style="margin:20px 0;padding:20px;text-align:center;border:1px solid #d8caed;background:#f6f0ff;border-radius:10px;font-size:30px;font-weight:bold;letter-spacing:6px">${e(content.code)}</div>` : ""}
${details.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0;border-top:1px solid #ece5f4">${details.map(d => `<tr><td style="padding:10px 6px 10px 0;font-size:13px;color:#626278;vertical-align:top">${e(d.label)}</td><td style="padding:10px 0;font-size:13px;font-weight:bold;text-align:right;overflow-wrap:anywhere">${e(d.value)}</td></tr>`).join("")}</table>` : ""}
${link ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0"><tr><td bgcolor="${color}" style="border-radius:8px"><a href="${e(link.url)}" style="display:inline-block;padding:14px 22px;color:#fff;font-size:14px;font-weight:bold;text-decoration:none">${e(link.label)}</a></td></tr></table><p style="font-size:11px;line-height:1.6;color:#626278;overflow-wrap:anywhere">If the button does not work, copy this address into your browser:<br><a href="${e(link.url)}" style="color:${color}">${e(link.url)}</a></p>` : ""}
</td></tr><tr><td style="padding:18px 24px;border-top:1px solid #ece5f4;color:#626278;font-size:11px;line-height:1.7">This is an automated message from ${e(college.name)}. Please sign in to review the latest record. Never share your password or verification code.</td></tr></table>
</td></tr></table></body></html>`;
  return { html, text };
}
