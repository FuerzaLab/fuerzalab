import { supabase } from "../lib/supabase";

export interface WellnessLogRow {
  id: string;
  client_id: string;
  log_date: string;
  sleep_hours: number | null;
  sleep_quality: number;
  fatigue: number;
  energy: number;
  stress: number;
  soreness: number;
  pain_location: string | null;
  notes: string | null;
  trainer_adjustment: string | null;
}

export type WellnessField = "sleep_quality" | "fatigue" | "energy" | "stress" | "soreness";

export const WELLNESS_FIELDS: WellnessField[] = ["sleep_quality", "fatigue", "energy", "stress", "soreness"];

export const WELLNESS_FIELD_LABEL: Record<WellnessField, string> = {
  sleep_quality: "Calidad de sueño",
  fatigue: "Nivel de fatiga",
  energy: "Nivel de energía",
  stress: "Nivel de estrés",
  soreness: "Dolor muscular (DOMS)",
};

/** Escala 1 a 5 en las 5: 5 siempre es el mejor estado, 1 el peor. */
export const WELLNESS_SCALE_HINT: Record<WellnessField, { low: string; high: string }> = {
  sleep_quality: { low: "Muy mala, interrumpida", high: "Excelente, reparadora" },
  fatigue: { low: "Exhausto", high: "Nada fatigado, fresco" },
  energy: { low: "Sin energía", high: "Muy enérgico" },
  stress: { low: "Muy estresado", high: "Relajado, sin estrés" },
  soreness: { low: "Dolor severo, limitante", high: "Sin dolor" },
};

/** Wellness Score (0-100): promedio de los 5 parámetros × 20. */
export function wellnessScore(log: Pick<WellnessLogRow, WellnessField>): number {
  const sum = WELLNESS_FIELDS.reduce((t, f) => t + log[f], 0);
  return Math.round(((sum / WELLNESS_FIELDS.length) * 20) * 10) / 10;
}

/** Semáforo: por encima de 80 óptimo, 60-79 precaución, menos de 60 riesgo. */
export function wellnessSemaforo(score: number): { emoji: string; label: string; tone: "ok" | "warn" | "bad"; recommendation: string } {
  if (score >= 80) return { emoji: "🟢", label: "Óptimo", tone: "ok", recommendation: "Carga normal" };
  if (score >= 60) return { emoji: "🟡", label: "Precaución", tone: "warn", recommendation: "Monitorear, ajuste leve" };
  return { emoji: "🔴", label: "Riesgo", tone: "bad", recommendation: "⚠ Reducir carga / evaluar individualmente" };
}

/** Parámetros puntuales en ≤2: alerta específica aunque el score total sea aceptable. */
export function lowFields(log: Pick<WellnessLogRow, WellnessField>): WellnessField[] {
  return WELLNESS_FIELDS.filter((f) => log[f] <= 2);
}

/** Promedio móvil de los últimos 7 registros (o menos si no hay 7 todavía), más recientes primero en `logs`. */
export function rollingAverage7(logs: WellnessLogRow[]): number {
  const last7 = logs.slice(0, 7);
  if (!last7.length) return 0;
  const sum = last7.reduce((t, l) => t + wellnessScore(l), 0);
  return Math.round((sum / last7.length) * 10) / 10;
}

/** ↑ si el score de hoy está por encima del promedio móvil (incluido hoy), ↓ si está por debajo. */
export function trend(todayScore: number, rolling7: number): { arrow: string; label: string } {
  if (todayScore > rolling7) return { arrow: "↑", label: "Mejorando" };
  if (todayScore < rolling7) return { arrow: "↓", label: "Bajando" };
  return { arrow: "→", label: "Estable" };
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getTodayLog(clientId: string): Promise<WellnessLogRow | null> {
  const { data, error } = await supabase
    .from("wellness_logs")
    .select("id, client_id, log_date, sleep_hours, sleep_quality, fatigue, energy, stress, soreness, pain_location, notes, trainer_adjustment")
    .eq("client_id", clientId)
    .eq("log_date", todayStr())
    .maybeSingle();
  if (error) throw error;
  return data as WellnessLogRow | null;
}

export async function upsertTodayLog(
  clientId: string,
  fields: {
    sleep_hours: number | null;
    sleep_quality: number;
    fatigue: number;
    energy: number;
    stress: number;
    soreness: number;
    pain_location: string;
    notes: string;
  }
): Promise<WellnessLogRow> {
  const { data, error } = await supabase
    .from("wellness_logs")
    .upsert(
      { client_id: clientId, log_date: todayStr(), ...fields, pain_location: fields.pain_location || null, notes: fields.notes || null },
      { onConflict: "client_id,log_date" }
    )
    .select("id, client_id, log_date, sleep_hours, sleep_quality, fatigue, energy, stress, soreness, pain_location, notes, trainer_adjustment")
    .single();
  if (error) throw error;
  return data as WellnessLogRow;
}

export async function listRecentLogs(clientId: string, days = 30): Promise<WellnessLogRow[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("wellness_logs")
    .select("id, client_id, log_date, sleep_hours, sleep_quality, fatigue, energy, stress, soreness, pain_location, notes, trainer_adjustment")
    .eq("client_id", clientId)
    .gte("log_date", since)
    .order("log_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WellnessLogRow[];
}

export async function setTrainerAdjustment(logId: string, adjustment: string): Promise<void> {
  const { error } = await supabase.from("wellness_logs").update({ trainer_adjustment: adjustment || null }).eq("id", logId);
  if (error) throw error;
}

/** Para el panel del entrenador: los registros de HOY de todos sus clientes, para armar el resumen de alertas. */
export async function listTodayLogsForTrainer(): Promise<WellnessLogRow[]> {
  const { data, error } = await supabase
    .from("wellness_logs")
    .select("id, client_id, log_date, sleep_hours, sleep_quality, fatigue, energy, stress, soreness, pain_location, notes, trainer_adjustment")
    .eq("log_date", todayStr());
  if (error) throw error;
  return (data ?? []) as WellnessLogRow[];
}
