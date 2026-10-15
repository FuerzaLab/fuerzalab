import { supabase } from "../lib/supabase";

export type ProgramMethod = "simple" | "linear" | "undulating" | "block" | "atr" | "custom";
export type Phase = "accumulation" | "transformation" | "realization" | "other" | "none";

export interface ProgramRow {
  id: string;
  organization_id: string;
  trainer_id: string;
  client_id: string;
  name: string;
  method: ProgramMethod;
  status: "draft" | "active" | "completed" | "archived";
  is_template: boolean;
  created_at: string;
}

export interface MesocycleRow {
  id: string;
  macrocycle_id: string;
  program_id: string;
  name: string;
  phase: Phase;
  objective: string | null;
  duration_weeks: number | null;
  frequency: number | null;
  volume_focus: string | null;
  intensity_focus: string | null;
  progression_criteria: string | null;
  sort_order: number;
}

export interface TrainingBlockRow {
  id: string;
  mesocycle_id: string;
  program_id: string;
  name: string;
}

export interface WeekRow {
  id: string;
  program_id: string;
  block_id: string | null;
  week_number: number;
}

export const METHOD_LABEL: Record<ProgramMethod, string> = {
  simple: "Sin periodización",
  linear: "Lineal",
  undulating: "Ondulante",
  block: "Por bloques",
  atr: "ATR",
  custom: "Personalizada",
};

const ATR_DEFAULTS: Array<Pick<MesocycleRow, "name" | "phase" | "objective" | "duration_weeks" | "frequency" | "volume_focus" | "intensity_focus" | "progression_criteria">> = [
  {
    name: "Acumulación",
    phase: "accumulation",
    objective: "Construir base de fuerza y masa muscular",
    duration_weeks: 4,
    frequency: 4,
    volume_focus: "Alto",
    intensity_focus: "Moderada, 70–78 % del 1RM",
    progression_criteria: "Sube 2,5 kg cuando completa todas las series con RIR 2 o más.",
  },
  {
    name: "Transformación",
    phase: "transformation",
    objective: "Convertir la base en fuerza máxima y potencia",
    duration_weeks: 3,
    frequency: 4,
    volume_focus: "Medio",
    intensity_focus: "Alta, 80–90 % del 1RM",
    progression_criteria: "Sube la carga si las repeticiones objetivo se cumplen en las 3 series principales.",
  },
  {
    name: "Realización",
    phase: "realization",
    objective: "Expresar el rendimiento con fatiga baja",
    duration_weeks: 2,
    frequency: 3,
    volume_focus: "Bajo",
    intensity_focus: "Muy alta, 90–95 % del 1RM",
    progression_criteria: "Reduce volumen 40 % y mantiene la intensidad; prueba de 1RM en la semana final.",
  },
];

