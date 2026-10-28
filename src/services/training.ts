import { supabase } from "../lib/supabase";
import type { ProgramRow } from "./programs";

export interface WorkoutLogRow {
  id: string;
  session_id: string;
  client_id: string;
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
  /** En qué unidad se cargó (part3v). null = kg. La carga siempre está en load_kg. */
  load_unit?: "kg" | "lb" | null;
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

/** Si el cliente ya completó alguna rutina hoy, devuelve el nombre de esa sesión; si no, null. Para el límite de una rutina por día. */
export async function getTodayCompletedSessionName(clientId: string): Promise<string | null> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("workout_logs")
    .select("completed_at, sessions(name)")
    .eq("client_id", clientId)
    .eq("status", "completed")
    .gte("completed_at", todayStart.toISOString())
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as any)?.sessions?.name ?? null;
}

/** Trae (o crea si no existe) el registro de ejecución de una sesión. Una sesión solo puede tener un registro. */
export async function getOrCreateWorkoutLog(sessionId: string): Promise<WorkoutLogRow> {
  const { data: existing, error: selErr } = await supabase
    .from("workout_logs")
    .select("id, session_id, client_id, status, started_at, completed_at, session_rpe, sensations, comments, duration_min")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing as WorkoutLogRow;

  const { data: created, error: insErr } = await supabase
    .from("workout_logs")
    .insert({ session_id: sessionId, status: "in_progress", started_at: new Date().toISOString() })
    .select("id, session_id, client_id, status, started_at, completed_at, session_rpe, sensations, comments, duration_min")
    .single();
  if (insErr) throw insErr;
  return created as WorkoutLogRow;
}

export interface LastPerformance {
  date: string;
  bySet: Record<number, { reps: number; loadKg: number | null; unit: "kg" | "lb" }>;
}

/**
 * Busca la sesión anterior más reciente (distinta a la actual) donde el
 * cliente entrenó este mismo ejercicio, y devuelve lo que hizo en cada
 * serie — para que lo vea mientras entrena y decida si repetir o subir.
 * null si nunca lo entrenó antes.
 */
export async function getLastPerformance(clientId: string, exerciseId: string, excludeWorkoutLogId: string): Promise<LastPerformance | null> {
  const { data, error } = await supabase
    .from("workout_set_logs")
    .select("*")
    .eq("client_id", clientId)
    .eq("exercise_id", exerciseId)
    .eq("completed", true)
    .neq("workout_log_id", excludeWorkoutLogId)
    .order("performed_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  if (!data?.length) return null;

  const mostRecentLogId = data[0].workout_log_id;
  const bySet: Record<number, { reps: number; loadKg: number | null; unit: "kg" | "lb" }> = {};
  for (const row of data) {
    if (row.workout_log_id !== mostRecentLogId) continue;
    bySet[row.set_number] = { reps: row.reps, loadKg: row.load_kg, unit: (row as any).load_unit === "lb" ? "lb" : "kg" };
  }
  return { date: data[0].performed_at, bySet };
}

export async function listSetLogs(workoutLogId: string): Promise<SetLogRow[]> {
  const { data, error } = await supabase
    .from("workout_set_logs")
    .select("*")
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
  /** Unidad en que se cargó (la carga va igual en kg en loadKg). */
  loadUnit?: "kg" | "lb";
}): Promise<SetLogRow> {
  try {
    return await upsertSetLogRaw(params, true);
  } catch (e: any) {
    // Si todavía no se corrió part3v_migration.sql, la columna load_unit no
    // existe: se guarda igual, en kg, sin la unidad (solo se pierde el dato
    // de en qué unidad se cargó, la carga queda bien).
    if (/load_unit/.test(e?.message ?? "") && params.loadUnit !== "lb") return upsertSetLogRaw(params, false);
    if (/load_unit/.test(e?.message ?? "")) throw new Error("Para cargar en libras falta correr part3v_migration.sql en Supabase.");
    throw e;
  }
}

async function upsertSetLogRaw(
  params: Parameters<typeof upsertSetLog>[0],
  withUnit: boolean,
): Promise<SetLogRow> {
  const unitField = withUnit ? { load_unit: params.loadUnit === "lb" ? "lb" : params.loadUnit === "kg" ? "kg" : null } : {};
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
        ...unitField,
      })
      .eq("id", params.existingId)
      .select("*")
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
      ...unitField,
    })
    .select("*")
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

/**
 * El entrenador marca una rutina como saltada — por ejemplo si el cliente
 * nunca la va a completar (una lesión, un viaje) y quedó trabada una
 * semana anterior. Resuelve el aviso de "semana sin terminar" sin que el
 * cliente tenga que forzar nada.
 */
export async function markSessionSkipped(sessionId: string): Promise<void> {
  const log = await getOrCreateWorkoutLog(sessionId);
  const { error } = await supabase.from("workout_logs").update({ status: "skipped", completed_at: new Date().toISOString() }).eq("id", log.id);
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
