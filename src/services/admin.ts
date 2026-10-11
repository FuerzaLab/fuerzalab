import { supabase } from "../lib/supabase";
import type { Role } from "../types/auth";

export interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  created_at: string;
}

export interface UserRow {
  id: string;
  organization_id: string | null;
  role: Role;
  full_name: string;
  email: string;
  is_active: boolean;
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
    .select("id, organization_id, role, full_name, email, is_active, organizations(name)")
    .neq("role", "super_admin")
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as unknown as UserRow[];
}

export async function toggleUserActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function inviteTrainer(params: {
  organizationId: string;
  invitedBy: string;
  fullName: string;
  email: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("invitations")
    .insert({
      organization_id: params.organizationId,
      invited_by: params.invitedBy,
      role: "trainer",
      full_name: params.fullName,
      email: params.email || null,
    })
    .select("code")
    .single();
  if (error) throw error;
  return data.code as string;
}
