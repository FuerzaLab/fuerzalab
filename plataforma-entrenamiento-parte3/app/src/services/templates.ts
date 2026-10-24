import { supabase } from "../lib/supabase";
import {
  createSession,
  listSessionBlocks,
  type SessionRow,
  type WorkoutExerciseRow,
  type BlockKind,
} from "./sessions";

export interface WorkoutTemplateRow {
  id: string;
  organization_id: string;
  trainer_id: string;
  name: string;
  description: string | null;
  goal: string | null;
  level: string | null;
  days_per_week: number | null;
  visibility: "private" | "organization";
  is_active: boolean;
  created_at: string;
}

export interface WorkoutTemplateSessionRow {
  id: string;
  template_id: string;
  day_index: number;
  name: string;
  focus: string | null;
  sort_order: number;
}

export interface WorkoutTemplateExerciseRow {
  id: string;
  template_session_id: string;
  exercise_id: string;
  exercise_name: string;
  block_kind: string | null;
  sort_order: number;
  sets: number;
  reps_min: number | null;
  reps_max: number | null;
  load_value: number | null;
  rir: number | null;
  rest_s: number | null;
  tempo: string | null;
  superset_group: number | null;
  prescription_type: string;
}

// La tabla de plantillas usa "superset"/"circuit" donde una rutina real usa
// "main", y no tiene "cardio" — lo mapeamos a mano en los dos sentidos para
// no perder nada en silencio.
function toTemplateBlockKind(k: BlockKind | undefined): string | null {
  if (!k) return null;
  if (k === "cardio") return "main";
  return k;
}
function toRealBlockKind(k: string | null): BlockKind {
  if (k === "warmup" || k === "mobility" || k === "flexibility") return k;
  if (k === "cooldown") return "flexibility"; // las rutinas reales no crean un bloque de vuelta a la calma propio
  return "main"; // main, superset, circuit, o vacío
}

export async function listWorkoutTemplates(): Promise<WorkoutTemplateRow[]> {
  const { data, error } = await supabase.from("workout_templates").select("*").eq("is_active", true).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WorkoutTemplateRow[];
}

export async function createWorkoutTemplate(params: {
  organizationId: string;
  trainerId: string;
  name: string;
  description: string;
  goal: string;
  level: string;
  visibility: "private" | "organization";
}): Promise<WorkoutTemplateRow> {
  const { data, error } = await supabase
    .from("workout_templates")
    .insert({
      organization_id: params.organizationId,
      trainer_id: params.trainerId,
      name: params.name,
      description: params.description || null,
      goal: params.goal || null,
      level: params.level || null,
      visibility: params.visibility,
    })
    .select()
    .single();
  if (error) throw error;
  return data as WorkoutTemplateRow;
}

export async function deleteWorkoutTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("workout_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function listTemplateSessions(templateId: string): Promise<WorkoutTemplateSessionRow[]> {
  const { data, error } = await supabase
    .from("workout_template_sessions")
    .select("id, template_id, day_index, name, focus, sort_order")
    .eq("template_id", templateId)
    .order("day_index");
  if (error) throw error;
  return (data ?? []) as WorkoutTemplateSessionRow[];
}

export async function listTemplateExercises(templateSessionId: string): Promise<WorkoutTemplateExerciseRow[]> {
  const { data, error } = await supabase
    .from("workout_template_exercises")
    .select(
      "id, template_session_id, exercise_id, block_kind, sort_order, sets, reps_min, reps_max, load_value, rir, rest_s, tempo, superset_group, prescription_type, exercises(name)"
    )
    .eq("template_session_id", templateSessionId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, exercise_name: row.exercises?.name ?? "" })) as WorkoutTemplateExerciseRow[];
}

/**
 * Guarda la rutina que el entrenador tiene abierta en el Constructor como un
 * día dentro de una plantilla de rutinas sueltas — nueva, o sumada a una que
 * ya existía (para armar de a poco un split completo de varios días).
 */
