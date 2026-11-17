import { supabase } from "../lib/supabase";
import type { ProgramRow } from "./programs";
import { getActiveProgramForClient, pendingSessionsCount } from "./training";

/**
 * Plan nuevo para un alumno que todavía tiene un plan en curso (part4s):
 *  - "queue": el plan nuevo queda en espera hasta que termine el anterior.
 *  - "replace": el anterior se cierra y el alumno pasa al nuevo.
 * En los dos casos, una rutina que el alumno esté haciendo la puede terminar.
 */
export type Handoff = "queue" | "replace";

export interface CurrentPlanInfo {
  program: ProgramRow;
  /** Rutinas que le quedan (null = rutinas fijas, que no terminan solas). */
  pending: number | null;
}

/** El plan en curso del alumno, si le quedan rutinas (o son rutinas fijas). null si no hace falta preguntar. */
export async function currentPlanToHandOff(clientId: string): Promise<CurrentPlanInfo | null> {
  const program = await getActiveProgramForClient(clientId).catch(() => null);
  if (!program || program.status !== "active") return null;
  const pending = await pendingSessionsCount(program);
  if (pending === 0) return null;
  return { program, pending };
}

const MISSING = "Falta correr part4s_migration.sql en Supabase.";

/** Aplica la elección después de crear el plan nuevo. */
export async function applyHandoff(newProgramId: string, clientId: string, mode: Handoff): Promise<void> {
  if (mode === "queue") {
    const { error } = await supabase.from("programs").update({ queued: true }).eq("id", newProgramId);
    if (error) throw /queued/.test(error.message) ? new Error(MISSING) : error;
    return;
  }
  await closeOtherPlans(newProgramId, clientId);
}

/** Cierra los demás planes activos del alumno (quedan como terminados; su historial se conserva). */
export async function closeOtherPlans(keepProgramId: string, clientId: string): Promise<void> {
  const { error } = await supabase
    .from("programs")
    .update({ status: "completed" })
    .eq("client_id", clientId)
    .eq("is_template", false)
    .eq("status", "active")
    .neq("id", keepProgramId);
  if (error) throw error;
}

/** Adelanta un plan en espera: empieza ya y se cierra el anterior. */
export async function startQueuedNow(program: Pick<ProgramRow, "id" | "client_id">): Promise<void> {
  const { error } = await supabase.from("programs").update({ queued: false }).eq("id", program.id);
  if (error) throw /queued/.test(error.message) ? new Error(MISSING) : error;
  if (program.client_id) await closeOtherPlans(program.id, program.client_id);
}

/** Vuelve a abrir un plan cerrado (por si se cerró sin querer). */
export async function reopenPlan(programId: string): Promise<void> {
  const { error } = await supabase.from("programs").update({ status: "active" }).eq("id", programId);
  if (error) throw error;
}

/** Cierra un plan (el alumno deja de verlo; su historial se conserva). */
export async function closePlan(programId: string): Promise<void> {
  const { error } = await supabase.from("programs").update({ status: "completed" }).eq("id", programId);
  if (error) throw error;
}
