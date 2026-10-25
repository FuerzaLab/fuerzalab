import { supabase } from "../lib/supabase";
import type { StaffPermissions } from "../types/auth";

/** Un asistente que ya aceptó la invitación y quedó vinculado al entrenador. */
export interface StaffMemberRow {
  id: string; // fila de staff_permissions
  staff_id: string;
  permissions: StaffPermissions;
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
  permissions: StaffPermissions;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  created_at: string;
}

export async function listMyStaff(trainerId: string): Promise<StaffMemberRow[]> {
  const { data, error } = await supabase
    .from("staff_permissions")
    .select(
      "id, staff_id, permissions, created_at, staff:profiles!staff_permissions_staff_id_fkey(full_name, email, phone, is_active, last_sign_in_at)",
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
}): Promise<string> {
  const { data, error } = await supabase
    .from("invitations")
    .insert({
      organization_id: params.organizationId,
      trainer_id: params.trainerId,
      role: "staff",
      full_name: params.fullName,
      email: params.email || null,
      permissions: params.permissions,
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
