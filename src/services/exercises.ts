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

/** Las alternativas, progresiones y regresiones ya cargadas para un ejercicio, con el nombre del ejercicio relacionado. */
export async function listVariationsFor(exerciseId: string): Promise<ExerciseVariationRow[]> {
  const { data, error } = await supabase
    .from("exercise_variations")
    .select("id, exercise_id, related_exercise_id, relation, sort_order, notes, exercises:related_exercise_id(name)")
    .eq("exercise_id", exerciseId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, related_exercise_name: row.exercises?.name ?? "" })) as ExerciseVariationRow[];
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
