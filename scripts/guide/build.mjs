// Builds docs/EduPilot-Product-Guide.pdf from content.mjs and the screenshots in docs/product-guide/shots.
// Usage: node scripts/guide/capture.mjs   (once, with the app running)   then   node scripts/guide/build.mjs
import { chromium } from "@playwright/test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { CLOSING, FLOWS, PHONE, ROLES, SECTIONS } from "./content.mjs";

const ROOT = resolve(".");
const SHOTS = `${ROOT}/docs/product-guide/shots`;
const HTML = `${ROOT}/docs/product-guide/guide.html`;
const PDF = `${ROOT}/docs/EduPilot-Product-Guide.pdf`;
const DATE = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const img = (name) => { if (!existsSync(`${SHOTS}/${name}.jpg`)) throw new Error(`Missing screenshot: ${name}`); return `shots/${name}.jpg`; };
const data = (file, type) => `data:${type};base64,${readFileSync(file).toString("base64")}`;
const LOGO = data(`${ROOT}/public/brand/mark.png`, "image/png");
const COVER = data(`${ROOT}/public/images/login.jpg`, "image/jpeg");

const ROLE_CLASS = { Admin: "r-admin", HOD: "r-hod", Faculty: "r-faculty", Accounts: "r-accounts", Office: "r-office", Student: "r-student", Parent: "r-parent", System: "r-system" };
const chip = (r) => `<span class="role ${ROLE_CLASS[r]}">${r}</span>`;

let pageNo = 0;
const toc = [];
const page = (inner, { section = "", cls = "", bare = false } = {}) => {
  pageNo++;
  return `<section class="page ${cls}">${inner}${bare ? "" : `<footer><span><img src="${LOGO}" alt=""> EduPilot · Product guide</span><span>${esc(section)}</span><span>${pageNo}</span></footer>`}</section>`;
};

const stepsStrip = (steps) => !steps?.length ? "" : `<div class="flowstrip"><p class="label">How it works</p><ol>${steps.map((s, i) => `<li><b>${i + 1}</b><span>${esc(s)}</span></li>`).join('<i class="arrow">›</i>')}</ol></div>`;