export async function saveSessionAsTemplateDay(params: {
  organizationId: string;
  trainerId: string;
  session: SessionRow;
  exercises: WorkoutExerciseRow[];
  target: { kind: "new"; name: string; description: string; goal: string; level: string; visibility: "private" | "organization" } | { kind: "existing"; templateId: string };
  dayIndex: number;
  dayName: string;
  focus: string;
}): Promise<WorkoutTemplateSessionRow> {
  let templateId: string;
  if (params.target.kind === "new") {
    const created = await createWorkoutTemplate({
      organizationId: params.organizationId,
      trainerId: params.trainerId,
      name: params.target.name,
      description: params.target.description,
      goal: params.target.goal,
      level: params.target.level,
      visibility: params.target.visibility,
    });
    templateId = created.id;
  } else {
    templateId = params.target.templateId;
  }

  const { data: tSession, error: tsErr } = await supabase
    .from("workout_template_sessions")
    .insert({
      organization_id: params.organizationId,
      trainer_id: params.trainerId,
      template_id: templateId,
      day_index: params.dayIndex,
      name: params.dayName,
      focus: params.focus || null,
    })
    .select("id, template_id, day_index, name, focus, sort_order")
    .single();
  if (tsErr) throw tsErr;

  const blocks = await listSessionBlocks(params.session.id);
  const blockIdToKind = new Map(blocks.map((b) => [b.id, b.kind]));

  for (const ex of params.exercises) {
    const kind = ex.block_id ? blockIdToKind.get(ex.block_id) : undefined;
    const { error } = await supabase.from("workout_template_exercises").insert({
      organization_id: params.organizationId,
      trainer_id: params.trainerId,
      template_id: templateId,
      template_session_id: tSession.id,
      block_kind: toTemplateBlockKind(kind),
      exercise_id: ex.exercise_id,
      sort_order: ex.sort_order,
      sets: ex.sets ?? 3,
      reps_min: ex.reps_min,
      reps_max: ex.reps_max,
      prescription_type: ex.duration_min != null ? "time" : "reps",
      load_type: ex.load_value != null ? "kg" : null,
      load_value: ex.load_value,
      rir: ex.rir,
      rest_s: ex.rest_s,
      tempo: ex.tempo,
      superset_group: ex.superset_group,
    });
    if (error) throw error;
  }

  return tSession as WorkoutTemplateSessionRow;
}

/** Clona un día de una plantilla en una rutina real, dentro de la semana que elijas. */
export async function applyTemplateDayToWeek(params: {
  templateSessionId: string;
  templateSessionName: string;
  targetWeekId: string;
  sortOrder: number;
}): Promise<SessionRow> {
  const newSession = await createSession(params.targetWeekId, params.templateSessionName, params.sortOrder);
  const [newBlocks, templateExercises] = await Promise.all([
    listSessionBlocks(newSession.id),
    listTemplateExercises(params.templateSessionId),
  ]);
  const kindToNewBlockId = new Map(newBlocks.map((b) => [b.kind, b.id]));

  for (const ex of templateExercises) {
    const realKind = toRealBlockKind(ex.block_kind);
    const newBlockId = kindToNewBlockId.get(realKind) ?? newBlocks[0]?.id;
    if (!newBlockId) continue;
    const { error } = await supabase.from("workout_exercises").insert({
      session_id: newSession.id,
      block_id: newBlockId,
      exercise_id: ex.exercise_id,
      sort_order: ex.sort_order,
      sets: ex.sets,
      reps_min: ex.reps_min,
      reps_max: ex.reps_max,
      load_value: ex.load_value,
      rir: ex.rir,
      rest_s: ex.rest_s,
      tempo: ex.tempo,
      superset_group: ex.superset_group,
      prescription_type: ex.prescription_type,
    });
    if (error) throw error;
  }

  return newSession;
}
