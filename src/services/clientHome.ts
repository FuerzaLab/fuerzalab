import { supabase } from "../lib/supabase";
import { formatLoad } from "../lib/units";

/** Lo que el alumno ve en su Inicio, además de lo que ya existía. */

export async function getMyTrainerName(clientId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("trainer:profiles!clients_trainer_id_fkey(full_name)")
    .eq("id", clientId)
    .maybeSingle();
  if (error || !data) return null;
  const t = Array.isArray((data as any).trainer) ? (data as any).trainer[0] : (data as any).trainer;
  return (t?.full_name as string | undefined) ?? null;
}

/** Sesiones completadas este mes y el mes anterior. */
export async function getMonthlySessionCounts(clientId: string): Promise<{ thisMonth: number; lastMonth: number }> {
  const now = new Date();
  const startThis = new Date(now.getFullYear(), now.getMonth(), 1);
  const startLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const { data, error } = await supabase
    .from("workout_logs")
    .select("completed_at")
    .eq("client_id", clientId)
    .eq("status", "completed")
    .gte("completed_at", startLast.toISOString());
  if (error) throw error;
  let thisMonth = 0;
  let lastMonth = 0;
  for (const r of data ?? []) {
    const d = new Date(r.completed_at as string);
    if (d >= startThis) thisMonth++;
    else lastMonth++;
  }
  return { thisMonth, lastMonth };
}

export interface MyRecord {
  id: string;
  exercise_name: string;
  reps: number;
  load_kg: number | null;
  performed_at: string;
  with_load: boolean;
  metric: number;
  previous_best: number;
  load_unit?: "kg" | "lb" | null;
}

// "*": incluye load_unit si ya se corrió part3v_migration.sql.
const RECORD_COLS = "*";

/** Récords de los últimos días (vista personal_records, de part3r_migration.sql). */
export async function listMyRecentRecords(clientId: string, days = 30, limit = 5): Promise<MyRecord[]> {
  const { data, error } = await supabase
    .from("personal_records")
    .select(RECORD_COLS)
    .eq("client_id", clientId)
    .gte("performed_at", new Date(Date.now() - days * 86400000).toISOString())
    .order("performed_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as MyRecord[];
}

/** Récords logrados en una sesión puntual — para celebrarlos al terminarla. */
export async function listRecordsForWorkout(workoutLogId: string): Promise<MyRecord[]> {
  const { data, error } = await supabase.from("personal_records").select(RECORD_COLS).eq("workout_log_id", workoutLogId);
  if (error) return [];
  return (data ?? []) as MyRecord[];
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** "Sentadilla: 65 kg × 8 (+4 kg en tu 1RM estimado)" */
export function describeRecord(r: MyRecord): string {
  const diff = Number(r.metric) - Number(r.previous_best);
  if (r.with_load) {
    const u = r.load_unit === "lb" ? "lb" : "kg";
    return `${formatLoad(Number(r.load_kg), u)} × ${r.reps} — tu 1RM estimado subió ${formatLoad(diff, u)}`;
  }
  return `${r.reps} repeticiones — ${fmt(diff)} más que tu mejor marca`;
}
