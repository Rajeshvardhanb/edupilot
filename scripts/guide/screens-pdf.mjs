// Builds docs/EduPilot-All-Screens.pdf from docs/screens (run scripts/guide/screens.mjs first).
// A4 landscape: cover, contents, every desktop screen grouped by role (long pages continue on the next sheet),
// then phone screens three to a page.
import { readFileSync, writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const DIR = "docs/screens";
const OUT = "docs/EduPilot-All-Screens.pdf";
const { screens, generated } = JSON.parse(readFileSync(`${DIR}/manifest.json`, "utf8"));
const COLLEGE = process.env.COLLEGE ?? "Sri Vasavi Institute of Engineering & Technology (demo data)";

const PW = 842, PH = 595, M = 20, HEAD = 46, FOOT = 22;
const INK = rgb(0.05, 0.07, 0.13), MUTED = rgb(0.38, 0.42, 0.5), LINE = rgb(0.88, 0.9, 0.94), BRAND = rgb(0.04, 0.29, 0.64), BG = rgb(0.965, 0.97, 0.98);

const pdf = await PDFDocument.create();
pdf.setTitle("EduPilot — every screen");
pdf.setAuthor("EduPilot");
const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
// The standard PDF font covers Western characters only: anything else is spelled out or dropped.
const safe = (s, f = font) => [...String(s).replace(/₹/g, "Rs ").replace(/→/g, "->").replace(/←/g, "<-").replace(/[–]/g, "-")]
  .map((c) => { try { f.encodeText(c); return c; } catch { return ""; } }).join("").replace(/\s+/g, " ").trim();
const fit = (s, f, size, max) => { let t = safe(s, f); while (t.length > 3 && f.widthOfTextAtSize(t, size) > max) t = t.slice(0, -2); return t === safe(s, f) ? t : `${t.trimEnd()}…`.replace("…", "..."); };

// Drop any slice the PDF library cannot read (a few-pixel sliver at the very bottom of a page).
{
  const probe = await PDFDocument.create();
  for (const s of screens) {
    const ok = [];
    for (const f of s.files) { try { await probe.embedJpg(readFileSync(`${DIR}/${f}`)); ok.push(f); } catch { /* skipped */ } }
    s.files = ok;
  }
}

const ORDER = ["Before signing in", "Administrator", "Head of Department", "Faculty", "Accounts Officer", "Office Staff", "Student", "Parent"];
const desktop = ORDER.flatMap((r) => screens.filter((s) => s.kind === "desktop" && s.role === r && s.files.length));
const phone = ["Student", "Parent", "Faculty"].flatMap((r) => screens.filter((s) => s.kind === "phone" && s.role === r));

// Plan the page numbers first so the contents can list them.
const COVER_PAGES = 1, PER_CONTENTS_PAGE = 2 * 28;
const sectionsList = [...ORDER.filter((r) => desktop.some((s) => s.role === r)).map((r) => ({ name: r, items: desktop.filter((s) => s.role === r) })), { name: "On a phone", items: phone }];
const contentsLines = sectionsList.reduce((s, sec) => s + 1 + sec.items.length, 0);
const CONTENTS_PAGES = Math.ceil(contentsLines / PER_CONTENTS_PAGE);
let pageNo = COVER_PAGES + CONTENTS_PAGES;
for (const s of desktop) { s.page = pageNo + 1; pageNo += s.files.length; }
const PHONE_PER_PAGE = 3;
phone.forEach((s, i) => { s.page = pageNo + 1 + Math.floor(i / PHONE_PER_PAGE); });

function footer(page, n) {
  page.drawLine({ start: { x: M, y: FOOT }, end: { x: PW - M, y: FOOT }, thickness: 0.5, color: LINE });
  page.drawText("EduPilot · every screen", { x: M, y: 8, size: 8, font, color: MUTED });
  const t = String(n);
  page.drawText(t, { x: PW - M - font.widthOfTextAtSize(t, 8), y: 8, size: 8, font, color: MUTED });
}

// Cover
{
  const page = pdf.addPage([PW, PH]);
  page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: BG });
  page.drawRectangle({ x: 60, y: 360, width: 48, height: 4, color: BRAND });
  page.drawText("EduPilot", { x: 60, y: 380, size: 14, font: bold, color: BRAND });
  page.drawText("Every screen in the application", { x: 60, y: 315, size: 30, font: bold, color: INK });
  page.drawText(safe(COLLEGE), { x: 60, y: 288, size: 13, font, color: MUTED });
  const counts = [["Screens", desktop.length], ["Phone views", phone.length], ["Roles", sectionsList.length - 1]];
  counts.forEach(([k, v], i) => {
    page.drawText(String(v), { x: 60 + i * 150, y: 215, size: 26, font: bold, color: INK });
    page.drawText(k, { x: 60 + i * 150, y: 197, size: 10, font, color: MUTED });
  });
  const date = new Date(generated).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  page.drawText(safe(`Captured from the application on ${date}. Desktop screens at 1280 px wide; phone screens at 390 px.`), { x: 60, y: 120, size: 10, font, color: MUTED });
  page.drawText("Each role sees only what it is allowed to; screens shared with the administrator are shown once, under Administrator.", { x: 60, y: 104, size: 10, font, color: MUTED });
}

