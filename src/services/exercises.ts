import { supabase } from "../lib/supabase";

export type ExerciseScope = "global" | "organization" | "trainer";

export interface ExerciseRow {
  id: string;
  organization_id: string | null;
  owner_id: string | null;
  scope: ExerciseScope;
  name: string;
  description: string | null;
  primary_muscle_id: string | null;
  movement_pattern_id: string | null;
  equipment_ids: string[];
  difficulty: "beginner" | "intermediate" | "advanced" | null;
  goals: string[];
  instructions: string | null;
  technical_cues: string | null;
  common_mistakes: string | null;
  is_active: boolean;
  created_at: string;
  media_path: string | null;
  media_type: "image" | "video" | null;
}

export interface CatalogItem {
  id: string;
  kind: string;
  key: string;
  label: string;
}

export const GOAL_OPTIONS = ["Fuerza", "Hipertrofia", "Potencia", "Resistencia", "Movilidad", "Flexibilidad"];

/** Grupos musculares considerados "tren inferior"; el resto (salvo cardio/cuerpo completo) se trata como superior. */
const LOWER_BODY_KEYS = new Set(["cuadriceps", "isquiotibiales", "gluteos", "pantorrillas"]);
const FULL_BODY_KEYS = new Set(["cuerpo_completo", "cardio", "core"]);

export function bodyRegionOf(muscleKey: string | null): "Superior" | "Inferior" | "Full body" {
  if (!muscleKey) return "Full body";
  if (LOWER_BODY_KEYS.has(muscleKey)) return "Inferior";
  if (FULL_BODY_KEYS.has(muscleKey)) return "Full body";
  return "Superior";
}

/**
 * Sube una foto o video de demostración para un ejercicio. `folderPrefix`
 * es "global" para la biblioteca global (solo el Super Admin puede) o el
 * id de la organización para la biblioteca de un entrenador — tiene que
 * coincidir con cómo ya está configurado el permiso de este espacio de
 * almacenamiento desde el script original.
 */
export async function uploadExerciseMedia(params: {
  exerciseId: string;
  folderPrefix: string;
  uploaderId: string;
  file: File;
}): Promise<{ path: string; type: "image" | "video" }> {
  const type: "image" | "video" = params.file.type.startsWith("video/") ? "video" : "image";
  const path = `${params.folderPrefix}/${params.uploaderId}/${Date.now()}-${params.file.name}`;
  const { error: upErr } = await supabase.storage.from("exercise-media").upload(path, params.file, { upsert: false });
  if (upErr) throw upErr;
  const { error } = await supabase.from("exercises").update({ media_path: path, media_type: type }).eq("id", params.exerciseId);
  if (error) throw error;
  return { path, type };
}

export async function removeExerciseMedia(exerciseId: string, mediaPath: string): Promise<void> {
  const { error } = await supabase.from("exercises").update({ media_path: null, media_type: null }).eq("id", exerciseId);
  if (error) throw error;
  await supabase.storage.from("exercise-media").remove([mediaPath]);
}

export async function getExerciseMediaUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("exercise-media").createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export type VariationRelation = "variant" | "progression" | "regression";

export const RELATION_LABEL: Record<VariationRelation, string> = {
  variant: "Alternativa",
  progression: "Progresión (más difícil)",
  regression: "Regresión (más fácil)",
};

export interface ExerciseVariationRow {
  id: string;
  exercise_id: string;
  related_exercise_id: string;
  related_exercise_name: string;
  relation: VariationRelation;
  sort_order: number;
  notes: string | null;
}

const INVERSE_RELATION: Record<VariationRelation, VariationRelation> = {
  variant: "variant",
  progression: "regression",
  regression: "progression",
};

/**
 * Las alternativas, progresiones y regresiones ya cargadas para un
 * ejercicio — mirando el vínculo en los dos sentidos: si lo cargaste
 * desde el otro ejercicio (ej. "A es progresión de B"), acá también
 * aparece desde B ("A" como progresión), no solo desde donde lo cargaste
 * originalmente. Progresión y regresión se invierten según desde qué
 * lado se mira; alternativa es la misma para los dos.
 */
export async function listVariationsFor(exerciseId: string): Promise<ExerciseVariationRow[]> {
  // La tabla tiene dos columnas que apuntan a exercises (exercise_id y
  // related_exercise_id) — unir ambos sentidos en una sola consulta con
  // join puede ser ambiguo según cómo lo resuelva el servidor, así que acá
  // se evita del todo: se traen los vínculos en texto plano, y los nombres
  // de los ejercicios relacionados se resuelven aparte, con una consulta
  // simple a la tabla de ejercicios.
  const [forward, backward] = await Promise.all([
    supabase
      .from("exercise_variations")
      .select("id, exercise_id, related_exercise_id, relation, sort_order, notes")
      .eq("exercise_id", exerciseId)
      .order("sort_order"),
    supabase
      .from("exercise_variations")
      .select("id, exercise_id, related_exercise_id, relation, sort_order, notes")
      .eq("related_exercise_id", exerciseId)
      .order("sort_order"),
  ]);
  if (forward.error) throw forward.error;
  if (backward.error) throw backward.error;

  const fwd = (forward.data ?? []).map((row: any) => ({ ...row, otherExerciseId: row.related_exercise_id as string }));
  const bwd = (backward.data ?? []).map((row: any) => ({
    id: row.id,
    exercise_id: exerciseId,
    related_exercise_id: row.exercise_id,
    otherExerciseId: row.exercise_id as string,
    relation: INVERSE_RELATION[row.relation as VariationRelation],
    sort_order: row.sort_order,
    notes: row.notes,
  }));
  const combined = [...fwd, ...bwd];
  if (combined.length === 0) return [];

  const otherIds = [...new Set(combined.map((r) => r.otherExerciseId))];
  const { data: names, error: namesErr } = await supabase.from("exercises").select("id, name").in("id", otherIds);
  if (namesErr) throw namesErr;
  const nameById = new Map((names ?? []).map((n: any) => [n.id, n.name]));

  return combined.map((row) => ({
    id: row.id,
    exercise_id: row.exercise_id,
    related_exercise_id: row.related_exercise_id,
    related_exercise_name: nameById.get(row.otherExerciseId) ?? "",
    relation: row.relation,
    sort_order: row.sort_order,
    notes: row.notes,
  })) as ExerciseVariationRow[];
}

