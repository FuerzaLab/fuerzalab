import { supabase } from "../lib/supabase";
import { fromKg, type LoadUnit } from "../lib/units";

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
  /** Unidad en que se cargó la serie (part3v). null = kg. */
  load_unit?: "kg" | "lb" | null;
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
    .select("*, exercises(name)")
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
    load_unit: row.load_unit === "lb" ? "lb" : row.load_unit === "kg" ? "kg" : null,
  }));
}

/**
 * 1RM estimado con la fórmula de Epley: carga × (1 + reps/30). Junta peso
 * y repeticiones en un solo número, así un 60 kg × 8 → 60 kg × 11 cuenta
 * como progreso aunque la carga no haya cambiado. (Con 1 repetición, el
 * 1RM es la carga misma.)
 */
export function estimated1RM(load: number, reps: number): number {
  if (load <= 0 || reps <= 0) return 0;
  const v = reps === 1 ? load : load * (1 + reps / 30);
  return Math.round(v * 2) / 2; // al medio kilo
}

/**
 * Para cada sesión de entrenamiento (no cada serie): la carga máxima de
 * ese ejercicio ese día, las reps de esa serie, y el mejor 1RM estimado
 * del día (que puede salir de otra serie: 80×5 da más que 85×1).
 */
/** La unidad en que se muestra un ejercicio: la de su última serie cargada (kg si nunca se cargó en lb). */
export function unitForEntries(entries: ExerciseSetEntry[]): LoadUnit {
  const withLoad = entries.filter((e) => (e.load_kg ?? 0) > 0);
  return withLoad.length && withLoad[withLoad.length - 1].load_unit === "lb" ? "lb" : "kg";
}

export function dailyTopLoad(entries: ExerciseSetEntry[]): { date: string; load: number; reps: number; e1rm: number }[] {
  const byDay = new Map<string, { load: number; reps: number; e1rm: number }>();
  for (const e of entries) {
    const day = e.performed_at.slice(0, 10);
    const load = e.load_kg ?? 0;
    const e1 = estimated1RM(load, e.reps);
    const current = byDay.get(day);
    if (!current) byDay.set(day, { load, reps: e.reps, e1rm: e1 });
    else {
      // La serie más pesada; a igual carga (o sin carga), la de más reps.
      if (load > current.load || (load === current.load && e.reps > current.reps)) {
        current.load = load;
        current.reps = e.reps;
      }
      current.e1rm = Math.max(current.e1rm, e1);
    }
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));
}

/** Resumen de un ejercicio para la grilla de tarjetas del reporte. */
export interface ExerciseSummary {
  exerciseId: string;
  exerciseName: string;
  /** "load": se mide por 1RM estimado (kg). "reps": sin carga (peso corporal), se mide por reps máximas. */
  kind: "load" | "reps";
  sessions: number;
  /** Un punto por día entrenado: 1RM estimado del día, o reps máximas si es sin carga. */
  series: { date: string; value: number }[];
  first: number;
  last: number;
  /** Cambio % del primer al último día; null si hay un solo día o el primero es 0. */
  pctChange: number | null;
  /** Unidad en que se muestra (la de la última serie cargada); los valores ya vienen en esa unidad. */
  unit: "kg" | "lb";
}

/**
 * Una entrada por ejercicio entrenado, ordenadas de más a menos sesiones
 * (los ejercicios principales primero). Si un ejercicio alguna vez se hizo
 * con carga, se mide por 1RM estimado y se ignoran los días sin carga
 * registrada; si nunca tuvo carga, se mide por reps máximas del día.
 */
export function exerciseSummaries(entries: ExerciseSetEntry[]): ExerciseSummary[] {
  const byExercise = new Map<string, ExerciseSetEntry[]>();
  for (const e of entries) {
    const list = byExercise.get(e.exercise_id);
    if (list) list.push(e);
    else byExercise.set(e.exercise_id, [e]);
  }

  const out: ExerciseSummary[] = [];
  for (const [exerciseId, list] of byExercise) {
    const hasLoad = list.some((e) => (e.load_kg ?? 0) > 0);
    const byDay = new Map<string, number>();
    for (const e of list) {
      const day = e.performed_at.slice(0, 10);
      const v = hasLoad ? estimated1RM(e.load_kg ?? 0, e.reps) : e.reps;
      if (hasLoad && v <= 0) continue;
      byDay.set(day, Math.max(byDay.get(day) ?? 0, v));
    }
    const series = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
    if (series.length === 0) continue;
    // Se muestra en la unidad en que se cargó la última serie (kg o lb); por dentro todo es kg.
    const unit: "kg" | "lb" = hasLoad && list[list.length - 1].load_unit === "lb" ? "lb" : "kg";
    if (unit === "lb") for (const p of series) p.value = fromKg(p.value, "lb");
    const first = series[0].value;
    const last = series[series.length - 1].value;
    out.push({
      unit,
      exerciseId,
      exerciseName: list[0].exercise_name,
      kind: hasLoad ? "load" : "reps",
      sessions: series.length,
      series,
      first,
      last,
      pctChange: series.length >= 2 && first > 0 ? ((last - first) / first) * 100 : null,
    });
  }
  return out.sort((a, b) => b.sessions - a.sessions || a.exerciseName.localeCompare(b.exerciseName));
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
