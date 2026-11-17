import { supabase } from "../lib/supabase";
import { compressImage } from "../lib/imageCompress";
import type { OrgBilling } from "./orgBilling";

/**
 * Cobro por alumno (part4q_migration.sql): cada alumno le paga a FuerzaLab
 * su plan por QR y sube el comprobante; el Super Admin lo confirma.
 * El entrenador nunca pierde el acceso a los datos de sus alumnos.
 */

export interface StudentPlan {
  id: string;
  name: string;
  months: number;
  price: number;
  currency: string;
  active: boolean;
  sort: number;
}

export interface PlatformSettings {
  id: number;
  beta_mode: boolean;
  free_days: number;
  grace_days: number;
  reminder_days: number;
  qr_path: string | null;
  qr_expires_on: string | null;
  account_holder: string;
  bank_name: string | null;
}

export interface StudentPayment {
  id: string;
  client_id: string;
  organization_id: string | null;
  plan_id: string | null;
  plan_name: string | null;
  months: number | null;
  amount: number | null;
  currency: string;
  receipt_path: string | null;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const BUCKET = "platform-files";
const MISSING = "Falta correr part4q_migration.sql en Supabase.";
const wrap = (e: any) => (/student_|platform_settings|access_until|admin_students_billing/.test(e?.message ?? "") ? new Error(MISSING) : e);

export const money = (n: number | null | undefined, cur = "Bs") => `${cur} ${Number(n ?? 0).toLocaleString("es", { maximumFractionDigits: 2 })}`;
export const fmtDate = (iso: string) => new Date(iso.slice(0, 10) + "T12:00:00").toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
export const monthsLabel = (m: number) => (m === 1 ? "1 mes" : `${m} meses`);

// --- Estado del plan del alumno -------------------------------------------

export type StudentPlanState =
  | { kind: "none" } // sin datos (sin la migración o sin cuenta)
  | { kind: "exempt" }
  | { kind: "ok" | "soon"; until: string; daysLeft: number }
  | { kind: "grace"; until: string; graceLeft: number }
  | { kind: "blocked"; until: string };

const today0 = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const day = (iso: string) => new Date(iso.slice(0, 10) + "T00:00:00");
const diff = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);

export function studentPlanState(b: OrgBilling | null): StudentPlanState {
  if (!b || b.role !== "client") return { kind: "none" };
  if (b.student_exempt) return { kind: "exempt" };
  if (!b.access_until) return { kind: "none" };
  const left = diff(today0(), day(b.access_until));
  const grace = b.grace_days ?? 7;
  if (left >= 0) return { kind: left <= (b.reminder_days ?? 5) ? "soon" : "ok", until: b.access_until, daysLeft: left };
  if (-left <= grace) return { kind: "grace", until: b.access_until, graceLeft: grace + left };
  return { kind: "blocked", until: b.access_until };
}

/** Lo mismo, desde los datos de una ficha (para el entrenador y el Super Admin). */
export function clientPlanState(accessUntil: string | null | undefined, exempt: boolean | undefined, grace = 7, reminder = 5): StudentPlanState {
  return studentPlanState({ role: "client", suspended: false, access_until: accessUntil ?? null, student_exempt: !!exempt, grace_days: grace, reminder_days: reminder } as OrgBilling);
}

// --- Alumno ---------------------------------------------------------------

export async function fetchActivePlans(): Promise<StudentPlan[]> {
  const { data, error } = await supabase.from("student_plans").select("*").eq("active", true).order("sort");
  if (error) throw wrap(error);
  return (data ?? []) as StudentPlan[];
}

export async function fetchPlatformSettings(): Promise<PlatformSettings | null> {
  const { data, error } = await supabase.from("platform_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw wrap(error);
  return (data ?? null) as PlatformSettings | null;
}

export async function platformFileUrl(path: string, seconds = 600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error || !data?.signedUrl) throw error ?? new Error("No se pudo abrir el archivo.");
  return data.signedUrl;
}

export async function listMyPayments(clientId: string): Promise<StudentPayment[]> {
  const { data, error } = await supabase.from("student_payments").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(24);
  if (error) throw wrap(error);
  return (data ?? []) as StudentPayment[];
}