export async function addVariation(params: {
  exerciseId: string;
  relatedExerciseId: string;
  relation: VariationRelation;
  notes: string;
}): Promise<ExerciseVariationRow> {
  const { data, error } = await supabase
    .from("exercise_variations")
    .insert({
      exercise_id: params.exerciseId,
      related_exercise_id: params.relatedExerciseId,
      relation: params.relation,
      notes: params.notes || null,
    })
    .select("id, exercise_id, related_exercise_id, relation, sort_order, notes, exercises:related_exercise_id(name)")
    .single();
  if (error) throw error;
  return { ...(data as any), related_exercise_name: (data as any).exercises?.name ?? "" } as ExerciseVariationRow;
}

export async function removeVariation(id: string): Promise<void> {
  const { error } = await supabase.from("exercise_variations").delete().eq("id", id);
  if (error) throw error;
}

export async function listCatalog(kind: string): Promise<CatalogItem[]> {
  const { data, error } = await supabase
    .from("catalog_items")
    .select("id, kind, key, label")
    .eq("kind", kind)
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as CatalogItem[];
}

export async function listExercises(): Promise<ExerciseRow[]> {
  const { data, error } = await supabase
    .from("exercises")
    .select(
      "id, organization_id, owner_id, scope, name, description, primary_muscle_id, movement_pattern_id, equipment_ids, difficulty, goals, instructions, technical_cues, common_mistakes, is_active, created_at, media_path, media_type"
    )
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as ExerciseRow[];
}

export interface NewExerciseInput {
  name: string;
  primary_muscle_id: string | null;
  movement_pattern_id: string | null;
  equipment_ids: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  goals: string[];
  instructions: string;
  technical_cues: string;
  common_mistakes: string;
}

export async function createExercise(
  input: NewExerciseInput,
  scope: "global" | "trainer",
  organizationId: string | null,
  ownerId: string | null
): Promise<ExerciseRow> {
  const row = {
    ...input,
    scope,
    organization_id: scope === "global" ? null : organizationId,
    owner_id: scope === "global" ? null : ownerId,
  };
  const { data, error } = await supabase.from("exercises").insert(row).select().single();
  if (error) throw error;
  return data as ExerciseRow;
}

/**
 * Edita un ejercicio de la biblioteca. Si las reglas de seguridad no
 * dejan tocarlo (ej. un ejercicio global, para un entrenador), Supabase
 * no da error: simplemente no actualiza nada — por eso se chequea a mano.
 */
export async function updateExercise(id: string, input: NewExerciseInput): Promise<ExerciseRow> {
  const { data, error } = await supabase.from("exercises").update(input).eq("id", id).select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("No tenés permiso para editar este ejercicio.");
  return data[0] as ExerciseRow;
}

/**
 * Elimina un ejercicio. Si ya se usó en alguna rutina, sesión registrada
 * o prueba de fuerza, la base de datos no deja borrarlo (perdería ese
 * historial) — en ese caso se ARCHIVA: desaparece de la biblioteca y no
 * se puede elegir para rutinas nuevas, pero las rutinas e historiales
 * donde ya aparece lo siguen mostrando con su nombre.
 */
export async function deleteExercise(id: string): Promise<"deleted" | "archived"> {
  const { data, error } = await supabase.from("exercises").delete().eq("id", id).select("id");
  if (!error) {
    if (!data || data.length === 0) throw new Error("No tenés permiso para eliminar este ejercicio.");
    return "deleted";
  }
  // 23503 = el ejercicio está referenciado desde otra tabla (rutinas, historial…)
  if ((error as any).code !== "23503") throw error;

  const { data: upd, error: updErr } = await supabase.from("exercises").update({ is_active: false }).eq("id", id).select("id");
  if (updErr) throw updErr;
  if (!upd || upd.length === 0) throw new Error("No tenés permiso para eliminar este ejercicio.");
  // Que no siga apareciendo como "alternativa" de otro ejercicio en Mi rutina.
  await supabase.from("exercise_variations").delete().or(`exercise_id.eq.${id},related_exercise_id.eq.${id}`);
  return "archived";
}

/** Nombres de los dueños de ejercicios (para la vista del Super Admin). */
export async function getProfileNames(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const r of data ?? []) out[r.id as string] = r.full_name as string;
  return out;
}