export async function listPrograms(clientId?: string): Promise<ProgramRow[]> {
  let q = supabase.from("programs").select("*").eq("is_template", false).order("created_at", { ascending: false });
  if (clientId) q = q.eq("client_id", clientId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ProgramRow[];
}

export async function listMesocycles(programId: string): Promise<MesocycleRow[]> {
  const { data, error } = await supabase
    .from("mesocycles")
    .select("*")
    .eq("program_id", programId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as MesocycleRow[];
}

export async function listTrainingBlocks(programId: string): Promise<TrainingBlockRow[]> {
  const { data, error } = await supabase.from("training_blocks").select("*").eq("program_id", programId);
  if (error) throw error;
  return (data ?? []) as TrainingBlockRow[];
}

export async function listWeeks(programId: string): Promise<WeekRow[]> {
  const { data, error } = await supabase
    .from("weeks")
    .select("*")
    .eq("program_id", programId)
    .order("week_number");
  if (error) throw error;
  return (data ?? []) as WeekRow[];
}

/**
 * Crea el programa completo: el programa, un macrociclo contenedor, las
 * fases o el primer bloque, un bloque de entrenamiento 1-a-1 por cada
 * fase/bloque (así es como el esquema conecta una fase con sus semanas),
 * y las semanas numeradas 1..totalWeeks ya repartidas entre ellas.
 */
export async function createProgram(params: {
  organizationId: string;
  trainerId: string;
  clientId: string;
  name: string;
  method: ProgramMethod;
}): Promise<ProgramRow> {
  const { data: program, error: progErr } = await supabase
    .from("programs")
    .insert({
      organization_id: params.organizationId,
      trainer_id: params.trainerId,
      client_id: params.clientId,
      name: params.name,
      method: params.method,
      status: "active",
    })
    .select()
    .single();
  if (progErr) throw progErr;

  const { data: macro, error: macroErr } = await supabase
    .from("macrocycles")
    .insert({ program_id: program.id, name: "Programa completo" })
    .select()
    .single();
  if (macroErr) throw macroErr;

  const mesoSeeds =
    params.method === "atr"
      ? ATR_DEFAULTS
      : [
          {
            name: "Bloque 1",
            phase: "other" as Phase,
            objective: null,
            duration_weeks: 1,
            frequency: null,
            volume_focus: null,
            intensity_focus: null,
            progression_criteria: null,
          },
        ];

  for (let i = 0; i < mesoSeeds.length; i++) {
    const seed = mesoSeeds[i];
    const { data: meso, error: mesoErr } = await supabase
      .from("mesocycles")
      .insert({ macrocycle_id: macro.id, sort_order: i, ...seed })
      .select()
      .single();
    if (mesoErr) throw mesoErr;

    await supabase.from("training_blocks").insert({ mesocycle_id: meso.id, name: seed.name });
  }

  const totalWeeks = mesoSeeds.reduce((t, s) => t + (s.duration_weeks ?? 0), 0);
  const weekRows = Array.from({ length: totalWeeks }, (_, i) => ({
    program_id: program.id,
    week_number: i + 1,
  }));
  if (weekRows.length) {
    const { error: weeksErr } = await supabase.from("weeks").insert(weekRows);
    if (weeksErr) throw weeksErr;
  }

  await syncWeekBlocks(program.id);
  return program as ProgramRow;
}

export async function updateProgramName(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("programs").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteProgram(id: string): Promise<void> {
  const { error } = await supabase.from("programs").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Asegura que existan al menos `neededTotal` semanas para el programa,
 * creando las que falten al final. Nunca borra semanas existentes —
 * acortar podría perder rutinas que ya estén armadas en el Constructor —
 * así que si `neededTotal` es menor o igual a las que ya hay, no hace
 * nada (de ahí que la duración total del programa solo pueda crecer:
 * es la suma de sus bloques, y esa suma puede bajar en la pantalla sin
 * que eso borre ninguna semana real por debajo).
 */
export async function extendProgramWeeks(programId: string, neededTotal: number): Promise<void> {
  const current = await listWeeks(programId);
  if (neededTotal <= current.length) return;
  const toAdd = Array.from({ length: neededTotal - current.length }, (_, i) => ({
    program_id: programId,
    week_number: current.length + i + 1,
  }));
  const { error } = await supabase.from("weeks").insert(toAdd);
  if (error) throw error;
}

export async function updateMesocycle(id: string, fields: Partial<MesocycleRow>): Promise<void> {
  const { error } = await supabase.from("mesocycles").update(fields).eq("id", id);
  if (error) throw error;
}

export async function addMesocycle(programId: string, macrocycleId: string, sortOrder: number, durationWeeks: number): Promise<MesocycleRow> {
  const { data: meso, error } = await supabase
    .from("mesocycles")
    .insert({
      macrocycle_id: macrocycleId,
      sort_order: sortOrder,
      name: `Bloque ${sortOrder + 1}`,
      phase: "other",
      duration_weeks: durationWeeks,
    })
    .select()
    .single();
  if (error) throw error;
  await supabase.from("training_blocks").insert({ mesocycle_id: meso.id, name: meso.name });
  await syncWeekBlocks(programId);
  return meso as MesocycleRow;
}

export async function removeMesocycle(programId: string, mesocycleId: string): Promise<void> {
  const { error } = await supabase.from("mesocycles").delete().eq("id", mesocycleId);
  if (error) throw error;
  await syncWeekBlocks(programId);
}

export async function duplicateMesocycle(programId: string, meso: MesocycleRow, sortOrder: number): Promise<MesocycleRow> {
  const { data: copy, error } = await supabase
    .from("mesocycles")
    .insert({
      macrocycle_id: meso.macrocycle_id,
      sort_order: sortOrder,
      name: `${meso.name} (copia)`,
      phase: meso.phase,
      objective: meso.objective,
      duration_weeks: meso.duration_weeks,
      frequency: meso.frequency,
      volume_focus: meso.volume_focus,
      intensity_focus: meso.intensity_focus,
      progression_criteria: meso.progression_criteria,
    })
    .select()
    .single();
  if (error) throw error;
  await supabase.from("training_blocks").insert({ mesocycle_id: copy.id, name: copy.name });
  await syncWeekBlocks(programId);
  return copy as MesocycleRow;
}

/**
 * Recalcula a qué bloque de entrenamiento (y por lo tanto a qué fase)
 * pertenece cada semana, según el orden y la duración de los mesociclos.
 * Se llama después de cualquier cambio en la duración de una fase/bloque.
 */
export async function syncWeekBlocks(programId: string): Promise<void> {
  const [mesos, blocks] = await Promise.all([listMesocycles(programId), listTrainingBlocks(programId)]);
  let weekNum = 1;
  for (const meso of mesos) {
    const block = blocks.find((b) => b.mesocycle_id === meso.id);
    const span = meso.duration_weeks ?? 0;
    if (block && span > 0) {
      await supabase
        .from("weeks")
        .update({ block_id: block.id })
        .eq("program_id", programId)
        .gte("week_number", weekNum)
        .lt("week_number", weekNum + span);
    }
    weekNum += span;
  }
}
