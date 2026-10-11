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

export interface ParQAnswers {
  heartCondition: boolean;
  chestPainActivity: boolean;
  chestPainRest: boolean;
  dizziness: boolean;
  boneJoint: boolean;
  medication: boolean;
  other: boolean;
  otherDetail: string;
}

export interface ClientProfileRow {
  client_id: string;
  birth_date: string | null;
  sex: "male" | "female" | "other" | null;
  height_cm: number | null;
  weight_kg: number | null;
  training_level: "beginner" | "intermediate" | "advanced" | "elite" | null;
  sports_history: string | null;
  injuries: string | null;
  medical_notes: string | null;
  main_goal: string | null;
  secondary_goals: string[];
  par_q: ParQAnswers | null;
  habits: { sleepHours: string; activityLevel: string } | null;
  preferences: { trainingDays: string; sessionDuration: string } | null;
  consent_accepted: boolean;
  submitted_at: string | null;
  reviewed_at: string | null;
}

export const MAIN_GOALS = [
  "Hipertrofia",
  "Fuerza",
  "Pérdida de grasa",
  "Recomposición corporal",
  "Rendimiento deportivo",
  "Condición física",
  "Salud general",
  "Movilidad",
  "Retorno progresivo al entrenamiento",
];

export const PAR_Q_QUESTIONS: Array<{ key: keyof Omit<ParQAnswers, "otherDetail">; text: string }> = [
  { key: "heartCondition", text: "¿Tu médico te ha dicho alguna vez que tienes un problema cardíaco?" },
  { key: "chestPainActivity", text: "¿Sientes dolor en el pecho cuando haces actividad física?" },
  { key: "chestPainRest", text: "En el último mes, ¿has tenido dolor en el pecho en reposo?" },
  { key: "dizziness", text: "¿Pierdes el equilibrio por mareo o alguna vez pierdes el conocimiento?" },
  { key: "boneJoint", text: "¿Tienes algún problema óseo o articular que pueda empeorar con el ejercicio?" },
  { key: "medication", text: "¿Tu médico te receta actualmente medicamentos para la presión arterial o el corazón?" },
  { key: "other", text: "¿Conoces alguna otra razón por la que no deberías hacer actividad física?" },
];

/** El id del cliente ligado a la cuenta con la que el usuario inició sesión, o null si no es cliente. */
export async function getMyClientId(): Promise<string | null> {
  const { data, error } = await supabase.rpc("my_client_id");
  if (error) throw error;
  return (data as string) ?? null;
}

/** El entrenador confirma que revisó el formulario de ingreso; recién ahí se desbloquea el resto de la app para el cliente. */
export async function approveIntake(clientId: string): Promise<void> {
  const { error } = await supabase
    .from("client_profiles")
    .update({ reviewed_at: new Date().toISOString() })
    .eq("client_id", clientId);
  if (error) throw error;
}

export async function submitOnboarding(
  clientId: string,
  fields: Omit<Partial<ClientProfileRow>, "client_id" | "submitted_at">
): Promise<void> {
  const { error } = await supabase
    .from("client_profiles")
    .update({ ...fields, consent_accepted: true, submitted_at: new Date().toISOString() })
    .eq("client_id", clientId);
  if (error) throw error;
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

  // El cliente podrá completar su ficha más adelante (el formulario de
  // ingreso), pero las reglas de seguridad solo le permiten ACTUALIZAR una
  // fila ya existente, no crear una nueva — por eso la dejamos preparada
  // (vacía) desde ahora, en el momento en que se crea el cliente.
  const { error: profileError } = await supabase.from("client_profiles").insert({ client_id: client.id });
  if (profileError) throw profileError;

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
