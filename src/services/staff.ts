import { supabase } from "../lib/supabase";
import type { StaffPermissions, StaffClientScope } from "../types/auth";

/** Un asistente que ya aceptó la invitación y quedó vinculado al entrenador. */
export interface StaffMemberRow {
  id: string; // fila de staff_permissions
  staff_id: string;
  permissions: StaffPermissions;
  client_scope: StaffClientScope;
  created_at: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  last_sign_in_at: string | null;
}

export interface StaffInvitationRow {
  id: string;
  code: string;
  email: string | null;
  full_name: string | null;
  /** Puede traer también la clave "_client_scope" (ver inviteStaff). */
  permissions: StaffPermissions & { _client_scope?: StaffClientScope };
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  created_at: string;
}

export async function listMyStaff(trainerId: string): Promise<StaffMemberRow[]> {
  const { data, error } = await supabase
    .from("staff_permissions")
    .select(
      "*, staff:profiles!staff_permissions_staff_id_fkey(full_name, email, phone, is_active, last_sign_in_at)",
    )
    .eq("trainer_id", trainerId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const p = Array.isArray(row.staff) ? row.staff[0] : row.staff;
    return {
      id: row.id,
      staff_id: row.staff_id,
      permissions: (row.permissions ?? {}) as StaffPermissions,
      client_scope: row.client_scope === "assigned" ? "assigned" : "all",
      created_at: row.created_at,
      full_name: p?.full_name ?? "Asistente",
      email: p?.email ?? "",
      phone: p?.phone ?? null,
      is_active: p?.is_active ?? true,
      last_sign_in_at: p?.last_sign_in_at ?? null,
    };
  });
}

/** Invitaciones de staff que creó este entrenador (las aceptadas ya aparecen como miembros). */
export async function listStaffInvitations(): Promise<StaffInvitationRow[]> {
  const { data, error } = await supabase
    .from("invitations")
    .select("id, code, email, full_name, permissions, status, expires_at, created_at")
    .eq("role", "staff")
    .in("status", ["pending", "expired"])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StaffInvitationRow[];
}

export async function inviteStaff(params: {
  organizationId: string;
  trainerId: string;
  fullName: string;
  email: string;
  permissions: StaffPermissions;
  clientScope: StaffClientScope;
}): Promise<string> {
  const { data, error } = await supabase
    .from("invitations")
    .insert({
      organization_id: params.organizationId,
      trainer_id: params.trainerId,
      role: "staff",
      full_name: params.fullName,
      email: params.email || null,
      // El alcance de clientes viaja dentro de "permissions" porque es lo
      // único que la base de datos copia de la invitación al aceptarla; un
      // trigger (part3p_migration.sql) lo pasa después a su propia columna.
      permissions: { ...params.permissions, _client_scope: params.clientScope },
    })
    .select("code")
    .single();
  if (error) throw error;
  return data.code as string;
}

export async function revokeStaffInvitation(id: string): Promise<void> {
  const { error } = await supabase.from("invitations").update({ status: "revoked" }).eq("id", id);
  if (error) throw error;
}

export async function updateStaffPermissions(id: string, permissions: StaffPermissions): Promise<void> {
  const { data, error } = await supabase
    .from("staff_permissions")
    .update({ permissions })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  // Si las reglas de seguridad filtran la fila, Supabase no da error: solo
  // no actualiza nada. Se chequea a mano para no mostrar "Guardado" en falso.
  if (!data || data.length === 0) throw new Error("No se pudieron guardar los permisos.");
}

/** Desactivar bloquea el acceso por completo (sin borrar nada); se puede revertir. */
export async function setStaffActive(staffId: string, active: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_profile_active", { p_profile: staffId, p_active: active });
  if (error) throw error;
}

/** Cuántos clientes tiene asignados cada asistente de este entrenador. */
export async function countAssignmentsByStaff(trainerId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.from("staff_client_assignments").select("staff_id").eq("trainer_id", trainerId);
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.staff_id as string] = (out[r.staff_id as string] ?? 0) + 1;
  return out;
}

export async function listAssignedClientIds(staffId: string): Promise<string[]> {
  const { data, error } = await supabase.from("staff_client_assignments").select("client_id").eq("staff_id", staffId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.client_id as string);
}

/**
 * Guarda qué clientes ve un asistente: el alcance (todos / solo
 * asignados) y, si es "solo asignados", exactamente esta lista. Las
 * asignaciones se conservan aunque se pase a "todos", por si después se
 * vuelve a "solo asignados".
 */
export async function saveClientAccess(params: {
  memberId: string;
  staffId: string;
  scope: StaffClientScope;
  clientIds: string[];
}): Promise<void> {
  const { data, error } = await supabase
    .from("staff_permissions")
    .update({ client_scope: params.scope })
    .eq("id", params.memberId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("No se pudo guardar el acceso a clientes.");

  const current = new Set(await listAssignedClientIds(params.staffId));
  const wanted = new Set(params.clientIds);
  const toAdd = params.clientIds.filter((id) => !current.has(id));
  const toRemove = Array.from(current).filter((id) => !wanted.has(id));

  if (toAdd.length) {
    const { error: insErr } = await supabase
      .from("staff_client_assignments")
      .insert(toAdd.map((client_id) => ({ staff_id: params.staffId, client_id })));
    if (insErr) throw insErr;
  }
  if (toRemove.length) {
    const { error: delErr } = await supabase
      .from("staff_client_assignments")
      .delete()
      .eq("staff_id", params.staffId)
      .in("client_id", toRemove);
    if (delErr) throw delErr;
  }
}
