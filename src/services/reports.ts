import { supabase } from "../lib/supabase";

export interface WorkoutLogSummary {
  id: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  completed_at: string | null;
  session_rpe: number | null;
  duration_min: number | null;
}

export interface SetLogSummary {
  reps: number;
  load_kg: number | null;
  performed_at: string;
}

export async function listWorkoutLogsForClient(clientId: string, sinceDays = 90): Promise<WorkoutLogSummary[]> {
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const { data, error } = await supabase
    .from("workout_logs")
    .select("id, status, completed_at, session_rpe, duration_min, created_at")
    .eq("client_id", clientId)
    .gte("created_at", since)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WorkoutLogSummary[];
}

export async function listSetLogsForClient(clientId: string, sinceDays = 90): Promise<SetLogSummary[]> {
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const { data, error } = await supabase
    .from("workout_set_logs")
    .select("reps, load_kg, performed_at")
    .eq("client_id", clientId)
    .eq("completed", true)
    .gte("performed_at", since)
    .order("performed_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SetLogSummary[];
}

/** Lunes de la semana a la que pertenece una fecha, como clave de agrupación estable. */
function weekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // retrocede hasta el lunes
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export interface WeeklyPoint {
  week: string;
  value: number;
}

/** Sesiones completadas por semana. */
export function weeklyCompletedSessions(logs: WorkoutLogSummary[]): WeeklyPoint[] {
  const byWeek = new Map<string, number>();
  for (const l of logs) {
    if (l.status !== "completed" || !l.completed_at) continue;
    const k = weekKey(l.completed_at);
    byWeek.set(k, (byWeek.get(k) ?? 0) + 1);
  }
  return [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, value]) => ({ week, value }));
}

/** RPE promedio de sesión por semana (solo sesiones completadas que reportaron RPE). */
export function weeklyAvgRPE(logs: WorkoutLogSummary[]): WeeklyPoint[] {
  const byWeek = new Map<string, number[]>();
  for (const l of logs) {
    if (l.status !== "completed" || !l.completed_at || l.session_rpe == null) continue;
    const k = weekKey(l.completed_at);
    if (!byWeek.has(k)) byWeek.set(k, []);
    byWeek.get(k)!.push(l.session_rpe);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, vals]) => ({ week, value: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 }));
}

export interface ExerciseSetEntry {
  exercise_id: string;
  exercise_name: string;
  load_kg: number | null;
  reps: number;
  performed_at: string;
}

/** Todas las series completadas del cliente, con el nombre del ejercicio — para elegir un ejercicio y ver su progreso real entrenado a entrenado. */
export interface DashboardHighlight {
  bestEver: { exerciseName: string; loadKg: number } | null;
  progress: { exerciseName: string; fromKg: number; toKg: number } | null;
}

/**
 * Para Inicio del cliente: la mejor carga que levantó alguna vez (de
 * cualquier ejercicio) y, del ejercicio que más entrenó en este período,
 * cuánto subió desde la primera vez que lo registró hasta la última. Pensado
 * para festejar, no para evaluar — por eso solo se arma si hay datos reales
 * que mostrar, nunca con números inventados.
 */
export async function getDashboardHighlight(clientId: string): Promise<DashboardHighlight> {
  const sets = await listExerciseSetsForClient(clientId, 365);
  const withLoad = sets.filter((s) => s.load_kg != null) as (ExerciseSetEntry & { load_kg: number })[];
  if (withLoad.length === 0) return { bestEver: null, progress: null };

  const best = withLoad.reduce((max, s) => (s.load_kg > max.load_kg ? s : max), withLoad[0]);
  const bestEver = { exerciseName: best.exercise_name, loadKg: best.load_kg };

  const countByExercise = new Map<string, number>();
  for (const s of withLoad) countByExercise.set(s.exercise_id, (countByExercise.get(s.exercise_id) ?? 0) + 1);
  const mostTrainedId = [...countByExercise.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const forMostTrained = withLoad.filter((s) => s.exercise_id === mostTrainedId).sort((a, b) => a.performed_at.localeCompare(b.performed_at));

  let progress: DashboardHighlight["progress"] = null;
  if (forMostTrained.length >= 2) {
    const from = forMostTrained[0];
    const to = forMostTrained[forMostTrained.length - 1];
    if (to.load_kg > from.load_kg) {
      progress = { exerciseName: from.exercise_name, fromKg: from.load_kg, toKg: to.load_kg };
    }
  }

  return { bestEver, progress };
}

export async function listExerciseSetsForClient(clientId: string, sinceDays = 180): Promise<ExerciseSetEntry[]> {
  const since = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const { data, error } = await supabase
    .from("workout_set_logs")
    .select("exercise_id, load_kg, reps, performed_at, exercises(name)")
    .eq("client_id", clientId)
    .eq("completed", true)
    .gte("performed_at", since)
    .order("performed_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    exercise_id: row.exercise_id,
    exercise_name: row.exercises?.name ?? "",
    load_kg: row.load_kg,
    reps: row.reps,
    performed_at: row.performed_at,
  }));
}

/** Para cada sesión de entrenamiento (no cada serie), la carga máxima levantada de ese ejercicio ese día — mejor forma de ver progreso que graficar cada serie suelta. */
export function dailyTopLoad(entries: ExerciseSetEntry[]): { date: string; load: number; reps: number }[] {
  const byDay = new Map<string, { load: number; reps: number }>();
  for (const e of entries) {
    const day = e.performed_at.slice(0, 10);
    const load = e.load_kg ?? 0;
    const current = byDay.get(day);
    if (!current || load > current.load) byDay.set(day, { load, reps: e.reps });
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));
}

/** Volumen total (reps × carga) por semana — 0 para ejercicios sin carga registrada (ej. peso corporal). */
export function weeklyVolume(setLogs: SetLogSummary[]): WeeklyPoint[] {
  const byWeek = new Map<string, number>();
  for (const s of setLogs) {
    const k = weekKey(s.performed_at);
    byWeek.set(k, (byWeek.get(k) ?? 0) + s.reps * (s.load_kg ?? 0));
  }
  return [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, value]) => ({ week, value: Math.round(value) }));
}
