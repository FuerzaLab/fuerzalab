import { supabase } from "../lib/supabase";

/** Resumen del estudio para su dueño (part3u_migration.sql). */
export interface TrainerStats {
  trainer_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  last_sign_in_at: string | null;
  clients_active: number;
  clients_paused: number;
  clients_prospect: number;
  sessions_scheduled: number;
  workouts_completed: number;
  workouts_skipped: number;
  assessments: number;
  wellness_logs: number;
  wellness_red_7d: number;
  paid_amount: number;
  pending_amount: number;
  overdue_amount: number;
  currency: string | null;
}

export interface InactiveClient {
  client_id: string;
  client_name: string;
  trainer_name: string;
  last_workout_at: string | null;
  days_inactive: number;
}

export async function isStudioOwner(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_studio_owner");
  if (error) return false; // sin la migración, nadie es dueño
  return data === true;
}

export async function getStudioStats(monthStart: string): Promise<TrainerStats[]> {
  const { data, error } = await supabase.rpc("studio_trainer_stats", { p_month_start: monthStart });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    paid_amount: Number(r.paid_amount ?? 0),
    pending_amount: Number(r.pending_amount ?? 0),
    overdue_amount: Number(r.overdue_amount ?? 0),
  })) as TrainerStats[];
}

export async function getInactiveClients(days: number): Promise<InactiveClient[]> {
  const { data, error } = await supabase.rpc("studio_inactive_clients", { p_days: days });
  if (error) throw error;
  return (data ?? []) as InactiveClient[];
}
