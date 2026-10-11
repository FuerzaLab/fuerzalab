import { supabase } from "../lib/supabase";
import type { ProgramRow } from "./programs";

export interface WorkoutLogRow {
  id: string;
  session_id: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  started_at: string | null;
  completed_at: string | null;
  session_rpe: number | null;
  sensations: string | null;
  comments: string | null;
  duration_min: number | null;
}

export interface SetLogRow {
  id: string;
  workout_log_id: string;
  workout_exercise_id: string | null;
  exercise_id: string;
  set_number: number;
  reps: number;
  load_kg: number | null;
  rir: number | null;
  completed: boolean;
  comment: string | null;
}

export async function getActiveProgramForClient(clientId: string): Promise<ProgramRow | null> {
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ProgramRow | null;
}

/** Trae (o crea si no existe) el registro de ejecución de una sesión. Una sesión solo puede tener un registro. */
export async function getOrCreateWorkoutLog(sessionId: string): Promise<WorkoutLogRow> {
  const { data: existing, error: selErr } = await supabase
    .from("workout_logs")
    .select("id, session_id, status, started_at, completed_at, session_rpe, sensations, comments, duration_min")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing as WorkoutLogRow;

  const { data: created, error: insErr } = await supabase
    .from("workout_logs")
    .insert({ session_id: sessionId, status: "in_progress", started_at: new Date().toISOString() })
    .select("id, session_id, status, started_at, completed_at, session_rpe, sensations, comments, duration_min")
    .single();
  if (insErr) throw insErr;
  return created as WorkoutLogRow;
}

export async function listSetLogs(workoutLogId: string): Promise<SetLogRow[]> {
  const { data, error } = await supabase
    .from("workout_set_logs")
    .select("id, workout_log_id, workout_exercise_id, exercise_id, set_number, reps, load_kg, rir, completed, comment")
    .eq("workout_log_id", workoutLogId);
  if (error) throw error;
  return (data ?? []) as SetLogRow[];
}

/** Guarda (crea o actualiza) una serie puntual de un ejercicio. */
export async function upsertSetLog(params: {
  existingId?: string;
  workoutLogId: string;
  workoutExerciseId: string;
  exerciseId: string;
  setNumber: number;
  reps: number;
  loadKg: number | null;
  rir: number | null;
  completed: boolean;
  comment?: string | null;
}): Promise<SetLogRow> {
  if (params.existingId) {
    const { data, error } = await supabase
      .from("workout_set_logs")
      .update({
        reps: params.reps,
        load_kg: params.loadKg,
        rir: params.rir,
        completed: params.completed,
        comment: params.comment ?? null,
        performed_at: new Date().toISOString(),
      })
      .eq("id", params.existingId)
      .select("id, workout_log_id, workout_exercise_id, exercise_id, set_number, reps, load_kg, rir, completed, comment")
      .single();
    if (error) throw error;
    return data as SetLogRow;
  }
  const { data, error } = await supabase
    .from("workout_set_logs")
    .insert({
      workout_log_id: params.workoutLogId,
      workout_exercise_id: params.workoutExerciseId,
      exercise_id: params.exerciseId,
      set_number: params.setNumber,
      reps: params.reps,
      load_kg: params.loadKg,
      rir: params.rir,
      completed: params.completed,
      comment: params.comment ?? null,
    })
    .select("id, workout_log_id, workout_exercise_id, exercise_id, set_number, reps, load_kg, rir, completed, comment")
    .single();
  if (error) throw error;
  return data as SetLogRow;
}

export async function completeWorkout(params: {
  workoutLogId: string;
  sessionRpe: number | null;
  comments: string;
  startedAt: string | null;
}): Promise<void> {
  const now = new Date();
  const durationMin = params.startedAt ? Math.max(1, Math.round((now.getTime() - new Date(params.startedAt).getTime()) / 60000)) : null;
  const { error } = await supabase
    .from("workout_logs")
    .update({
      status: "completed",
      completed_at: now.toISOString(),
      session_rpe: params.sessionRpe,
      comments: params.comments || null,
      duration_min: durationMin,
    })
    .eq("id", params.workoutLogId);
  if (error) throw error;
}

/** Estado (pendiente/en curso/completada) de cada sesión de una semana, para mostrar en la lista. */
export async function getSessionStatuses(sessionIds: string[]): Promise<Record<string, WorkoutLogRow["status"]>> {
  if (!sessionIds.length) return {};
  const { data, error } = await supabase.from("workout_logs").select("session_id, status").in("session_id", sessionIds);
  if (error) throw error;
  const out: Record<string, WorkoutLogRow["status"]> = {};
  for (const row of data ?? []) out[row.session_id] = row.status;
  return out;
}
