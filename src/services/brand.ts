import { supabase } from "../lib/supabase";

/**
 * Marca de la organización (el negocio del entrenador o el estudio): nombre
 * y logo, que se muestran junto a FuerzaLab con el mismo peso. Ver
 * part3s_migration.sql.
 */
export interface OrgBrand {
  name: string | null;
  logoPath: string | null;
  logoUrl: string | null;
}

const BUCKET = "brand-assets";

export function brandLogoUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function getOrgBrand(orgId: string): Promise<OrgBrand> {
  const { data, error } = await supabase.from("organizations").select("logo_path, settings").eq("id", orgId).maybeSingle();
  if (error || !data) return { name: null, logoPath: null, logoUrl: null };
  const name = ((data.settings as any)?.brand_name as string | undefined)?.trim() || null;
  const logoPath = (data.logo_path as string | null) ?? null;
  return { name, logoPath, logoUrl: brandLogoUrl(logoPath) };
}

export async function uploadBrandLogo(orgId: string, file: File): Promise<string> {
  if (file.size > 2 * 1024 * 1024) throw new Error("El logo puede pesar hasta 2 MB.");
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${orgId}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    if (/bucket/i.test(error.message)) throw new Error("Falta correr part3s_migration.sql en Supabase.");
    throw error;
  }
  return path;
}

export async function saveOrgBrand(params: { name: string; logoPath: string | null; previousLogoPath: string | null }): Promise<void> {
  const { error } = await supabase.rpc("set_organization_brand", { p_brand_name: params.name, p_logo_path: params.logoPath });
  if (error) {
    if (/set_organization_brand/i.test(error.message)) throw new Error("Falta correr part3s_migration.sql en Supabase.");
    throw error;
  }
  // El logo anterior ya no se usa: se borra (si falla, no importa).
  if (params.previousLogoPath && params.previousLogoPath !== params.logoPath) {
    await supabase.storage.from(BUCKET).remove([params.previousLogoPath]).catch(() => {});
  }
  notifyBrandChanged();
}

// Aviso entre pantallas: cuando el entrenador guarda su marca, el encabezado
// se actualiza sin recargar la página.
const listeners = new Set<() => void>();
export function onBrandChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notifyBrandChanged() {
  for (const fn of listeners) fn();
}

/** Iniciales para cuando la marca no tiene logo: "Training Rodas" → "TR". */
export function brandInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2)).toUpperCase();
}
