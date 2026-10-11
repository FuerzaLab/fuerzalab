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
