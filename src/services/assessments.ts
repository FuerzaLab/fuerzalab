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

// ---------- Pliegues cutáneos ----------
export const SKINFOLD_SITES = ["Tríceps", "Subescapular", "Suprailíaco", "Abdominal", "Muslo", "Pectoral", "Axilar media", "Otro"];

export interface SkinfoldRow {
  id: string;
  assessment_id: string;
  site: string;
  side: "left" | "right" | null;
  value_mm: number;
  protocol: string | null;
}

export async function listSkinfolds(assessmentId: string): Promise<SkinfoldRow[]> {
  const { data, error } = await supabase.from("skinfolds").select("id, assessment_id, site, side, value_mm, protocol").eq("assessment_id", assessmentId);
  if (error) throw error;
  return (data ?? []) as SkinfoldRow[];
}

export async function addSkinfold(params: { assessmentId: string; site: string; side: SkinfoldRow["side"]; valueMm: number; protocol: string }): Promise<SkinfoldRow> {
  const { data, error } = await supabase
    .from("skinfolds")
    .insert({ assessment_id: params.assessmentId, site: params.site, side: params.side, value_mm: params.valueMm, protocol: params.protocol || null })
    .select("id, assessment_id, site, side, value_mm, protocol")
    .single();
  if (error) throw error;
  return data as SkinfoldRow;
}

