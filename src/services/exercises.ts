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
      "id, organization_id, owner_id, scope, name, description, primary_muscle_id, movement_pattern_id, equipment_ids, difficulty, goals, instructions, technical_cues, common_mistakes, is_active, created_at"
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
