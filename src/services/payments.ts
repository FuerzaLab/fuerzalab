import { supabase } from "../lib/supabase";

export interface PaymentPlanRow {
  id: string;
  name: string;
  price: number;
  currency: string;
  billing_period: "monthly" | "quarterly" | "custom";
  description: string | null;
  is_active: boolean;
}

export type PaymentStatus = "pending" | "paid" | "cancelled";
export type PaymentMethod = "cash" | "transfer" | "online" | "other";

export interface PaymentRow {
  id: string;
  client_id: string;
  client_plan_id: string | null;
  amount: number;
  currency: string;
  due_date: string;
  paid_at: string | null;
  method: PaymentMethod | null;
  status: PaymentStatus;
  receipt_path: string | null;
  notes: string | null;
  created_at: string;
  plan_name: string | null;
  /** Período del plan (para crear el próximo pago al marcar este como pagado). */
  plan_period?: "monthly" | "quarterly" | "custom" | null;
}

/** Vincula al cliente con un plan (una suscripción) para que el pago quede asociado a él. */
export async function subscribeClientToPlan(params: {
  organizationId: string;
  trainerId: string;
  clientId: string;
  planId: string;
  dueDate: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from("client_plans")
    .insert({
      organization_id: params.organizationId,
      trainer_id: params.trainerId,
      client_id: params.clientId,
      plan_id: params.planId,
      due_date: params.dueDate,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function listPaymentPlans(): Promise<PaymentPlanRow[]> {
  const { data, error } = await supabase
    .from("payment_plans")
    .select("id, name, price, currency, billing_period, description, is_active")
    .eq("is_active", true)
    .order("price");
  if (error) throw error;
  return (data ?? []) as PaymentPlanRow[];
}

export async function createPaymentPlan(params: {
  organizationId: string;
  trainerId: string;
  name: string;
  price: number;
  currency: string;
  billingPeriod: PaymentPlanRow["billing_period"];
  description: string;
}): Promise<PaymentPlanRow> {
  const { data, error } = await supabase
    .from("payment_plans")
    .insert({
      organization_id: params.organizationId,
      trainer_id: params.trainerId,
      name: params.name,
      price: params.price,
      currency: params.currency,
      billing_period: params.billingPeriod,
      description: params.description || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PaymentPlanRow;
}

export async function updatePaymentPlan(id: string, fields: {
  name: string;
  price: number;
  currency: string;
  billingPeriod: PaymentPlanRow["billing_period"];
  description: string;
}): Promise<void> {
  const { error } = await supabase
    .from("payment_plans")
    .update({
      name: fields.name,
      price: fields.price,
      currency: fields.currency,
      billing_period: fields.billingPeriod,
      description: fields.description || null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function listPayments(clientId?: string): Promise<PaymentRow[]> {
  let q = supabase
    .from("payments")
    .select(
      "id, client_id, client_plan_id, amount, currency, due_date, paid_at, method, status, receipt_path, notes, created_at, client_plans(payment_plans(name, billing_period))"
    )
    .order("due_date", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    plan_name: row.client_plans?.payment_plans?.name ?? null,
    plan_period: row.client_plans?.payment_plans?.billing_period ?? null,
  })) as PaymentRow[];
}

export async function createPayment(params: {
  organizationId: string;
  trainerId: string;
  clientId: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: PaymentStatus;
  method: PaymentMethod | null;
  notes: string;
  clientPlanId?: string | null;
}): Promise<PaymentRow> {
  const { data, error } = await supabase
    .from("payments")
    .insert({
      organization_id: params.organizationId,
      trainer_id: params.trainerId,
      client_id: params.clientId,
      client_plan_id: params.clientPlanId ?? null,
      amount: params.amount,
      currency: params.currency,
      due_date: params.dueDate,
      status: params.status,
      method: params.method,
      notes: params.notes || null,
      paid_at: params.status === "paid" ? new Date().toISOString() : null,
    })
    .select("id, client_id, client_plan_id, amount, currency, due_date, paid_at, method, status, receipt_path, notes, created_at, client_plans(payment_plans(name))")
    .single();
  if (error) throw error;
  return { ...(data as any), plan_name: (data as any).client_plans?.payment_plans?.name ?? null } as PaymentRow;
}

export async function updatePayment(id: string, fields: {
  amount: number;
  currency: string;
  dueDate: string;
  status: PaymentStatus;
  method: PaymentMethod | null;
  notes: string;
}): Promise<void> {
  const { error } = await supabase
    .from("payments")
    .update({
      amount: fields.amount,
      currency: fields.currency,
      due_date: fields.dueDate,
      status: fields.status,
      method: fields.method,
      notes: fields.notes || null,
      paid_at: fields.status === "paid" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function markPaymentPaid(id: string): Promise<void> {
  const { error } = await supabase.from("payments").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function uploadReceipt(params: {
  paymentId: string;
  organizationId: string;
  clientId: string;
  file: File;
}): Promise<void> {
  const path = `${params.organizationId}/${params.clientId}/receipts/${Date.now()}-${params.file.name}`;
  const { error: upErr } = await supabase.storage.from("client-files").upload(path, params.file, { upsert: false });
  if (upErr) throw upErr;
  const { error: updErr } = await supabase.from("payments").update({ receipt_path: path }).eq("id", params.paymentId);
  if (updErr) throw updErr;
}

export async function getReceiptUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("client-files").createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

/** Estado "real" de un pago pendiente según su vencimiento (hoy en la hora local). */
export function dueInfo(p: Pick<PaymentRow, "status" | "due_date">): { kind: "overdue" | "soon" | "later" | "none"; days: number } {
  if (p.status !== "pending") return { kind: "none", days: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(p.due_date + "T00:00:00");
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { kind: "overdue", days: -days };
  if (days <= 5) return { kind: "soon", days };
  return { kind: "later", days };
}

/**
 * Al marcar como pagado un pago de un plan mensual o trimestral, crea el
 * pendiente del próximo período (si todavía no hay uno pendiente de ese
 * plan), para que el aviso de vencimiento vuelva a funcionar sin cargar nada.
 * Devuelve la fecha de vencimiento creada, o null si no correspondía.
 */
export async function createNextPeriodPayment(paid: PaymentRow): Promise<string | null> {
  if (!paid.client_plan_id || (paid.plan_period !== "monthly" && paid.plan_period !== "quarterly")) return null;
  const { data: pend } = await supabase
    .from("payments")
    .select("id")
    .eq("client_plan_id", paid.client_plan_id)
    .eq("status", "pending")
    .limit(1);
  if (pend && pend.length > 0) return null;
  const due = addMonthsClamped(paid.due_date, paid.plan_period === "monthly" ? 1 : 3);
  const { error } = await supabase.from("payments").insert({
    client_id: paid.client_id,
    client_plan_id: paid.client_plan_id,
    amount: paid.amount,
    currency: paid.currency,
    due_date: due,
    status: "pending",
  });
  if (error) throw error;
  return due;
}

/** Suma meses a una fecha AAAA-MM-DD sin saltar de mes (31/01 + 1 mes = 28/02 o 29/02). */
export function addMonthsClamped(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/**
 * Red de seguridad: para cada plan mensual o trimestral cuyo último pago está
 * pagado y que no tiene ningún pendiente, crea el pendiente del período
 * siguiente. Así nunca queda un alumno "sin próximo cobro" (por ejemplo, si el
 * pago se pasó a Pagado desde Editar, o se registró antes de que existiera el
 * cobro automático) y los avisos de vencimiento funcionan.
 * Devuelve cuántos creó.
 */
export async function ensureNextPeriodPayments(payments?: PaymentRow[]): Promise<number> {
  const list = payments ?? (await listPayments());
  const byPlan = new Map<string, PaymentRow[]>();
  for (const p of list) {
    if (!p.client_plan_id || p.status === "cancelled") continue;
    if (!byPlan.has(p.client_plan_id)) byPlan.set(p.client_plan_id, []);
    byPlan.get(p.client_plan_id)!.push(p);
  }
  // A los alumnos en pausa o dados de baja no se les crea el próximo cobro.
  const ids = [...new Set(list.map((p) => p.client_id))];
  const { data: cs } = ids.length ? await supabase.from("clients").select("id, status").in("id", ids) : { data: [] as any[] };
  const activeIds = new Set((cs ?? []).filter((c: any) => c.status === "active" || c.status === "prospect").map((c: any) => c.id as string));
  let created = 0;
  for (const rows of byPlan.values()) {
    if (!activeIds.has(rows[0].client_id)) continue;
    if (rows.some((r) => r.status === "pending")) continue;
    const last = [...rows].sort((a, b) => b.due_date.localeCompare(a.due_date))[0];
    if (last?.status !== "paid") continue;
    const due = await createNextPeriodPayment(last).catch(() => null);
    if (due) created++;
  }
  return created;
}
