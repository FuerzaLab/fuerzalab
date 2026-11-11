import { supabase } from "../lib/supabase";

/** Pruebas de rendimiento (part4j_migration.sql). */
export interface PerformanceTestRow {
  id: string;
  assessment_id: string;
  client_id: string;
  test_key: string;
  side: "left" | "right" | null;
  trials: number[];
  value: number | null;
  details: Record<string, any>;
  computed: Record<string, number>;
  notes: string | null;
  created_at: string;
  /** Fecha de la evaluación (al listar el historial). */
  assessed_at?: string;
}

const COLS = "id, assessment_id, client_id, test_key, side, trials, value, details, computed, notes, created_at";
const missing = (e: any) => /performance_tests/.test(e?.message ?? "") ? new Error("Falta correr part4j_migration.sql en Supabase.") : e;

export async function listPerformanceTests(assessmentId: string): Promise<PerformanceTestRow[]> {
  const { data, error } = await supabase.from("performance_tests").select(COLS).eq("assessment_id", assessmentId).order("created_at");
  if (error) throw missing(error);
  return (data ?? []).map(norm);
}

/** Todas las pruebas del alumno, con la fecha de su evaluación (para comparar con la anterior). */
export async function listClientPerformanceHistory(clientId: string): Promise<PerformanceTestRow[]> {
  const { data, error } = await supabase
    .from("performance_tests")
    .select(`${COLS}, assessments!inner(assessed_at)`)
    .eq("client_id", clientId);
  if (error) throw missing(error);
  return (data ?? []).map((r: any) => ({ ...norm(r), assessed_at: (Array.isArray(r.assessments) ? r.assessments[0] : r.assessments)?.assessed_at }));
}

export async function addPerformanceTest(row: {
  assessmentId: string;
  testKey: string;
  side: "left" | "right" | null;
  trials: number[];
  value: number | null;
  details: Record<string, any>;
  computed: Record<string, number>;
  notes?: string;
}): Promise<PerformanceTestRow> {
  // Organización, entrenador y alumno los completa la base de datos desde la evaluación.
  const { data, error } = await supabase
    .from("performance_tests")
    .insert({
      assessment_id: row.assessmentId,
      organization_id: "00000000-0000-0000-0000-000000000000",
      trainer_id: "00000000-0000-0000-0000-000000000000",
      client_id: "00000000-0000-0000-0000-000000000000",
      test_key: row.testKey,
      side: row.side,
      trials: row.trials,
      value: row.value,
      details: row.details,
      computed: row.computed,
      notes: row.notes?.trim() || null,
    })
    .select(COLS)
    .single();
  if (error) throw missing(error);
  return norm(data);
}

export async function deletePerformanceTest(id: string): Promise<void> {
  const { error } = await supabase.from("performance_tests").delete().eq("id", id);
  if (error) throw missing(error);
}

function norm(r: any): PerformanceTestRow {
  return {
    ...r,
    trials: (r.trials ?? []).map(Number),
    value: r.value == null ? null : Number(r.value),
    details: r.details ?? {},
    computed: r.computed ?? {},
  };
}
