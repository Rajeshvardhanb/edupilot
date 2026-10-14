import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getInstitution } from "./institution";
import { db } from "./db";

const A4 = { w: 595.28, h: 841.89 };
const M = 48;
const INK = rgb(0.06, 0.09, 0.16), MUTED = rgb(0.39, 0.45, 0.55), LINE = rgb(0.85, 0.88, 0.92);

/** The built-in PDF fonts cover Western characters only: swap the rupee sign and drop anything else unsupported. */
export const pdfText = (v: unknown) =>
  String(v ?? "").replace(/₹\s?/g, "Rs. ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[≥]/g, ">=").replace(/[≤]/g, "<=").replace(/→/g, "->").replace(/[^\x20-\x7E\xA0-\xFF–—·•]/g, "?");

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** A small layout helper over pdf-lib: a cursor that moves down the page and adds pages as needed. */
export class Doc {
  page!: PDFPage;
  y = 0;
  private constructor(public pdf: PDFDocument, public font: PDFFont, public bold: PDFFont, private landscape: boolean) {}

  static async create(opts: { landscape?: boolean } = {}) {
    const pdf = await PDFDocument.create();
    const doc = new Doc(pdf, await pdf.embedFont(StandardFonts.Helvetica), await pdf.embedFont(StandardFonts.HelveticaBold), !!opts.landscape);
    doc.addPage();
    return doc;
  }
  get width() { return this.landscape ? A4.h : A4.w; }
  get height() { return this.landscape ? A4.w : A4.h; }
  get inner() { return this.width - 2 * M; }

  addPage() {
    this.page = this.pdf.addPage([this.width, this.height]);
    this.y = this.height - M;
  }
  ensure(space: number) { if (this.y - space < M) this.addPage(); }

  text(s: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; align?: "left" | "right" | "center"; width?: number } = {}) {
    const size = opts.size ?? 10, font = opts.bold ? this.bold : this.font, str = pdfText(s);
    const boxX = opts.x ?? M, boxW = opts.width ?? this.inner, w = font.widthOfTextAtSize(str, size);
    const x = opts.align === "right" ? boxX + boxW - w : opts.align === "center" ? boxX + (boxW - w) / 2 : boxX;
    this.page.drawText(str, { x, y: this.y - size, size, font, color: opts.color ?? INK });
  }
  line(s: string, opts: Parameters<Doc["text"]>[1] = {}) {
    const size = opts.size ?? 10;
    this.ensure(size + 6);
    this.text(s, opts);
    this.y -= size + 6;
  }
  /** Word-wrapped paragraph. */
  paragraph(s: string, opts: { size?: number; leading?: number; bold?: boolean } = {}) {
    const size = opts.size ?? 11, leading = opts.leading ?? size * 1.7, font = opts.bold ? this.bold : this.font;
    let current = "";
    const flush = () => { this.ensure(leading); this.text(current, { size, bold: opts.bold }); this.y -= leading; current = ""; };
    for (const word of pdfText(s).split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > this.inner && current) { flush(); current = word; } else current = next;
    }
    if (current) flush();
  }
  rule(gap = 10) {
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: this.width - M, y: this.y }, thickness: 0.8, color: LINE });
    this.y -= gap;
  }
  space(n: number) { this.y -= n; }

  /** College header with the brand colour bar, name, affiliation and a right-aligned document title. */
  async letterhead(title?: string, serial?: string) {
    const inst = await getInstitution();
    this.page.drawRectangle({ x: 0, y: this.height - 10, width: this.width, height: 10, color: hexToRgb(/^#[0-9a-f]{6}$/i.test(inst.brandColor) && inst.brandColor.toLowerCase() !== "#4f46e5" ? inst.brandColor : "#2f5bea") });
    this.y -= 4;
    // Logo: the college's own if uploaded (PNG or JPEG), otherwise the EduPilot mark.
    let x = M;
    try {
      const own = inst.logoType === "image/png" || inst.logoType === "image/jpeg" ? await db.institution.findUnique({ where: { id: 1 }, select: { logo: true } }) : null;
      const image = own?.logo ? (inst.logoType === "image/png" ? await this.pdf.embedPng(own.logo) : await this.pdf.embedJpg(own.logo)) : await this.pdf.embedPng(await readFile(join(process.cwd(), "public/brand/mark-192.png")));
      const h = 40, w = Math.min(90, (image.width / image.height) * h);
      this.page.drawImage(image, { x: M, y: this.y - h + 2, width: w, height: h });
      x = M + w + 10;
    } catch {
      // No usable image: the text header stands on its own.
    }
    const textW = this.width - M - x;
    if (title) this.text(title.toUpperCase(), { size: 8, color: MUTED, align: "right", bold: true });
    this.text(inst.name.toUpperCase(), { size: 14, bold: true, x, width: textW });
    this.y -= 18;
    if (serial) this.text(serial, { size: 10, bold: true, align: "right" });
    this.text(inst.affiliation, { size: 8, color: MUTED, x, width: textW });
    this.y -= 11;
    if (inst.address) this.text(`${inst.address}${inst.phone ? ` · ${inst.phone}` : ""}`, { size: 8, color: MUTED, x, width: textW });
    this.y -= 15;
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: this.width - M, y: this.y }, thickness: 1.5, color: INK });
    this.y -= 18;
    return inst;
  }

  /** Label/value pairs in two columns. */
  pairs(rows: [string, string][], labelWidth = 130) {
    for (const [k, v] of rows) {
      this.ensure(18);
      this.text(k, { size: 10, color: MUTED });
      this.text(v, { size: 10, x: M + labelWidth, bold: true });
      this.y -= 17;
    }
  }

  /** Simple grid table with a header row repeated on each page; long cells are truncated to fit. */
  table(headers: string[], rows: (string | number)[][], opts: { widths?: number[]; size?: number } = {}) {
    const size = opts.size ?? 8, rowH = size + 9;
    const total = (opts.widths ?? headers.map(() => 1)).reduce((a, b) => a + b, 0);
    const widths = (opts.widths ?? headers.map(() => 1)).map((w) => (w / total) * this.inner);
    const fit = (s: string, w: number, font: PDFFont) => {
      let t = pdfText(s);
      while (t.length > 1 && font.widthOfTextAtSize(t, size) > w - 8) t = `${t.slice(0, -2).trimEnd()}.`;
      return t;
    };
    const drawRow = (cells: (string | number)[], header: boolean) => {
      this.ensure(rowH);
      if (header) this.page.drawRectangle({ x: M, y: this.y - rowH, width: this.inner, height: rowH, color: rgb(0.95, 0.96, 0.98) });
      let x = M;
      cells.forEach((c, i) => {
        const font = header ? this.bold : this.font;
        this.page.drawText(fit(String(c ?? ""), widths[i], font), { x: x + 4, y: this.y - rowH + 5, size, font, color: INK });
        x += widths[i];
      });
      this.page.drawLine({ start: { x: M, y: this.y - rowH }, end: { x: this.width - M, y: this.y - rowH }, thickness: 0.5, color: LINE });
      this.y -= rowH;
    };
    drawRow(headers, true);
    for (const r of rows) {
      if (this.y - rowH < M) { this.addPage(); drawRow(headers, true); }
      drawRow(r, false);
    }
  }

  /** Page numbers and a generated-on footer, then the finished file. */
  async finish(footer?: string) {
    const pages = this.pdf.getPages();
    pages.forEach((p, i) => {
      p.drawText(pdfText(footer ?? "Computer-generated document"), { x: M, y: 24, size: 7, font: this.font, color: MUTED });
      const label = `Page ${i + 1} of ${pages.length}`;
      p.drawText(label, { x: p.getWidth() - M - this.font.widthOfTextAtSize(label, 7), y: 24, size: 7, font: this.font, color: MUTED });
    });
    return this.pdf.save();
  }
}

export function pdfResponse(bytes: Uint8Array, filename: string) {
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.\-]/g, "_")}"`, "Cache-Control": "private, no-store" } });
}
