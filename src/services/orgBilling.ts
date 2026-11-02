import { supabase } from "../lib/supabase";

/**
 * Cobro de FuerzaLab a las organizaciones (part3y_migration.sql).
 * Lo que la app necesita saber de la propia organización: plan, prueba,
 * próximo cobro, tope de alumnos y si está bloqueada.
 */
export interface OrgBilling {
  role: "trainer" | "staff" | "client";
  organization?: string;
  suspended: boolean;
  /** Solo alumnos: si ya se les cortó el acceso (7 días después del bloqueo). */
  client_blocked?: boolean;
  exempt?: boolean;
  blocked_since?: string | null;
  trial_ends_at?: string | null;
  limit_exceeded_since?: string | null;
  active_clients?: number;
  counted_clients?: number;
  plan?: {
    name: string;
    price: number;
    currency: string;
    period: string;
    included_clients: number | null;
    price_per_client: number;
    client_limit: number | null;
    trainer_limit: number | null;
  } | null;
  estimated_amount?: number | null;
  next_due?: { due_date: string; amount: number; currency: string } | null;
}

/** Recalcula el estado (por si venció algo) y lo devuelve. null si no aplica o falta la migración. */
export async function fetchMyOrgBilling(): Promise<OrgBilling | null> {
  await supabase.rpc("refresh_my_org_billing").then(() => null, () => null);
  const { data, error } = await supabase.rpc("my_org_billing");
  if (error) return null;
  return (data ?? null) as OrgBilling | null;
}

const today = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const dateOnly = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00");
export const daysBetween = (from: Date, to: Date) => Math.round((to.getTime() - from.getTime()) / 86400000);

/** ¿Esta persona tiene el acceso cortado? (y por qué) */
export function billingBlock(b: OrgBilling | null): null | { reason: "suspended" | "unpaid"; clientsUntil?: string } {
  if (!b) return null;
  if (b.suspended) return { reason: "suspended" };
  if (b.role === "client") return b.client_blocked ? { reason: "unpaid" } : null;
  if (b.blocked_since && dateOnly(b.blocked_since) <= today()) {
    const until = dateOnly(b.blocked_since);
    until.setDate(until.getDate() + 7);
    return { reason: "unpaid", clientsUntil: until.toISOString().slice(0, 10) };
  }
  return null;
}

// --- Super Admin --------------------------------------------------------

export interface PlatformEvent {
  id: string;
  created_at: string;
  kind: "client_added" | "trainer_added" | "limit_exceeded" | "org_blocked" | "trial_ending";
  organization_id: string | null;
  payload: Record<string, any>;
  seen_at: string | null;
}

export async function refreshAllOrgBilling(): Promise<void> {
  await supabase.rpc("refresh_all_org_billing").then(() => null, () => null);
}

export async function listPlatformEvents(limit = 60): Promise<PlatformEvent[]> {
  const { data, error } = await supabase.from("platform_events").select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) return [];
  return (data ?? []) as PlatformEvent[];
}

export async function markPlatformEventsSeen(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const { error } = await supabase.from("platform_events").update({ seen_at: new Date().toISOString() }).in("id", ids);
  if (error) throw error;
}

export async function setOrgBillingSettings(orgId: string, fields: { plan_id?: string | null; trial_ends_at?: string | null; billing_exempt?: boolean }): Promise<void> {
  const { data, error } = await supabase.from("organizations").update(fields).eq("id", orgId).select("id");
  if (error) {
    if (/plan_id|trial_ends_at|billing_exempt/.test(error.message)) throw new Error("Falta correr part3y_migration.sql en Supabase.");
    throw error;
  }
  if (!data || data.length === 0) throw new Error("No se pudo guardar.");
}

/** Monto del próximo período para una organización (base + alumnos extra). */
export async function orgPeriodAmount(orgId: string, planId?: string | null): Promise<number | null> {
  const { data, error } = await supabase.rpc("org_period_amount", { p_org: orgId, p_plan: planId ?? null });
  if (error) return null;
  return data == null ? null : Number(data);
}

export async function orgClientCounts(orgId: string): Promise<{ active: number; counted: number }> {
  const { data } = await supabase.from("clients").select("status").eq("organization_id", orgId).in("status", ["active", "prospect"]);
  const list = data ?? [];
  return { active: list.filter((c: any) => c.status === "active").length, counted: list.length };
}