export async function deleteSkinfold(id: string): Promise<void> {
  const { error } = await supabase.from("skinfolds").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Pruebas de potencia ----------
export type PowerTestType = "vertical_jump" | "horizontal_jump" | "throw" | "power_output" | "other";
export const POWER_TEST_LABEL: Record<PowerTestType, string> = {
  vertical_jump: "Salto vertical",
  horizontal_jump: "Salto horizontal",
  throw: "Lanzamiento",
  power_output: "Potencia de salida",
  other: "Otra",
};

export interface PowerTestRow {
  id: string;
  assessment_id: string;
  test_type: PowerTestType;
  value: number;
  unit: string;
  implement_weight_kg: number | null;
}

export async function listPowerTests(assessmentId: string): Promise<PowerTestRow[]> {
  const { data, error } = await supabase.from("power_tests").select("id, assessment_id, test_type, value, unit, implement_weight_kg").eq("assessment_id", assessmentId);
  if (error) throw error;
  return (data ?? []) as PowerTestRow[];
}

export async function addPowerTest(params: { assessmentId: string; testType: PowerTestType; value: number; unit: string; implementWeightKg: number | null }): Promise<PowerTestRow> {
  const { data, error } = await supabase
    .from("power_tests")
    .insert({ assessment_id: params.assessmentId, test_type: params.testType, value: params.value, unit: params.unit, implement_weight_kg: params.implementWeightKg })
    .select("id, assessment_id, test_type, value, unit, implement_weight_kg")
    .single();
  if (error) throw error;
  return data as PowerTestRow;
}

export async function deletePowerTest(id: string): Promise<void> {
  const { error } = await supabase.from("power_tests").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Pruebas de resistencia ----------
export interface EnduranceTestRow {
  id: string;
  assessment_id: string;
  test_type: string;
  distance_m: number | null;
  time_s: number | null;
  hr_avg: number | null;
  hr_max: number | null;
  result: number | null;
}

export async function listEnduranceTests(assessmentId: string): Promise<EnduranceTestRow[]> {
  const { data, error } = await supabase.from("endurance_tests").select("id, assessment_id, test_type, distance_m, time_s, hr_avg, hr_max, result").eq("assessment_id", assessmentId);
  if (error) throw error;
  return (data ?? []) as EnduranceTestRow[];
}

export async function addEnduranceTest(params: {
  assessmentId: string;
  testType: string;
  distanceM: number | null;
  timeS: number | null;
  hrAvg: number | null;
  hrMax: number | null;
}): Promise<EnduranceTestRow> {
  const { data, error } = await supabase
    .from("endurance_tests")
    .insert({ assessment_id: params.assessmentId, test_type: params.testType, distance_m: params.distanceM, time_s: params.timeS, hr_avg: params.hrAvg, hr_max: params.hrMax })
    .select("id, assessment_id, test_type, distance_m, time_s, hr_avg, hr_max, result")
    .single();
  if (error) throw error;
  return data as EnduranceTestRow;
}

export async function deleteEnduranceTest(id: string): Promise<void> {
  const { error } = await supabase.from("endurance_tests").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Movilidad ----------
export const MOBILITY_JOINTS = ["Hombro", "Cadera", "Tobillo", "Columna torácica", "Rodilla", "Muñeca", "Otro"];

export interface MobilityTestRow {
  id: string;
  assessment_id: string;
  joint: string;
  movement: string;
  side: "left" | "right" | "both" | null;
  value: number;
  unit: "degrees" | "cm" | "score";
}

export async function listMobilityTests(assessmentId: string): Promise<MobilityTestRow[]> {
  const { data, error } = await supabase.from("mobility_tests").select("id, assessment_id, joint, movement, side, value, unit").eq("assessment_id", assessmentId);
  if (error) throw error;
  return (data ?? []) as MobilityTestRow[];
}

export async function addMobilityTest(params: { assessmentId: string; joint: string; movement: string; side: MobilityTestRow["side"]; value: number; unit: MobilityTestRow["unit"] }): Promise<MobilityTestRow> {
  const { data, error } = await supabase
    .from("mobility_tests")
    .insert({ assessment_id: params.assessmentId, joint: params.joint, movement: params.movement, side: params.side, value: params.value, unit: params.unit })
    .select("id, assessment_id, joint, movement, side, value, unit")
    .single();
  if (error) throw error;
  return data as MobilityTestRow;
}

export async function deleteMobilityTest(id: string): Promise<void> {
  const { error } = await supabase.from("mobility_tests").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Flexibilidad ----------
export interface FlexibilityTestRow {
  id: string;
  assessment_id: string;
  test_name: string;
  muscle_group: string | null;
  side: "left" | "right" | "both" | null;
  value: number;
  unit: "degrees" | "cm" | "score";
}

export async function listFlexibilityTests(assessmentId: string): Promise<FlexibilityTestRow[]> {
  const { data, error } = await supabase.from("flexibility_tests").select("id, assessment_id, test_name, muscle_group, side, value, unit").eq("assessment_id", assessmentId);
  if (error) throw error;
  return (data ?? []) as FlexibilityTestRow[];
}

export async function addFlexibilityTest(params: { assessmentId: string; testName: string; muscleGroup: string; side: FlexibilityTestRow["side"]; value: number; unit: FlexibilityTestRow["unit"] }): Promise<FlexibilityTestRow> {
  const { data, error } = await supabase
    .from("flexibility_tests")
    .insert({ assessment_id: params.assessmentId, test_name: params.testName, muscle_group: params.muscleGroup || null, side: params.side, value: params.value, unit: params.unit })
    .select("id, assessment_id, test_name, muscle_group, side, value, unit")
    .single();
  if (error) throw error;
  return data as FlexibilityTestRow;
}

export async function deleteFlexibilityTest(id: string): Promise<void> {
  const { error } = await supabase.from("flexibility_tests").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Sugerencia de qué evaluar, según el perfil del cliente ----------
export type AssessmentCategory = "body" | "circumferences" | "skinfolds" | "strength" | "power" | "endurance" | "mobility" | "flexibility";

export const CATEGORY_LABEL: Record<AssessmentCategory, string> = {
  body: "Datos corporales",
  circumferences: "Circunferencias",
  skinfolds: "Pliegues cutáneos",
  strength: "Pruebas de fuerza",
  power: "Pruebas de potencia",
  endurance: "Pruebas de resistencia",
  mobility: "Movilidad",
  flexibility: "Flexibilidad",
};

export function suggestAssessmentCategories(params: {
  mainGoal: string | null;
  secondaryGoals: string[];
  injuries: string | null;
  boneJointFlag: boolean;
}): { categories: AssessmentCategory[]; reason: string } {
  const goals = [params.mainGoal, ...params.secondaryGoals].filter(Boolean).map((g) => (g as string).toLowerCase());
  const has = (s: string) => goals.some((g) => g.includes(s));

  const categories = new Set<AssessmentCategory>(["body"]);
  const reasons: string[] = [];

  if (has("grasa") || has("recomposici")) {
    categories.add("circumferences");
    categories.add("skinfolds");
    reasons.push("el objetivo incluye composición corporal");
  }
  if (has("fuerza") || has("hipertrofia")) {
    categories.add("strength");
    reasons.push("el objetivo incluye fuerza o hipertrofia");
  }
  if (has("rendimiento deportivo")) {
    categories.add("power");
    categories.add("endurance");
    reasons.push("el objetivo es rendimiento deportivo");
  }
  if (has("condici") || has("salud general")) {
    categories.add("endurance");
    reasons.push("el objetivo incluye condición física o salud general");
  }
  if (has("movilidad")) {
    categories.add("mobility");
    categories.add("flexibility");
    reasons.push("el objetivo incluye movilidad");
  }
  if (has("retorno progresivo")) {
    categories.add("mobility");
    reasons.push("está en retorno progresivo al entrenamiento");
  }
  if (params.boneJointFlag || (params.injuries && params.injuries.trim())) {
    categories.add("mobility");
    reasons.push("declaró una lesión o molestia articular");
  }

  return {
    categories: Array.from(categories),
    reason: reasons.length ? `Según su perfil (${reasons.join(", ")}).` : "Datos corporales como punto de partida general.",
  };
}
