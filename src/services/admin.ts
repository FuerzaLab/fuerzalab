import { supabase } from "../lib/supabase";
import type { Role } from "../types/auth";

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  created_at: string;
  /** Entrenador dueño del estudio (part3u_migration.sql); null si no tiene. */
  owner_id?: string | null;
  /** Contacto de la organización (part4f_migration.sql). */
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  /** Cobro de FuerzaLab (part3y_migration.sql). */
  plan_id?: string | null;
  trial_ends_at?: string | null;
  billing_exempt?: boolean;
  billing_blocked_since?: string | null;
  limit_exceeded_since?: string | null;
}

export interface UserRow {
  id: string;
  organization_id: string | null;
  role: Role;
  full_name: string;
  email: string;
  phone?: string | null;
  is_active: boolean;
  last_sign_in_at: string | null;
  organizations: { name: string } | null;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "org"}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function listOrganizations(): Promise<OrganizationRow[]> {
  const { data, error } = await supabase.from("organizations").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OrganizationRow[];
}

export async function createOrganization(name: string): Promise<OrganizationRow> {
  const { data, error } = await supabase
    .from("organizations")
    .insert({ name, slug: slugify(name) })
    .select()
    .single();
  if (error) throw error;
  return data as OrganizationRow;
}

export async function toggleOrganizationStatus(id: string, status: "active" | "suspended"): Promise<void> {
  const { error } = await supabase.from("organizations").update({ status }).eq("id", id);
  if (error) throw error;
}

/**
 * Cuántos perfiles (entrenadores, staff o clientes) tienen esta
 * organización asignada, ACTIVOS o NO. La base de datos protege la
 * organización mientras exista cualquier perfil apuntando a ella —
 * desactivar a alguien no quita esa referencia, así que no alcanza
 * para poder eliminar la organización después.
 */
export async function countOrganizationMembers(id: string): Promise<number> {
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", id);
  if (error) throw error;
  return count ?? 0;
}

export async function deleteOrganization(id: string): Promise<void> {
  const { error } = await supabase.from("organizations").delete().eq("id", id);
  if (error) throw error;
}

export async function listUsers(): Promise<UserRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    // "!organization_id": desde part3u_migration.sql, profiles y organizations
    // están conectadas de dos formas (la organización de cada perfil, y el
    // dueño de cada organización). Hay que decir cuál usar, o la consulta falla.
    .select("id, organization_id, role, full_name, email, phone, is_active, last_sign_in_at, organizations!organization_id(name)")
    .neq("role", "super_admin")
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as unknown as UserRow[];
}

export async function toggleUserActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

/** Cuántos clientes tiene asignados un entrenador — se usa para permitir moverlo de organización solo si no tiene ninguno. */
export async function countClientsByTrainer(trainerIds: string[]): Promise<Record<string, number>> {
  if (!trainerIds.length) return {};
  const { data, error } = await supabase.from("clients").select("trainer_id").in("trainer_id", trainerIds);
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of data ?? []) out[row.trainer_id] = (out[row.trainer_id] ?? 0) + 1;
  return out;
}

/**
 * Mueve a un entrenador a otra organización. Solo tiene sentido (y solo lo
 * permitimos) cuando no tiene clientes todavía: si los tuviera, perdería el
 * acceso a ellos al instante, porque sus clientes se quedarían con la
 * organización anterior mientras el entrenador pasa a la nueva.
 */
export async function moveTrainerToOrganization(trainerId: string, organizationId: string): Promise<void> {
  const { error } = await supabase.from("profiles").update({ organization_id: organizationId }).eq("id", trainerId);
  if (error) throw error;
}

export interface InvitationRow {
  id: string;
  organization_id: string;
  role: "trainer" | "staff" | "client";
  email: string | null;
  full_name: string | null;
  code: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

/** Las invitaciones de un rol puntual (para Super Admin: entrenadores invitados, aceptaron o no). */
export async function listInvitations(role: "trainer" | "staff" | "client"): Promise<InvitationRow[]> {
  const { data, error } = await supabase
    .from("invitations")
    .select("*")
    .eq("role", role)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as InvitationRow[];
}

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await supabase.from("invitations").update({ status: "revoked" }).eq("id", id);
  if (error) throw error;
}

export async function inviteTrainer(params: {
  organizationId: string;
  invitedBy: string;
  fullName: string;
  email: string;
  /** Celular (WhatsApp): queda en la invitación y pasa a su perfil al aceptar (part4f). */
  phone?: string;
}): Promise<string> {
  const row: Record<string, unknown> = {
    organization_id: params.organizationId,
    invited_by: params.invitedBy,
    role: "trainer",
    full_name: params.fullName,
    email: params.email || null,
  };
  if (params.phone?.trim()) row.phone = params.phone.trim();
  let { data, error } = await supabase.from("invitations").insert(row).select("code").single();
  // Sin part4f_migration.sql no existe la columna phone: se invita igual, sin guardarlo.
  if (error && /phone/.test(error.message)) {
    delete row.phone;
    ({ data, error } = await supabase.from("invitations").insert(row).select("code").single());
  }
  if (error) throw error;
  return data!.code as string;
}

/** Guarda el contacto de una organización (persona, correo y WhatsApp). */
export async function setOrganizationContact(orgId: string, c: { contact_name: string; contact_email: string; contact_phone: string }): Promise<void> {
  const { error } = await supabase
    .from("organizations")
    .update({ contact_name: c.contact_name.trim() || null, contact_email: c.contact_email.trim() || null, contact_phone: c.contact_phone.trim() || null })
    .eq("id", orgId);
  if (error) {
    if (/contact_/.test(error.message)) throw new Error("Falta correr part4f_migration.sql en Supabase.");
    throw error;
  }
}

/** Elige qué entrenador es el dueño del estudio (o ninguno). Ver part3u_migration.sql. */
export async function setOrganizationOwner(orgId: string, ownerId: string | null): Promise<void> {
  const { data, error } = await supabase.from("organizations").update({ owner_id: ownerId }).eq("id", orgId).select("id");
  if (error) {
    if (/owner_id/.test(error.message)) throw new Error("Falta correr part3u_migration.sql en Supabase.");
    throw error;
  }
  if (!data || data.length === 0) throw new Error("No se pudo guardar el dueño del estudio.");
}
