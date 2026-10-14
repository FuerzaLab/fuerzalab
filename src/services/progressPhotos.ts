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
}

export async function listProgressPhotos(clientId: string): Promise<ProgressPhotoRow[]> {
  const { data, error } = await supabase
    .from("client_files")
    .select("id, client_id, storage_path, taken_at, visibility, notes, angle, created_at")
    .eq("client_id", clientId)
    .eq("kind", "progress_photo")
    .order("taken_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProgressPhotoRow[];
}

export async function uploadProgressPhoto(params: {
  organizationId: string;
  clientId: string;
  file: File;
  takenAt: string;
  notes: string;
  visibility: PhotoVisibility;
  angle: PhotoAngle | null;
}): Promise<ProgressPhotoRow> {
  const path = `${params.organizationId}/${params.clientId}/progress-photos/${Date.now()}-${params.file.name}`;
  const { error: upErr } = await supabase.storage.from("client-files").upload(path, params.file, { upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("client_files")
    .insert({
      organization_id: params.organizationId,
      client_id: params.clientId,
      kind: "progress_photo",
      storage_path: path,
      taken_at: params.takenAt || null,
      visibility: params.visibility,
      notes: params.notes || null,
      angle: params.angle,
    })
    .select("id, client_id, storage_path, taken_at, visibility, notes, angle, created_at")
    .single();
  if (error) throw error;
  return data as ProgressPhotoRow;
}

/** Sube hasta 4 fotos (una por ángulo) de una sola vez, compartiendo fecha, notas y visibilidad. Sube las que vengan; no hace falta completar las 4. */
export async function uploadProgressPhotoSet(params: {
  organizationId: string;
  clientId: string;
  files: Partial<Record<PhotoAngle, File>>;
  takenAt: string;
  notes: string;
  visibility: PhotoVisibility;
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
