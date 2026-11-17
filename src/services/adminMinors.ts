import { supabase } from "../lib/supabase";

/** Fila del panel "Menores de edad" del Super Admin (admin_minors_overview, part4p). */
export interface MinorOverviewRow {
  client_id: string;
  client_name: string;
  client_status: string;
  client_created_at: string;
  has_account: boolean;
  form_submitted_at: string | null;
  birth_date: string | null;
  is_minor: boolean;
  consent_at: string | null;
  consent_path: string | null;
  photos_ok: boolean;
  age_confirmed_at: string | null;
  organization_id: string;
  organization_name: string;
  trainer_id: string;
  trainer_name: string | null;
  trainer_phone: string | null;
}

export async function fetchMinorsOverview(): Promise<MinorOverviewRow[]> {
  const { data, error } = await supabase.rpc("admin_minors_overview");
  if (error) {
    if (/admin_minors_overview/.test(error.message)) throw new Error("Falta correr part4p_migration.sql en Supabase.");
    throw error;
  }
  return (data ?? []) as MinorOverviewRow[];
}

/** Enlace temporal (10 min) para abrir una autorización subida. */
export async function consentDocUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("client-files").createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw error ?? new Error("No se pudo abrir el archivo.");
  return data.signedUrl;
}
