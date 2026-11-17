import { supabase } from "../lib/supabase";

export type PhotoVisibility = "trainer_only" | "client_and_trainer";
export type PhotoAngle = "front" | "back" | "left" | "right";

export const ANGLE_LABEL: Record<PhotoAngle, string> = {
  front: "De frente",
  back: "De espalda",
  left: "Lado izquierdo",
  right: "Lado derecho",
};

export const ANGLE_ORDER: PhotoAngle[] = ["front", "back", "left", "right"];

export interface ProgressPhotoRow {
  id: string;
  client_id: string;
  storage_path: string;
  taken_at: string | null;
  visibility: PhotoVisibility;
  notes: string | null;
  angle: PhotoAngle | null;
  created_at: string;
  /** El alumno la marcó "solo para mí": nadie más la ve (part4r). */
  client_private?: boolean;
  uploaded_by?: string | null;
}

const BASE_COLS = "id, client_id, storage_path, taken_at, visibility, notes, angle, created_at";
const COLS = BASE_COLS + ", client_private, uploaded_by";
/** Sin part4r_migration.sql todavía no existe client_private: se reintenta sin esa columna. */
const missingPrivate = (e: any) => /client_private/.test(e?.message ?? "");

export async function listProgressPhotos(clientId: string): Promise<ProgressPhotoRow[]> {
  const q = (cols: string) =>
    supabase
      .from("client_files")
      .select(cols)
      .eq("client_id", clientId)
      .eq("kind", "progress_photo")
      .order("taken_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
  let { data, error } = await q(COLS);
  if (error && missingPrivate(error)) ({ data, error } = await q(BASE_COLS));
  if (error) throw error;
  return (data ?? []) as unknown as ProgressPhotoRow[];
}

export async function uploadProgressPhoto(params: {
  organizationId: string;
  clientId: string;
  file: File;
  takenAt: string;
  notes: string;
  visibility: PhotoVisibility;
  angle: PhotoAngle | null;
  /** Solo el alumno: "solo para mí" (part4r). */
  clientPrivate?: boolean;
}): Promise<ProgressPhotoRow> {
  const path = `${params.organizationId}/${params.clientId}/progress-photos/${Date.now()}-${params.file.name}`;
  const { error: upErr } = await supabase.storage.from("client-files").upload(path, params.file, { upsert: false });
  if (upErr) throw upErr;

  const row: Record<string, unknown> = {
    organization_id: params.organizationId,
    client_id: params.clientId,
    kind: "progress_photo",
    storage_path: path,
    taken_at: params.takenAt || null,
    visibility: params.visibility,
    notes: params.notes || null,
    angle: params.angle,
  };
  if (params.clientPrivate) row.client_private = true;
  const { data, error } = await supabase.from("client_files").insert(row).select(params.clientPrivate ? COLS : BASE_COLS).single();
  if (error) {
    // Rechazada (por ejemplo, alumno menor sin fotos autorizadas): no deja el archivo suelto.
    await supabase.storage.from("client-files").remove([path]).catch(() => {});
    throw error;
  }
  return data as unknown as ProgressPhotoRow;
}

/** Sube hasta 4 fotos (una por ángulo) de una sola vez, compartiendo fecha, notas y visibilidad. Sube las que vengan; no hace falta completar las 4. */
export async function uploadProgressPhotoSet(params: {
  organizationId: string;
  clientId: string;
  files: Partial<Record<PhotoAngle, File>>;
  takenAt: string;
  notes: string;
  visibility: PhotoVisibility;
  clientPrivate?: boolean;
}): Promise<ProgressPhotoRow[]> {
  const entries = ANGLE_ORDER.filter((a) => params.files[a]).map((angle) =>
    uploadProgressPhoto({
      organizationId: params.organizationId,
      clientId: params.clientId,
      file: params.files[angle]!,
      takenAt: params.takenAt,
      notes: params.notes,
      visibility: params.visibility,
      angle,
      clientPrivate: params.clientPrivate,
    })
  );
  return Promise.all(entries);
}

/** Agrupa las fotos por fecha (o por minuto de subida si no tienen fecha) en "sesiones" de hasta 4 ángulos. */
export function groupPhotosBySession(photos: ProgressPhotoRow[]): { key: string; date: string | null; photos: ProgressPhotoRow[] }[] {
  const byKey = new Map<string, ProgressPhotoRow[]>();
  for (const p of photos) {
    const key = p.taken_at ?? p.created_at.slice(0, 16);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(p);
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, ps]) => ({ key, date: ps[0].taken_at, photos: ps.sort((a, b) => ANGLE_ORDER.indexOf(a.angle ?? "front") - ANGLE_ORDER.indexOf(b.angle ?? "front")) }));
}

export async function getPhotoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("client-files").createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function setPhotoVisibility(id: string, visibility: PhotoVisibility): Promise<void> {
  const { error } = await supabase.from("client_files").update({ visibility }).eq("id", id);
  if (error) throw error;
}

export async function deleteProgressPhoto(id: string, storagePath: string): Promise<void> {
  const { error: delErr } = await supabase.from("client_files").delete().eq("id", id);
  if (delErr) throw delErr;
  // El storage no bloquea si falla (el archivo puede haber quedado huérfano antes); no es crítico.
  await supabase.storage.from("client-files").remove([storagePath]);
}

/** Fotos de progreso de un cliente con una fecha puntual (las de una evaluación). */
export async function listPhotosOnDate(clientId: string, date: string): Promise<ProgressPhotoRow[]> {
  const q = (cols: string) =>
    supabase.from("client_files").select(cols).eq("client_id", clientId).eq("kind", "progress_photo").eq("taken_at", date).order("created_at");
  let { data, error } = await q(COLS);
  if (error && missingPrivate(error)) ({ data, error } = await q(BASE_COLS));
  if (error) throw error;
  return (data ?? []) as unknown as ProgressPhotoRow[];
}

/**
 * Cuando se cambia la fecha de una evaluación, sus fotos (las de la fecha
 * vieja) pasan a la fecha nueva, para que sigan apareciendo juntas.
 */
export async function movePhotosDate(clientId: string, from: string, to: string): Promise<void> {
  if (from === to) return;
  const { error } = await supabase
    .from("client_files")
    .update({ taken_at: to })
    .eq("client_id", clientId)
    .eq("kind", "progress_photo")
    .eq("taken_at", from);
  if (error) throw error;
}

/** El alumno marca una foto suya como "solo para mí" o la vuelve a compartir (part4r). */
export async function setPhotoPrivate(id: string, isPrivate: boolean): Promise<void> {
  const { data, error } = await supabase.from("client_files").update({ client_private: isPrivate }).eq("id", id).select("id");
  if (error) {
    if (missingPrivate(error)) throw new Error("Esta opción todavía no está disponible.");
    throw error;
  }
  if (!data?.length) throw new Error("No se pudo cambiar.");
}

/** Cuántas fotos ocultó el alumno (solo el número, para su entrenador). */
export async function privatePhotoCount(clientId: string): Promise<number> {
  const { data, error } = await supabase.rpc("client_private_photo_count", { p_client: clientId });
  if (error) return 0;
  return Number(data ?? 0);
}
