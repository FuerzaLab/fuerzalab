import * as XLSX from "xlsx";
import * as mammoth from "mammoth";

function norm(t: string): string {
  return String(t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Busca, para cada campo lógico, la columna del archivo cuyo encabezado coincide con alguno de sus alias. */
export function matchHeaders<T extends string>(headers: string[], aliases: Record<T, string[]>): Partial<Record<T, string>> {
  const map: Partial<Record<T, string>> = {};
  for (const key in aliases) {
    const found = headers.find((h) => aliases[key].some((a) => norm(h).includes(a)));
    if (found) map[key] = found;
  }
  return map;
}

/** Convierte filas de encabezado->valor (de Excel o una tabla de Word) en objetos según los alias de columna dados. */
export function rowsToRecords<T extends string>(
  rows: Record<string, any>[],
  aliases: Record<T, string[]>,
  requiredField: T
): Array<Record<T, string>> {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  const map = matchHeaders(headers, aliases);
  if (!map[requiredField]) return [];
  return rows
    .map((r) => {
      const out = {} as Record<T, string>;
      for (const key in aliases) {
        const col = map[key];
        out[key] = col ? String(r[col] ?? "").trim() : "";
      }
      return out;
    })
    .filter((r) => r[requiredField]);
}

export function htmlTableToRows(html: string): Record<string, any>[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table");
  if (!table) return [];
  const trs = Array.from(table.querySelectorAll("tr"));
  if (trs.length < 2) return [];
  const headers = Array.from(trs[0].querySelectorAll("th,td")).map((td) => td.textContent?.trim() ?? "");
  return trs.slice(1).map((tr) => {
    const cells = Array.from(tr.querySelectorAll("td,th")).map((td) => td.textContent?.trim() ?? "");
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => (obj[h] = cells[i] ?? ""));
    return obj;
  });
}

export async function parseExcelFile(file: File): Promise<Record<string, any>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

export async function parseWordTable(file: File): Promise<Record<string, any>[]> {
  const buf = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf });
  return htmlTableToRows(html);
}

export async function extractWordText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const { value: text } = await mammoth.extractRawText({ arrayBuffer: buf });
  return text;
}

/** Heurística simple línea por línea, para texto pegado (ej. copiado de un PDF) sin estructura de tabla. */
export function parseTextLines(text: string): Array<{ name: string; sets: string; reps: string; load: string }> {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines
    .map((line) => {
      let rest = line;
      let sets = "";
      let reps = "";
      let load = "";
      const setRep = rest.match(/(\d+)\s*[x×]\s*([\d\-–]+)/i);
      if (setRep) {
        sets = setRep[1];
        reps = setRep[2];
        rest = rest.replace(setRep[0], "").trim();
      }
      const loadM = rest.match(/([\d.,]+)\s*kg/i);
      if (loadM) {
        load = loadM[1].replace(",", ".");
        rest = rest.replace(loadM[0], "").trim();
      }
      const name = rest.replace(/^[\s\-–—:•·,]+|[\s\-–—:,]+$/g, "").trim();
      return { name, sets, reps, load };
    })
    .filter((r) => r.name);
}

export function fileKind(file: File): "excel" | "word" | "pdf" | "unknown" {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "xlsx" || ext === "xls") return "excel";
  if (ext === "docx") return "word";
  if (ext === "pdf") return "pdf";
  return "unknown";
}
