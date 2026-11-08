/**
 * Número escrito por una persona: acepta coma o punto decimal ("82,15" o
 * "82.15") y espacios. Devuelve null si está vacío o no es un número.
 */
export function parseDecimal(text: string | null | undefined): number | null {
  if (text == null) return null;
  const t = String(text).trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
