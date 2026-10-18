import { supabase } from "../lib/supabase";

export interface PlatformPlanRow {
  id: string;
  name: string;
  client_limit: number | null;
  trainer_limit: number | null;
  price: number;
  currency: string;
  billing_period: "monthly" | "quarterly" | "annual";
  is_active: boolean;
}

export type SubscriptionStatus = "pending" | "paid" | "overdue" | "cancelled";

export interface OrganizationSubscriptionRow {
  id: string;
  organization_id: string;
  platform_plan_id: string | null;
  plan_name: string | null;
  status: SubscriptionStatus;
  amount: number;
  currency: string;
  due_date: string;
  paid_at: string | null;
  method: string | null;
  notes: string | null;
  created_at: string;
}

export const BILLING_PERIOD_LABEL: Record<PlatformPlanRow["billing_period"], string> = {
  monthly: "Mensual",
  quarterly: "Trimestral",
  annual: "Anual",
};

export async function listPlatformPlans(): Promise<PlatformPlanRow[]> {
  const { data, error } = await supabase
    .from("platform_plans")
    .select("id, name, client_limit, trainer_limit, price, currency, billing_period, is_active")
    .order("price");
  if (error) throw error;
  return (data ?? []) as PlatformPlanRow[];
}

export async function createPlatformPlan(params: {
  name: string;
  clientLimit: number | null;
  trainerLimit: number | null;
  price: number;
  currency: string;
  billingPeriod: PlatformPlanRow["billing_period"];
}): Promise<PlatformPlanRow> {
  const { data, error } = await supabase
    .from("platform_plans")
    .insert({
      name: params.name,
      client_limit: params.clientLimit,
      trainer_limit: params.trainerLimit,
      price: params.price,
      currency: params.currency,
      billing_period: params.billingPeriod,
    })
    .select("id, name, client_limit, trainer_limit, price, currency, billing_period, is_active")
    .single();
  if (error) throw error;
  return data as PlatformPlanRow;
}

export async function updatePlatformPlan(id: string, fields: {
  name: string;
  clientLimit: number | null;
  trainerLimit: number | null;
  price: number;
  currency: string;
  billingPeriod: PlatformPlanRow["billing_period"];
}): Promise<void> {
  const { error } = await supabase
    .from("platform_plans")
    .update({
      name: fields.name,
      client_limit: fields.clientLimit,
      trainer_limit: fields.trainerLimit,
      price: fields.price,
      currency: fields.currency,
      billing_period: fields.billingPeriod,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function setPlatformPlanActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("platform_plans").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function listOrganizationSubscriptions(organizationId?: string): Promise<OrganizationSubscriptionRow[]> {
  let q = supabase
    .from("organization_subscriptions")
    .select("id, organization_id, platform_plan_id, status, amount, currency, due_date, paid_at, method, notes, created_at, platform_plans(name)")
    .order("due_date", { ascending: false });
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, plan_name: row.platform_plans?.name ?? null })) as OrganizationSubscriptionRow[];
}

export async function createOrganizationSubscription(params: {
  organizationId: string;
  platformPlanId: string | null;
  status: SubscriptionStatus;
  amount: number;
  currency: string;
  dueDate: string;
  method: string;
  notes: string;
}): Promise<OrganizationSubscriptionRow> {
  const { data, error } = await supabase
    .from("organization_subscriptions")
    .insert({
      organization_id: params.organizationId,
      platform_plan_id: params.platformPlanId,
      status: params.status,
      amount: params.amount,
      currency: params.currency,
      due_date: params.dueDate,
      method: params.method || null,
      notes: params.notes || null,
      paid_at: params.status === "paid" ? new Date().toISOString() : null,
    })
    .select("id, organization_id, platform_plan_id, status, amount, currency, due_date, paid_at, method, notes, created_at, platform_plans(name)")
    .single();
  if (error) throw error;
  return { ...(data as any), plan_name: (data as any).platform_plans?.name ?? null } as OrganizationSubscriptionRow;
}

export async function markSubscriptionPaid(id: string): Promise<void> {
  const { error } = await supabase.from("organization_subscriptions").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function updateOrganizationSubscription(id: string, fields: {
  status: SubscriptionStatus;
  amount: number;
  currency: string;
  dueDate: string;
  method: string;
  notes: string;
}): Promise<void> {
  const { error } = await supabase
    .from("organization_subscriptions")
    .update({
      status: fields.status,
      amount: fields.amount,
      currency: fields.currency,
      due_date: fields.dueDate,
      method: fields.method || null,
      notes: fields.notes || null,
      paid_at: fields.status === "paid" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw error;
}
