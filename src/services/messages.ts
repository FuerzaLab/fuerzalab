import { supabase } from "../lib/supabase";

export interface MessageRow {
  id: string;
  client_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export async function listMessages(clientId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, client_id, sender_id, body, read_at, created_at")
    .eq("client_id", clientId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

export async function sendMessage(clientId: string, body: string): Promise<MessageRow> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ client_id: clientId, body })
    .select("id, client_id, sender_id, body, read_at, created_at")
    .single();
  if (error) throw error;
  return data as MessageRow;
}

export async function markThreadRead(clientId: string, exceptSenderId: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .neq("sender_id", exceptSenderId)
    .is("read_at", null);
  if (error) throw error;
}

/** Cuántos mensajes de cada cliente todavía no se leyeron (para el badge por cliente del lado del entrenador). */
export async function countUnreadByClient(clientIds: string[]): Promise<Record<string, number>> {
  if (!clientIds.length) return {};
  const { data, error } = await supabase
    .from("messages")
    .select("client_id")
    .in("client_id", clientIds)
    .is("read_at", null);
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of data ?? []) out[row.client_id] = (out[row.client_id] ?? 0) + 1;
  return out;
}

/**
 * Del lado del entrenador/staff: marca como leídos solo los mensajes que
 * escribió el cliente. (Antes se marcaba "todo lo que no escribí yo", que
 * con asistentes en el medio marcaría como leído lo que escribió otro
 * miembro del equipo, como si el cliente lo hubiera visto.)
 */
export async function markClientMessagesRead(clientId: string, clientProfileId: string): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("sender_id", clientProfileId)
    .is("read_at", null);
  if (error) throw error;
}

/** El perfil (cuenta) del cliente, para distinguir sus mensajes de los del equipo. */
export async function getClientProfileId(clientId: string): Promise<string | null> {
  const { data, error } = await supabase.from("clients").select("profile_id").eq("id", clientId).maybeSingle();
  if (error) throw error;
  return (data?.profile_id as string | null) ?? null;
}

/** Nombres de quienes escribieron (para mostrar qué miembro del equipo mandó cada mensaje). */
export async function getSenderNames(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const r of data ?? []) out[r.id as string] = r.full_name as string;
  return out;
}