function featurePage(sec, n, p) {
  const two = p.shots.length > 1;
  const head = `<header><p class="eyebrow">${esc(sec.title)} · ${n}</p><h2>${esc(p.title)}</h2><p class="lead">${esc(p.lead)}</p></header>`;
  const who = `<p class="label">Who uses it</p><p class="roles">${p.who.map(chip).join("")}</p>`;
  const points = `<p class="label">What it does</p><ul class="points">${p.points.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  // Two screenshots sit side by side across the page with the text beneath; one screenshot gets the text beside it.
  if (two) return page(`${head}<div class="shots two">${p.shots.map((s) => `<figure><img src="${img(s)}" alt=""></figure>`).join("")}</div>
    <div class="under"><div class="wide">${points}</div><div>${who}${stepsStrip(p.steps)}</div></div>`, { section: sec.title });
  const side = `<div class="side">${points}${who}</div>`;
  const shots = `<div class="shots one"><figure><img src="${img(p.shots[0])}" alt=""></figure>${stepsStrip(p.steps)}</div>`;
  return page(`${head}<div class="body b-one">${shots}${side}</div>`, { section: sec.title });
}

const parts = [];

// Cover
parts.push(page(`
  <div class="cover-bg" style="background-image:url(${COVER})"></div><div class="cover-veil"></div>
  <div class="cover-inner">
    <div class="brand"><span class="logo"><img src="${LOGO}" alt=""></span><span>EduPilot</span></div>
    <div>
      <p class="eyebrow light">Product guide</p>
      <h1>The complete college<br>management system</h1>
      <p class="cover-lead">For Engineering and Diploma colleges. Every feature, every screen and every workflow, from admission to placement.</p>
    </div>
    <p class="cover-foot">${DATE}</p>
  </div>`, { cls: "cover", bare: true }));

// Body pages are built first so the contents page can carry real page numbers.
const body = [];
pageNo = 3; // cover, contents, overview, roles come before; overview is page 3
const bodyStart = 4;
pageNo = bodyStart;

for (const sec of SECTIONS) {
  toc.push({ title: sec.title, page: pageNo + 1, items: sec.pages.map((p) => p.title) });
  body.push(page(`<div class="divider-inner"><p class="eyebrow light">Section ${toc.length}</p><h1>${esc(sec.title)}</h1><p class="cover-lead">${esc(sec.blurb)}</p><ul class="divider-list">${sec.pages.map((p) => `<li>${esc(p.title)}</li>`).join("")}</ul></div>`, { cls: "divider", bare: true }));
  sec.pages.forEach((p, i) => body.push(featurePage(sec, `${toc.length}.${i + 1}`, p)));
}

// Phone
toc.push({ title: PHONE.title, page: pageNo + 1, items: [] });
body.push(page(`<header><p class="eyebrow">Section ${toc.length}</p><h2>${esc(PHONE.title)}</h2><p class="lead">${esc(PHONE.lead)}</p></header>
  <div class="phones">${PHONE.shots.map(([s, c]) => `<figure><div class="phone"><img src="${img(s)}" alt=""></div><figcaption>${esc(c)}</figcaption></figure>`).join("")}</div>
  <ul class="points cols">${PHONE.points.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`, { section: PHONE.title }));

// Flows
toc.push({ title: "End-to-end workflows", page: pageNo + 1, items: FLOWS.map((f) => f.title) });
const flowNo = toc.length;
body.push(page(`<div class="divider-inner"><p class="eyebrow light">Section ${flowNo}</p><h1>End-to-end workflows</h1><p class="cover-lead">How the modules connect across a college year. Each step shows who does it.</p><ul class="divider-list">${FLOWS.map((f) => `<li>${esc(f.title)}</li>`).join("")}</ul></div>`, { cls: "divider", bare: true }));
for (let i = 0; i < FLOWS.length; i += 2) {
  body.push(page(FLOWS.slice(i, i + 2).map((f, k) => `
    <div class="flow"><header><p class="eyebrow">Workflow ${flowNo}.${i + k + 1}</p><h2>${esc(f.title)}</h2><p class="lead">${esc(f.lead)}</p></header>
    <ol class="flowgrid">${f.steps.map(([who, what, note], n) => `<li class="${ROLE_CLASS[who]}"><span class="n">${n + 1}</span>${chip(who)}<b>${esc(what)}</b><small>${esc(note)}</small></li>`).join("")}</ol></div>`).join(""), { section: "End-to-end workflows", cls: "flows" }));
}

// Closing
toc.push({ title: "Security, going live and scope", page: pageNo + 1, items: [] });
body.push(page(`<header><p class="eyebrow">Section ${toc.length}</p><h2>Security, going live and scope</h2><p class="lead">How the data is protected, what the college needs to provide, and what is deliberately outside this product.</p></header>
  <div class="closing">
    <div><p class="label">Security and reliability</p><ul class="points">${CLOSING.security.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
    <div><p class="label">What is needed to go live</p><dl>${CLOSING.golive.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join("")}</dl></div>
    <div><p class="label">Not included</p><ul class="points">${CLOSING.notIncluded.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <p class="label" style="margin-top:7mm">Try it</p><p class="note">The demonstration college has 424 students, 32 faculty, 5 departments and 8 programmes, with five semesters of history. Sign in as any role with the demo accounts to follow the workflows in this guide.</p></div>
  </div>`, { section: "Security, going live and scope" }));

// Front matter (fixed page numbers 2 and 3–4)
pageNo = 1;
const contents = page(`<header><p class="eyebrow">Contents</p><h2>What is in this guide</h2></header>
  <div class="toc">${toc.map((t, i) => `<div><p class="toc-h"><b>${i + 1}</b><span>${esc(t.title)}</span><i>${t.page}</i></p>${t.items.length ? `<ul>${t.items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</div>`).join("")}</div>`, { section: "Contents" });
const modules = SECTIONS.reduce((n, s) => n + s.pages.length, 0);
const overview = page(`<header><p class="eyebrow">Overview</p><h2>What EduPilot is</h2><p class="lead">One web application that runs the academic, administrative and financial work of an Engineering or Diploma college, for everyone from the principal to the parent.</p></header>
  <div class="overview">
    <div class="stats">
      <div><b>${ROLES.length}</b><span>roles, each with its own dashboard</span></div>
      <div><b>${modules}</b><span>feature areas described in this guide</span></div>
      <div><b>${FLOWS.length}</b><span>end-to-end workflows</span></div>
      <div><b>3</b><span>interface languages: English, Hindi, Telugu</span></div>
    </div>
    <div class="pillars">
      ${[["Academic", "Departments, programmes, batches, curriculum with L-T-P and credits, timetable, attendance with the 75% rule, marks, results with SGPA and CGPA, outcome attainment."],
        ["Administrative", "Admissions pipeline, student and staff records, leave, certificates, ID cards, hall tickets, library, hostel, transport, helpdesk, notices."],
        ["Financial", "Fee structures, invoices, instalments, late fines, counter and online collection, receipts, day book, scholarships."],
        ["Outcomes", "Placement drives with automatic eligibility, alumni records, a report builder, accreditation data sheets and scheduled email reports."]].map(([h, t]) => `<div><h3>${h}</h3><p>${t}</p></div>`).join("")}
    </div>
    <p class="note">Built for Indian Engineering (B.Tech, M.Tech) and Diploma (Polytechnic) colleges: semesters, lateral entry, internal and end-semester marks, condonation, backlogs and supplementary exams are part of the design.</p>
  </div>`, { section: "Overview" });
const roles = page(`<header><p class="eyebrow">Overview</p><h2>Who uses it</h2><p class="lead">Each person sees only the menu items, records and actions their role allows. The coloured tags below are used throughout this guide.</p></header>
  <table class="roles-table">${ROLES.map(([r, name, what]) => `<tr><td>${chip(r)}</td><th>${esc(name)}</th><td>${esc(what)}</td></tr>`).join("")}<tr><td>${chip("System")}</td><th>EduPilot itself</th><td>Steps the system carries out automatically, such as calculating grades, checking eligibility and sending notifications.</td></tr></table>`, { section: "Overview" });
if (pageNo !== bodyStart) throw new Error(`Front matter is ${pageNo} pages, expected ${bodyStart}`);

const css = `
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap");
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
:root { --ink: #0c1222; --muted: #505b74; --line: #e3e7f0; --soft: #f4f6fb; --b1: #1668f5; --b2: #4a28e6; }
body { font-family: Inter, system-ui, sans-serif; color: var(--ink); font-size: 9.6pt; line-height: 1.5; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1, h2, h3 { font-family: "Plus Jakarta Sans", Inter, sans-serif; letter-spacing: -0.02em; }
.page { position: relative; width: 297mm; height: 210mm; padding: 13mm 15mm 15mm; overflow: hidden; page-break-after: always; break-after: page; background: #fff; }
.page > header { margin-bottom: 6mm; }
.eyebrow { font-size: 7.6pt; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--b1); margin-bottom: 1.6mm; }
.eyebrow.light { color: rgb(255 255 255 / 0.75); }
h2 { font-size: 21pt; font-weight: 800; line-height: 1.15; }
.lead { margin-top: 1.8mm; font-size: 10.6pt; color: var(--muted); max-width: 210mm; }
.label { font-size: 7.4pt; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-bottom: 2.2mm; }
footer { position: absolute; left: 15mm; right: 15mm; bottom: 6.5mm; display: flex; justify-content: space-between; align-items: center; font-size: 7.4pt; color: #7a849b; border-top: 0.25mm solid var(--line); padding-top: 2.2mm; }
footer img { height: 3.6mm; vertical-align: -0.8mm; margin-right: 1mm; }
footer span:last-child { font-weight: 600; color: var(--ink); }

.body { display: grid; gap: 8mm; align-items: start; }
.b-one { grid-template-columns: 172mm 1fr; }
figure img { display: block; width: 100%; border-radius: 3mm; border: 0.25mm solid var(--line); box-shadow: 0 1.5mm 5mm -1.5mm rgb(16 24 64 / 0.22); }
.shots.two { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
.under { display: grid; grid-template-columns: 1fr 78mm; gap: 9mm; margin-top: 4.6mm; align-items: start; }
.under .wide .points { columns: 2; column-gap: 8mm; }
.under .wide .points li { break-inside: avoid; font-size: 9.1pt; margin-bottom: 1.7mm; }
.under .flowstrip { margin-top: 3mm; padding: 2.2mm 2.8mm 2.6mm; }
.under .flowstrip ol { flex-direction: column; align-items: stretch; gap: 0.9mm; }
.under .flowstrip .arrow { display: none; }
.under .flowstrip li { font-size: 8pt; padding: 0.8mm 2.2mm 0.8mm 1.4mm; }
.under .flowstrip .label { margin-bottom: 1.6mm; }
.points { list-style: none; }
.points li { position: relative; padding-left: 5mm; margin-bottom: 2.1mm; }
.points li::before { content: ""; position: absolute; left: 0.6mm; top: 1.9mm; width: 1.7mm; height: 1.7mm; border-radius: 50%; background: linear-gradient(135deg, var(--b1), var(--b2)); }
.side .label:not(:first-child) { margin-top: 5mm; }
.under .roles { margin-bottom: 0; }
.roles { display: flex; flex-wrap: wrap; gap: 1.5mm; }
.role { display: inline-block; font-size: 7.2pt; font-weight: 600; padding: 0.7mm 2.4mm; border-radius: 10mm; color: var(--c); background: color-mix(in srgb, var(--c) 11%, white); border: 0.2mm solid color-mix(in srgb, var(--c) 28%, white); }
.r-admin { --c: #3b33d6; } .r-hod { --c: #7c3aed; } .r-faculty { --c: #0f766e; } .r-accounts { --c: #b45309; } .r-student { --c: #1d4ed8; } .r-parent { --c: #be185d; } .r-office { --c: #0e7490; } .r-system { --c: #475569; }

.flowstrip { margin-top: 5mm; background: var(--soft); border: 0.25mm solid var(--line); border-radius: 3mm; padding: 3.2mm 4mm 3.6mm; }
.flowstrip ol { list-style: none; display: flex; flex-wrap: wrap; align-items: center; gap: 1.6mm 1.2mm; }
.flowstrip li { display: flex; align-items: center; gap: 1.8mm; background: #fff; border: 0.25mm solid var(--line); border-radius: 2.2mm; padding: 1.5mm 2.6mm 1.5mm 1.6mm; font-size: 8.4pt; font-weight: 500; }
.flowstrip li b { display: grid; place-items: center; width: 4.6mm; height: 4.6mm; border-radius: 50%; color: #fff; font-size: 7pt; background: linear-gradient(135deg, var(--b1), var(--b2)); flex: none; }
.flowstrip .arrow { font-style: normal; color: #9aa3b8; font-size: 11pt; line-height: 1; }
.side .flowstrip ol { flex-direction: column; align-items: stretch; }
.side .flowstrip .arrow { display: none; }

.cover, .divider { color: #fff; padding: 0; }
.cover-bg { position: absolute; inset: 0; background-size: cover; background-position: center; }
.cover-veil { position: absolute; inset: 0; background: linear-gradient(100deg, var(--b1) 0%, color-mix(in srgb, var(--b2) 94%, transparent) 42%, color-mix(in srgb, var(--b2) 45%, transparent) 72%, color-mix(in srgb, var(--b2) 12%, transparent) 100%); }
.cover-inner { position: relative; height: 100%; padding: 20mm 22mm; display: flex; flex-direction: column; justify-content: space-between; }
.brand { display: flex; align-items: center; gap: 3.5mm; font-family: "Plus Jakarta Sans"; font-weight: 800; font-size: 17pt; }
.logo { display: grid; place-items: center; width: 13mm; height: 13mm; background: #fff; border-radius: 3.4mm; }
.logo img { width: 10mm; }
.cover h1 { font-size: 40pt; font-weight: 800; line-height: 1.06; margin: 2mm 0 5mm; }
.cover-lead { font-size: 12.5pt; max-width: 150mm; color: rgb(255 255 255 / 0.9); }
.cover-foot { font-size: 9pt; color: rgb(255 255 255 / 0.8); letter-spacing: 0.08em; text-transform: uppercase; }
.divider { background: linear-gradient(135deg, var(--b1), var(--b2)); }
.divider::before { content: ""; position: absolute; right: -40mm; top: -40mm; width: 150mm; height: 150mm; border-radius: 50%; background: rgb(255 255 255 / 0.08); }
.divider::after { content: ""; position: absolute; right: 30mm; bottom: -60mm; width: 120mm; height: 120mm; border-radius: 50%; background: rgb(255 255 255 / 0.06); }
.divider-inner { position: relative; z-index: 1; height: 100%; padding: 30mm 24mm; display: flex; flex-direction: column; justify-content: center; }
.divider h1 { font-size: 34pt; font-weight: 800; margin-bottom: 4mm; }
.divider-list { list-style: none; margin-top: 10mm; display: grid; grid-template-columns: repeat(3, max-content); gap: 2.4mm 5mm; }
.divider-list li { font-size: 9.6pt; padding: 1.6mm 4mm; border-radius: 10mm; background: rgb(255 255 255 / 0.14); border: 0.25mm solid rgb(255 255 255 / 0.25); }

.toc { columns: 4; column-gap: 7mm; }
.toc > div { break-inside: avoid; margin-bottom: 3.6mm; }
.toc-h { display: flex; align-items: baseline; gap: 2mm; font-family: "Plus Jakarta Sans"; font-weight: 700; font-size: 9.4pt; border-bottom: 0.25mm solid var(--line); padding-bottom: 1mm; margin-bottom: 1.2mm; }
.toc-h b { color: var(--b1); } .toc-h span { flex: 1; } .toc-h i { font-style: normal; font-weight: 600; color: var(--muted); font-size: 9pt; }
.toc ul { list-style: none; } .toc li { font-size: 7.9pt; color: var(--muted); padding: 0.25mm 0 0.25mm 4.6mm; line-height: 1.35; }

.overview .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm; margin-bottom: 7mm; }
.stats div { border: 0.25mm solid var(--line); border-radius: 3.4mm; padding: 5mm; background: linear-gradient(160deg, #fff 55%, #eef2ff); }
.stats b { display: block; font-family: "Plus Jakarta Sans"; font-size: 28pt; font-weight: 800; line-height: 1; background: linear-gradient(135deg, var(--b1), var(--b2)); -webkit-background-clip: text; color: transparent; }
.stats span { display: block; margin-top: 2mm; color: var(--muted); font-size: 9pt; }
.pillars { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm; }
.pillars div { background: var(--soft); border-radius: 3.4mm; padding: 5mm; }
.pillars h3 { font-size: 11.5pt; margin-bottom: 1.6mm; } .pillars p { color: var(--muted); font-size: 9pt; }
.note { margin-top: 6mm; padding: 3.6mm 5mm; border-left: 1mm solid var(--b1); background: var(--soft); border-radius: 0 2.4mm 2.4mm 0; color: var(--muted); }
.closing .note { margin-top: 0; }

.roles-table { width: 100%; border-collapse: collapse; margin-top: 3mm; }
.roles-table td, .roles-table th { text-align: left; padding: 3.5mm 4mm; border-bottom: 0.25mm solid var(--line); vertical-align: top; font-size: 10pt; }
.roles-table th { font-family: "Plus Jakarta Sans"; width: 58mm; } .roles-table td:first-child { width: 28mm; } .roles-table td:last-child { color: var(--muted); }

.phones { display: grid; grid-template-columns: repeat(5, 1fr); gap: 7mm; margin: 2mm 6mm 6mm; }
.phone { border: 1.6mm solid #10162b; border-radius: 6mm; overflow: hidden; box-shadow: 0 3mm 8mm -3mm rgb(16 24 64 / 0.4); }
.phone img { display: block; width: 100%; border: 0; border-radius: 0; box-shadow: none; }
.phones figcaption { text-align: center; margin-top: 2.4mm; font-size: 8.6pt; font-weight: 600; }
.points.cols { columns: 2; column-gap: 12mm; margin: 0 6mm; }
.points.cols li { break-inside: avoid; }

.flows { display: flex; flex-direction: column; gap: 7mm; }
.flow header { margin-bottom: 4mm; } .flow h2 { font-size: 17pt; }
.flowgrid { list-style: none; display: grid; grid-template-columns: repeat(5, 1fr); gap: 3.4mm; }
.flowgrid li { position: relative; border: 0.25mm solid color-mix(in srgb, var(--c) 26%, white); border-top: 1mm solid var(--c); background: color-mix(in srgb, var(--c) 4%, white); border-radius: 2.6mm; padding: 3mm 3.4mm 3.2mm; min-height: 25mm; }
.flowgrid .n { position: absolute; right: 3mm; top: 2.4mm; font-family: "Plus Jakarta Sans"; font-weight: 800; font-size: 13pt; color: color-mix(in srgb, var(--c) 30%, white); }
.flowgrid b { display: block; margin-top: 1.8mm; font-size: 9pt; line-height: 1.3; } .flowgrid small { display: block; margin-top: 1mm; font-size: 7.8pt; color: var(--muted); line-height: 1.35; }

.closing { display: grid; grid-template-columns: 1fr 1.15fr 1fr; gap: 9mm; }
dl dt { font-weight: 600; margin-top: 2.6mm; } dl dt:first-child { margin-top: 0; } dl dd { color: var(--muted); font-size: 9pt; }
`;

writeFileSync(HTML, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>EduPilot — Product guide</title><style>${css}</style></head><body>${parts.join("")}${contents}${overview}${roles}${body.join("")}</body></html>`);

const browser = await chromium.launch();
const tab = await browser.newPage();
await tab.goto(`file://${HTML}`, { waitUntil: "networkidle" });
await tab.evaluate(() => document.fonts.ready);
// Report any page whose content is taller than the sheet, so nothing is silently cut off.
const over = await tab.evaluate(() => [...document.querySelectorAll(".page")].map((p, i) => [i + 1, p.scrollHeight - p.clientHeight, p.querySelector("h2, h1")?.textContent]).filter((x) => x[1] > 2 && !/^(Getting|Dashboards|People|Academic set|Daily|Examinations|Fees and|Campus|Reports and|End-to-end)/.test(x[2])));
await tab.pdf({ path: PDF, width: "297mm", height: "210mm", printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log(`pages: ${parts.length + 3 + body.length}  →  ${PDF}`);
if (over.length) console.log("OVERFLOWING PAGES:", JSON.stringify(over));
