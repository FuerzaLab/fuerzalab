import { supabase } from "../lib/supabase";

export type AssessmentType = "initial" | "periodic" | "ad_hoc" | "self_report";

export interface AssessmentRow {
  id: string;
  client_id: string;
  assessed_at: string;
  type: AssessmentType;
  notes: string | null;
  created_at: string;
}

export interface BodyMeasurementRow {
  id: string;
  assessment_id: string;
  weight_kg: number;
  height_cm: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
}

export type CircumferenceSite = "neck" | "shoulders" | "chest" | "waist" | "hip" | "arm" | "forearm" | "thigh" | "calf" | "custom";

export interface CircumferenceRow {
  id: string;
  assessment_id: string;
  site: CircumferenceSite;
  custom_label: string | null;
  side: "left" | "right" | "none";
  value_cm: number;
}

export const SITE_LABEL: Record<CircumferenceSite, string> = {
  neck: "Cuello",
  shoulders: "Hombros",
  chest: "Pecho",
  waist: "Cintura",
  hip: "Cadera",
  arm: "Brazo",
  forearm: "Antebrazo",
  thigh: "Muslo",
  calf: "Pantorrilla",
  custom: "Personalizado",
};

export interface StrengthTestRow {
  id: string;
  assessment_id: string;
  exercise_id: string;
  exercise_name?: string;
  load_kg: number;
  reps: number;
  is_direct_1rm: boolean;
  estimated_1rm: number;
}

export const TYPE_LABEL: Record<AssessmentType, string> = {
  initial: "Inicial",
  periodic: "Periódica",
  ad_hoc: "Puntual",
  self_report: "Autoreporte del cliente",
};

export async function listAssessments(clientId: string): Promise<AssessmentRow[]> {
  const { data, error } = await supabase
    .from("assessments")
    .select("id, client_id, assessed_at, type, notes, created_at")
    .eq("client_id", clientId)
    .order("assessed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AssessmentRow[];
}

export async function createAssessment(params: {
  organizationId: string;
  trainerId: string;
  clientId: string;
  assessedAt: string;
  type: AssessmentType;
  notes: string;
}): Promise<AssessmentRow> {
  const { data, error } = await supabase
    .from("assessments")
    .insert({
      organization_id: params.organizationId,
      trainer_id: params.trainerId,
      client_id: params.clientId,
      assessed_at: params.assessedAt,
      type: params.type,
      notes: params.notes || null,
    })
    .select("id, client_id, assessed_at, type, notes, created_at")
    .single();
  if (error) throw error;
  return data as AssessmentRow;
}

export async function deleteAssessment(id: string): Promise<void> {
  const { error } = await supabase.from("assessments").delete().eq("id", id);
  if (error) throw error;
}

export async function getBodyMeasurement(assessmentId: string): Promise<BodyMeasurementRow | null> {
  const { data, error } = await supabase
    .from("body_measurements")
    .select("id, assessment_id, weight_kg, height_cm, body_fat_pct, muscle_mass_kg")
    .eq("assessment_id", assessmentId)
    .maybeSingle();
  if (error) throw error;
  return data as BodyMeasurementRow | null;
}

/** La fila es única por evaluación (una sola por assessment), así que se puede crear o actualizar según exista o no. */
export async function upsertBodyMeasurement(
  assessmentId: string,
  existingId: string | undefined,
  fields: { weight_kg: number; height_cm: number | null; body_fat_pct: number | null; muscle_mass_kg: number | null }
): Promise<BodyMeasurementRow> {
  if (existingId) {
    const { data, error } = await supabase
      .from("body_measurements")
      .update(fields)
      .eq("id", existingId)
      .select("id, assessment_id, weight_kg, height_cm, body_fat_pct, muscle_mass_kg")
      .single();
    if (error) throw error;
    return data as BodyMeasurementRow;
  }
  const { data, error } = await supabase
    .from("body_measurements")
    .insert({ assessment_id: assessmentId, ...fields })
    .select("id, assessment_id, weight_kg, height_cm, body_fat_pct, muscle_mass_kg")
    .single();
  if (error) throw error;
  return data as BodyMeasurementRow;
}

export async function listCircumferences(assessmentId: string): Promise<CircumferenceRow[]> {
  const { data, error } = await supabase
    .from("circumferences")
    .select("id, assessment_id, site, custom_label, side, value_cm")
    .eq("assessment_id", assessmentId);
  if (error) throw error;
  return (data ?? []) as CircumferenceRow[];
}

export async function addCircumference(params: {
  assessmentId: string;
  site: CircumferenceSite;
  customLabel: string;
  side: CircumferenceRow["side"];
  valueCm: number;
}): Promise<CircumferenceRow> {
  const { data, error } = await supabase
    .from("circumferences")
    .insert({
      assessment_id: params.assessmentId,
      site: params.site,
      custom_label: params.site === "custom" ? params.customLabel || "Otro" : null,
      side: params.side,
      value_cm: params.valueCm,
    })
    .select("id, assessment_id, site, custom_label, side, value_cm")
    .single();
  if (error) throw error;
  return data as CircumferenceRow;
}

export async function deleteCircumference(id: string): Promise<void> {
  const { error } = await supabase.from("circumferences").delete().eq("id", id);
  if (error) throw error;
}

export async function listStrengthTests(assessmentId: string): Promise<StrengthTestRow[]> {
  const { data, error } = await supabase
    .from("strength_tests")
    .select("id, assessment_id, exercise_id, load_kg, reps, is_direct_1rm, estimated_1rm, exercises(name)")
    .eq("assessment_id", assessmentId);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...row, exercise_name: row.exercises?.name ?? "" })) as StrengthTestRow[];
}

/** Estima el 1RM con la fórmula de Epley cuando no es un 1RM directo (reps = 1 real). */
function estimate1RM(loadKg: number, reps: number): number {
  if (reps <= 1) return loadKg;
  return Math.round(loadKg * (1 + reps / 30) * 10) / 10;
}

export async function addStrengthTest(params: { assessmentId: string; exerciseId: string; loadKg: number; reps: number }): Promise<StrengthTestRow> {
  const isDirect = params.reps <= 1;
  const estimated = estimate1RM(params.loadKg, params.reps);
  const { data, error } = await supabase
    .from("strength_tests")
    .insert({
      assessment_id: params.assessmentId,
      exercise_id: params.exerciseId,
      load_kg: params.loadKg,
      reps: params.reps,
      is_direct_1rm: isDirect,
      estimated_1rm: estimated,
      formula: isDirect ? null : "epley",
    })
    .select("id, assessment_id, exercise_id, load_kg, reps, is_direct_1rm, estimated_1rm, exercises(name)")
    .single();
  if (error) throw error;
  return { ...(data as any), exercise_name: (data as any).exercises?.name ?? "" } as StrengthTestRow;
}

export async function deleteStrengthTest(id: string): Promise<void> {
  const { error } = await supabase.from("strength_tests").delete().eq("id", id);
  if (error) throw error;
}
