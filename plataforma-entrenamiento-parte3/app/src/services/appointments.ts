import { supabase } from "../lib/supabase";

export type AppointmentKind = "in_person" | "online";

export const APPOINTMENT_KIND_LABEL: Record<AppointmentKind, string> = {
  in_person: "Presencial",
  online: "Online",
};

export interface AppointmentRow {
  id: string;
  organization_id: string;
  trainer_id: string;
  client_id: string | null;
  kind: AppointmentKind;
  title: string | null;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  recurrence_id: string | null;
}

/** Las citas cuyo inicio cae en o después de rangeStart y antes de rangeEnd — pensado para traer una semana a la vez. */
export async function listAppointments(rangeStart: string, rangeEnd: string): Promise<AppointmentRow[]> {
  const { data, error } = await supabase
    .from("trainer_appointments")
    .select("*")
    .gte("starts_at", rangeStart)
    .lt("starts_at", rangeEnd)
    .order("starts_at");
  if (error) throw error;
  return (data ?? []) as AppointmentRow[];
}

/**
 * Si repeatWeeks es mayor a 1, crea esa cantidad de citas semanales reales
 * (no una regla virtual) — todas con el mismo recurrence_id, cada una
 * editable o borrable suelta sin afectar a las demás.
 */
export async function createAppointment(params: {
  organizationId: string;
  trainerId: string;
  clientId: string;
  kind: AppointmentKind;
  title: string;
  startsAt: string;
  endsAt: string;
  notes: string;
  repeatWeeks?: number;
}): Promise<AppointmentRow[]> {
  const count = params.repeatWeeks && params.repeatWeeks > 1 ? params.repeatWeeks : 1;
  const recurrenceId = count > 1 ? crypto.randomUUID() : null;
  const startMs = new Date(params.startsAt).getTime();
  const endMs = new Date(params.endsAt).getTime();
  const rows = Array.from({ length: count }, (_, i) => {
    const offsetMs = i * 7 * 86400000;
    return {
      organization_id: params.organizationId,
      trainer_id: params.trainerId,
      client_id: params.clientId,
      kind: params.kind,
      title: params.title || null,
      starts_at: new Date(startMs + offsetMs).toISOString(),
      ends_at: new Date(endMs + offsetMs).toISOString(),
      notes: params.notes || null,
      recurrence_id: recurrenceId,
    };
  });
  const { data, error } = await supabase.from("trainer_appointments").insert(rows).select();
  if (error) throw error;
  return data as AppointmentRow[];
}

/** Borra las citas futuras (desde ahora en adelante) de una serie repetida, dejando intactas las que ya pasaron. */
export async function deactivateRecurrence(recurrenceId: string): Promise<number> {
  const { data, error } = await supabase
    .from("trainer_appointments")
    .delete()
    .eq("recurrence_id", recurrenceId)
    .gte("starts_at", new Date().toISOString())
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}

export async function updateAppointment(
  id: string,
  fields: Partial<{ clientId: string; kind: AppointmentKind; title: string; startsAt: string; endsAt: string; notes: string }>
): Promise<void> {
  const payload: Record<string, any> = {};
  if (fields.clientId !== undefined) payload.client_id = fields.clientId;
  if (fields.kind !== undefined) payload.kind = fields.kind;
  if (fields.title !== undefined) payload.title = fields.title || null;
  if (fields.startsAt !== undefined) payload.starts_at = fields.startsAt;
  if (fields.endsAt !== undefined) payload.ends_at = fields.endsAt;
  if (fields.notes !== undefined) payload.notes = fields.notes || null;
  const { error } = await supabase.from("trainer_appointments").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteAppointment(id: string): Promise<void> {
  const { error } = await supabase.from("trainer_appointments").delete().eq("id", id);
  if (error) throw error;
}
