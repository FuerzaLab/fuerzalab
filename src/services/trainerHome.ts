import { supabase } from "../lib/supabase";

/**
 * Para los "Primeros pasos" del entrenador nuevo: qué hitos ya cumplió.
 * Todo con conteos (head: true), así no baja datos.
 */
export interface OnboardingStatus {
  hasClient: boolean;
  hasProgram: boolean;
  hasClientAccount: boolean;
  hasCompletedWorkout: boolean;
}

async function exists(table: string, apply: (q: any) => any): Promise<boolean> {
  const { count, error } = await apply(supabase.from(table).select("id", { count: "exact", head: true }));
  if (error) return false;
  return (count ?? 0) > 0;
}

export async function getOnboardingStatus(trainerId: string): Promise<OnboardingStatus> {
  const [hasClient, hasProgram, hasClientAccount, hasCompletedWorkout] = await Promise.all([
    exists("clients", (q) => q.eq("trainer_id", trainerId)),
    exists("programs", (q) => q.eq("trainer_id", trainerId).not("client_id", "is", null)),
    exists("clients", (q) => q.eq("trainer_id", trainerId).not("profile_id", "is", null)),
    exists("workout_logs", (q) => q.eq("trainer_id", trainerId).eq("status", "completed")),
  ]);
  return { hasClient, hasProgram, hasClientAccount, hasCompletedWorkout };
}
