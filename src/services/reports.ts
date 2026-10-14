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

/** Volumen total (reps × carga) por semana — 0 para ejercicios sin carga registrada (ej. peso corporal). */
export function weeklyVolume(setLogs: SetLogSummary[]): WeeklyPoint[] {
  const byWeek = new Map<string, number>();
  for (const s of setLogs) {
    const k = weekKey(s.performed_at);
    byWeek.set(k, (byWeek.get(k) ?? 0) + s.reps * (s.load_kg ?? 0));
  }
  return [...byWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, value]) => ({ week, value: Math.round(value) }));
}
