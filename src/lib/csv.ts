/** Minimal RFC-4180 CSV parser (quoted fields, escaped quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

/** Rows of a CSV with a header line, as objects keyed by header. `line` is the line number in the file. */
export function csvRecords(text: string): { header: string[]; records: { line: number; data: Record<string, string> }[] } {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  const header = (rows.shift() ?? []).map((h) => h.trim());
  return { header, records: rows.map((cells, i) => ({ line: i + 2, data: Object.fromEntries(header.map((h, j) => [h, cells[j]?.trim() ?? ""])) })) };
}