// Contents, two columns
{
  const lines = sectionsList.flatMap((sec) => [{ head: sec.name, count: sec.items.length, page: sec.items[0]?.page }, ...sec.items.map((s) => ({ text: s.title, page: s.page }))]);
  let page, col = 0, y = 0, used = 0, pageIndex = COVER_PAGES;
  const colW = (PW - 2 * 48 - 30) / 2;
  for (const l of lines) {
    if (!page || used === PER_CONTENTS_PAGE) {
      page = pdf.addPage([PW, PH]); pageIndex++; footer(page, pageIndex); used = 0; col = 0; y = PH - 92;
      page.drawText("Contents", { x: 48, y: PH - 62, size: 18, font: bold, color: INK });
    }
    if (used === PER_CONTENTS_PAGE / 2 && col === 0) { col = 1; y = PH - 92; }
    const x = 48 + col * (colW + 30);
    const num = String(l.page ?? "");
    if (l.head) {
      page.drawText(safe(`${l.head} (${l.count})`, bold), { x, y, size: 10, font: bold, color: BRAND });
    } else {
      page.drawText(fit(l.text, font, 9, colW - 40), { x: x + 10, y, size: 9, font, color: INK });
    }
    page.drawText(num, { x: x + colW - font.widthOfTextAtSize(num, 9), y, size: 9, font: l.head ? bold : font, color: MUTED });
    y -= 16.5; used++;
  }
}

// Desktop screens
let current = COVER_PAGES + CONTENTS_PAGES;
const imgW = PW - 2 * M, imgTop = PH - HEAD;
for (const s of desktop) {
  for (const [i, file] of s.files.entries()) {
    const page = pdf.addPage([PW, PH]);
    current++;
    page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: BG });
    const title = s.files.length > 1 ? `${s.title}  (${i + 1} of ${s.files.length})` : s.title;
    page.drawText(safe(s.role.toUpperCase(), bold), { x: M, y: PH - 18, size: 7.5, font: bold, color: BRAND });
    page.drawText(fit(title, bold, 13, PW - 2 * M - 220), { x: M, y: PH - 35, size: 13, font: bold, color: INK });
    const path = fit(s.path, font, 9, 210);
    page.drawText(path, { x: PW - M - font.widthOfTextAtSize(path, 9), y: PH - 35, size: 9, font, color: MUTED });
    const img = await pdf.embedJpg(readFileSync(`${DIR}/${file}`));
    const scale = imgW / img.width;
    const h = Math.min(img.height * scale, imgTop - FOOT - 8);
    page.drawRectangle({ x: M - 0.5, y: imgTop - h - 0.5, width: imgW + 1, height: h + 1, color: LINE });
    page.drawImage(img, { x: M, y: imgTop - h, width: imgW, height: h });
    if (i === s.files.length - 1 && s.truncated) page.drawText("Page continues; first part shown.", { x: M, y: FOOT + 4, size: 7.5, font, color: MUTED });
    footer(page, current);
  }
}

// Phone screens, three per page
for (let i = 0; i < phone.length; i += PHONE_PER_PAGE) {
  const page = pdf.addPage([PW, PH]);
  current++;
  page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: BG });
  page.drawText("ON A PHONE", { x: M, y: PH - 18, size: 7.5, font: bold, color: BRAND });
  const group = phone.slice(i, i + PHONE_PER_PAGE);
  page.drawText(safe(`${group[0].role}${group.some((g) => g.role !== group[0].role) ? " and others" : ""}`), { x: M, y: PH - 35, size: 13, font: bold, color: INK });
  const boxH = PH - HEAD - FOOT - 34, slotW = (PW - 2 * M) / PHONE_PER_PAGE;
  for (const [j, s] of group.entries()) {
    const img = await pdf.embedJpg(readFileSync(`${DIR}/${s.files[0]}`));
    const scale = Math.min(boxH / img.height, (slotW - 30) / img.width);
    const w = img.width * scale, h = img.height * scale;
    const x = M + j * slotW + (slotW - w) / 2, y = FOOT + 26;
    page.drawRectangle({ x: x - 1, y: y - 1, width: w + 2, height: h + 2, color: LINE });
    page.drawImage(img, { x, y, width: w, height: h });
    const cap = fit(`${s.role} · ${s.title}`, font, 8.5, slotW - 20);
    page.drawText(cap, { x: M + j * slotW + (slotW - font.widthOfTextAtSize(cap, 8.5)) / 2, y: FOOT + 10, size: 8.5, font, color: INK });
  }
  footer(page, current);
}

writeFileSync(OUT, await pdf.save());
console.log(`${OUT}: ${pdf.getPageCount()} pages, ${desktop.length} desktop screens, ${phone.length} phone views`);