/** El alumno sube el comprobante del QR y queda "en revisión". */
export async function submitStudentPayment(clientId: string, planId: string, file: File): Promise<StudentPayment> {
  const isPdf = file.type === "application/pdf";
  const body = isPdf ? file : await compressImage(file).catch(() => file);
  const ext = isPdf ? "pdf" : (body.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
  const path = `receipts/${clientId}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, body, { upsert: false, contentType: body.type || undefined });
  if (upErr) throw wrap(upErr);
  const { data, error } = await supabase.from("student_payments").insert({ client_id: clientId, plan_id: planId, receipt_path: path }).select().single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw wrap(error);
  }
  return data as StudentPayment;
}

// --- Super Admin ------------------------------------------------------------

export interface StudentBillingRow {
  client_id: string;
  client_name: string;
  client_status: string;
  has_account: boolean;
  access_until: string | null;
  exempt: boolean;
  organization_id: string;
  organization_name: string;
  trainer_name: string | null;
  last_paid_at: string | null;
  last_plan: string | null;
  pending_payments: number;
}

export async function fetchStudentsBilling(): Promise<StudentBillingRow[]> {
  const { data, error } = await supabase.rpc("admin_students_billing");
  if (error) throw wrap(error);
  return (data ?? []) as StudentBillingRow[];
}

export async function fetchAllPlans(): Promise<StudentPlan[]> {
  const { data, error } = await supabase.from("student_plans").select("*").order("sort");
  if (error) throw wrap(error);
  return (data ?? []) as StudentPlan[];
}

export async function savePlan(plan: Partial<StudentPlan> & { id?: string }): Promise<void> {
  const { id, ...fields } = plan;
  const q = id ? supabase.from("student_plans").update(fields).eq("id", id).select("id") : supabase.from("student_plans").insert(fields).select("id");
  const { data, error } = await q;
  if (error) throw wrap(error);
  if (!data?.length) throw new Error("No se pudo guardar el plan.");
}

export async function deletePlan(id: string): Promise<void> {
  const { error } = await supabase.from("student_plans").delete().eq("id", id);
  if (error) throw wrap(error);
}

export async function savePlatformSettings(fields: Partial<PlatformSettings>): Promise<void> {
  const { data, error } = await supabase.from("platform_settings").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", 1).select("id");
  if (error) throw wrap(error);
  if (!data?.length) throw new Error("No se pudo guardar.");
}

export async function uploadQr(file: File, previous: string | null): Promise<string> {
  const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
  const path = `qr/qr-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw wrap(error);
  await savePlatformSettings({ qr_path: path });
  if (previous) await supabase.storage.from(BUCKET).remove([previous]).catch(() => {});
  return path;
}

export async function listPendingPayments(): Promise<StudentPayment[]> {
  const { data, error } = await supabase.from("student_payments").select("*").eq("status", "pending").order("created_at");
  if (error) throw wrap(error);
  return (data ?? []) as StudentPayment[];
}

export async function listClientPayments(clientId: string): Promise<StudentPayment[]> {
  return listMyPayments(clientId);
}

export async function reviewPayment(id: string, approve: boolean, note?: string): Promise<StudentPayment> {
  const { data, error } = await supabase.rpc("admin_review_student_payment", { p_id: id, p_approve: approve, p_note: note ?? null });
  if (error) throw wrap(error);
  return data as StudentPayment;
}

export async function addManualPayment(clientId: string, planId: string, amount: number | null, note: string): Promise<StudentPayment> {
  const { data, error } = await supabase.rpc("admin_add_student_payment", { p_client: clientId, p_plan: planId, p_amount: amount, p_note: note || null });
  if (error) throw wrap(error);
  return data as StudentPayment;
}

export async function setStudentAccess(clientId: string, until: string | null, exempt: boolean): Promise<void> {
  const { error } = await supabase.rpc("admin_set_student_access", { p_client: clientId, p_until: until, p_exempt: exempt });
  if (error) throw wrap(error);
}
