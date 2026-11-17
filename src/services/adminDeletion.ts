import { supabase } from "../lib/supabase";
import { deleteClient } from "./clients";

/** Alumno que ya cumplió un plazo de borrado de los Términos (admin_deletion_candidates, part4u). */
export interface DeletionCandidate {
  client_id: string;
  organization_id: string;
  client_name: string;
  client_phone: string | null;
  organization_name: string;
  trainer_name: string | null;
  reason: "trial_ended" | "suspended" | "archived";
  since: string | null;
  has_account: boolean;
  deletion_requested_at: string | null;
}

export const REASON_LABEL: Record<DeletionCandidate["reason"], { title: string; rule: string }> = {
  trial_ended: { title: "Terminó la prueba y no siguió", rule: "Términos 3: se borran dentro de los 30 días siguientes." },
  suspended: { title: "Suspendido por falta de pago hace más de 6 meses", rule: "Términos 10: se borran, previo aviso al alumno." },
  archived: { title: "Dado de baja hace más de 12 meses", rule: "Privacidad 7: pasado ese plazo, se borra." },
};

export async function fetchDeletionCandidates(): Promise<DeletionCandidate[]> {
  const { data, error } = await supabase.rpc("admin_deletion_candidates");
  if (error) throw /admin_deletion_candidates/.test(error.message) ? new Error("Falta correr part4u_migration.sql en Supabase.") : error;
  return (data ?? []) as DeletionCandidate[];
}

/** Borra por completo al alumno: sus archivos (fotos, comprobantes) y todos sus datos. No se puede deshacer. */
export async function deleteCandidate(c: DeletionCandidate): Promise<void> {
  const { error } = await supabase.rpc("admin_request_client_deletion", { p_client: c.client_id });
  if (error) throw error;
  await deleteClient({ id: c.client_id, organization_id: c.organization_id });
}
