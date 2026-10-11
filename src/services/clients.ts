import { supabase } from "../lib/supabase";

export type ClientStatus = "prospect" | "active" | "paused" | "archived";

export interface ClientRow {
  id: string;
  organization_id: string;
  trainer_id: string;
  profile_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: ClientStatus;
  start_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientProfileRow {
  client_id: string;
  birth_date: string | null;
  sex: "male" | "female" | "other" | null;
  height_cm: number | null;
  training_level: "beginner" | "intermediate" | "advanced" | "elite" | null;
  sports_history: string | null;
  injuries: string | null;
  medical_notes: string | null;
}

export async function listClients(): Promise<ClientRow[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ClientRow[];
}

export async function getClient(id: string): Promise<ClientRow> {
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ClientRow;
}

export async function getClientProfile(clientId: string): Promise<ClientProfileRow | null> {
  const { data, error } = await supabase
    .from("client_profiles")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data as ClientProfileRow | null;
}

/**
 * organization_id y trainer_id de client_profiles los completa un trigger
 * en la base de datos a partir del cliente al que pertenece — por eso no
 * se envían aquí, y si se incluyeran en una actualización (no una
 * creación) serían ignorados por el disparador que protege esas columnas.
 */
export async function upsertClientProfile(
  clientId: string,
  fields: Partial<Omit<ClientProfileRow, "client_id">>
): Promise<void> {
  const { error } = await supabase
    .from("client_profiles")
    .upsert({ client_id: clientId, ...fields });
  if (error) throw error;
}

export async function updateClientStatus(id: string, status: ClientStatus): Promise<void> {
  const { error } = await supabase.from("clients").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function createClientWithInvite(params: {
  organizationId: string;
  trainerId: string;
  fullName: string;
  email: string;
}): Promise<{ client: ClientRow; code: string }> {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .insert({
      organization_id: params.organizationId,
      trainer_id: params.trainerId,
      full_name: params.fullName,
      email: params.email || null,
      status: "prospect",
    })
    .select()
    .single();
  if (clientError) throw clientError;

  const { data: invite, error: inviteError } = await supabase
    .from("invitations")
    .insert({
      organization_id: params.organizationId,
      trainer_id: params.trainerId,
      role: "client",
      client_id: client.id,
      email: params.email || null,
      full_name: params.fullName,
    })
    .select("code")
    .single();
  if (inviteError) throw inviteError;

  return { client: client as ClientRow, code: invite.code as string };
}
