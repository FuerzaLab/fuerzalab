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
      billing_period: params.billingPeriod,
      description: params.description || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PaymentPlanRow;
}

export async function listPayments(clientId?: string): Promise<PaymentRow[]> {
  let q = supabase
    .from("payments")
    .select("id, client_id, client_plan_id, amount, currency, due_date, paid_at, method, status, receipt_path, notes, created_at")
    .order("due_date", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PaymentRow[];
}

export async function createPayment(params: {
  organizationId: string;
  trainerId: string;
  clientId: string;
  amount: number;
  dueDate: string;
  status: PaymentStatus;
  method: PaymentMethod | null;
  notes: string;
}): Promise<PaymentRow> {
  const { data, error } = await supabase
    .from("payments")
    .insert({
      organization_id: params.organizationId,
      trainer_id: params.trainerId,
      client_id: params.clientId,
      amount: params.amount,
      due_date: params.dueDate,
      status: params.status,
      method: params.method,
      notes: params.notes || null,
      paid_at: params.status === "paid" ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PaymentRow;
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
