import { supabase } from "../lib/supabase";
import { getActiveProgramForClient, getSessionStatuses } from "./training";
import { listWeeks } from "./programs";

export type BlockKind = "warmup" | "main" | "cardio" | "mobility" | "flexibility" | "cooldown";

export const BLOCK_LABEL: Record<BlockKind, string> = {
  warmup: "Calentamiento",
  main: "Principal",
  cardio: "Cardio",
  mobility: "Movilidad",
  flexibility: "Flexibilidad",
  cooldown: "Vuelta a la calma",
};
export const BLOCK_ORDER: BlockKind[] = ["warmup", "main", "cardio", "mobility", "flexibility", "cooldown"];

export type StrengthType = "resistencia" | "hipertrofia" | "maxima" | "potencia";

export const STRENGTH_TYPES: Record<
  StrengthType,
  { label: string; obj: string; load: string; reps: string; sets: string; rest: string; exec: string; rir: string; sug: { sets: number; repsMin: number; repsMax: number; rest: number; tempo: string; rir: number } }
> = {
  resistencia: {
    label: "Fuerza resistencia",
    obj: "Sostener el esfuerzo y tolerar la fatiga",
    load: "40–60 % del 1RM",
    reps: "15–25 o más",
    sets: "2–3",
    rest: "30–60 s",
    exec: "Controlada (ej. 2-0-2-0)",
    rir: "2–4",
    sug: { sets: 3, repsMin: 15, repsMax: 20, rest: 45, tempo: "2-0-2-0", rir: 3 },
  },
  hipertrofia: {
    label: "Fuerza hipertrofia",
    obj: "Aumentar la masa muscular con tensión y volumen",
    load: "65–80 % del 1RM",
    reps: "6–12",
    sets: "3–5",
    rest: "60–120 s",
    exec: "Excéntrico de 2–3 s",
    rir: "1–3",
    sug: { sets: 4, repsMin: 8, repsMax: 12, rest: 90, tempo: "3-1-1-0", rir: 2 },
  },
  maxima: {
    label: "Fuerza máxima",
    obj: "Producir la mayor fuerza posible",
    load: "85–100 % del 1RM",
    reps: "1–5",
    sets: "3–6",
    rest: "2–5 min",
    exec: "Técnica estricta, firme al subir",
    rir: "0–2",
    sug: { sets: 5, repsMin: 3, repsMax: 5, rest: 180, tempo: "2-1-X-0", rir: 1 },
  },
  potencia: {
    label: "Fuerza potencia",
    obj: "Mover cargas con la máxima velocidad",
    load: "30–60 % del 1RM",
    reps: "1–6",
    sets: "3–6",
    rest: "2–4 min",
    exec: "Velocidad máxima intencional al subir",
    rir: "3–4 (sin llegar al fallo)",
    sug: { sets: 4, repsMin: 3, repsMax: 5, rest: 150, tempo: "1-0-X-0", rir: 3 },
  },
};

export const HR_ZONES = [
  "Z1 — Recuperación (50–60% FCmáx)",
  "Z2 — Base aeróbica (60–70% FCmáx)",
  "Z3 — Tempo (70–80% FCmáx)",
  "Z4 — Umbral (80–90% FCmáx)",
  "Z5 — Máxima (90–100% FCmáx)",
];

export interface SessionRow {
  id: string;
  week_id: string;
  program_id: string;
  name: string;
  strength_type: StrengthType | null;
  sort_order: number;
  day_of_week: number | null;
}

/** 1 = lunes ... 7 = domingo, el estándar ISO que ya usa la columna. */
export const DAY_OF_WEEK_LABEL: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};

/** El día de hoy en el mismo estándar que day_of_week (1=lunes...7=domingo). */
export function todayDayOfWeek(): number {
  const jsDay = new Date().getDay(); // 0=domingo...6=sábado
  return jsDay === 0 ? 7 : jsDay;
}

export interface SessionBlockRow {
  id: string;
  session_id: string;
  kind: BlockKind;
  sort_order: number;
}

export interface WorkoutExerciseRow {
  id: string;
  session_id: string;
  block_id: string | null;
  exercise_id: string;
  exercise_name: string;
  sort_order: number;
  sets: number | null;
  reps_min: number | null;
  reps_max: number | null;
  load_value: number | null;
  rir: number | null;
  rest_s: number | null;
  tempo: string | null;
  superset_group: number | null;
  duration_min: number | null;
  distance_km: number | null;
  steps_target: number | null;
  hr_zone: string | null;
  media_path: string | null;
  media_type: "image" | "video" | null;
}

export interface TodaysSession {
  clientId: string;
  session: SessionRow;
  status: "pending" | "in_progress" | "completed" | "skipped";
}

/**
 * Si el programa activo del cliente tiene fecha de inicio real (puesta en
 * la semana 1, en Planificación), calcula en qué semana está hoy y busca
 * si alguna rutina de esa semana tiene asignado el día de hoy. Si el
 * programa no tiene fecha de inicio puesta, no hay forma de saber en qué
 * semana está "hoy" — devuelve null sin inventar nada.
 */
export async function getTodaysSessionForClient(clientId: string): Promise<TodaysSession | null> {
  const program = await getActiveProgramForClient(clientId);
  if (!program) return null;

  const weeks = await listWeeks(program.id);
  const week1 = weeks.find((w) => w.week_number === 1);
  if (!week1?.start_date) return null;

  const start = new Date(week1.start_date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysSince = Math.floor((today.getTime() - start.getTime()) / 86400000);
  if (daysSince < 0) return null;
  const currentWeekNumber = Math.floor(daysSince / 7) + 1;

  const currentWeek = weeks.find((w) => w.week_number === currentWeekNumber);
  if (!currentWeek) return null;

  const sessions = await listSessions(currentWeek.id);
  const todaysSession = sessions.find((s) => s.day_of_week === todayDayOfWeek());
  if (!todaysSession) return null;

  const statuses = await getSessionStatuses([todaysSession.id]);
  return { clientId, session: todaysSession, status: statuses[todaysSession.id] ?? "pending" };
}

export async function listSessions(weekId: string): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, week_id, program_id, name, strength_type, sort_order, day_of_week")
    .eq("week_id", weekId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as SessionRow[];
}

export async function createSession(weekId: string, name: string, sortOrder: number): Promise<SessionRow> {
  const { data, error } = await supabase
    .from("sessions")
    .insert({ week_id: weekId, name, sort_order: sortOrder })
    .select("id, week_id, program_id, name, strength_type, sort_order, day_of_week")
    .single();
  if (error) throw error;
  // Crea de una vez los bloques estándar, para no tener que ir creándolos sobre la marcha.
  const blocks: BlockKind[] = ["warmup", "main", "cardio", "mobility", "flexibility"];
  await supabase.from("session_blocks").insert(blocks.map((kind, i) => ({ session_id: data.id, kind, sort_order: i })));
  return data as SessionRow;
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) throw error;
}

export async function updateSessionName(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("sessions").update({ name }).eq("id", id);
  if (error) throw error;
}

export async function updateSessionStrengthType(id: string, strengthType: StrengthType): Promise<void> {
  const { error } = await supabase.from("sessions").update({ strength_type: strengthType }).eq("id", id);
  if (error) throw error;
}

export async function updateSessionDay(id: string, dayOfWeek: number | null): Promise<void> {
  const { error } = await supabase.from("sessions").update({ day_of_week: dayOfWeek }).eq("id", id);
  if (error) throw error;
}

export async function listSessionBlocks(sessionId: string): Promise<SessionBlockRow[]> {
  const { data, error } = await supabase
    .from("session_blocks")
    .select("id, session_id, kind, sort_order")
    .eq("session_id", sessionId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as SessionBlockRow[];
}

export async function listWorkoutExercises(sessionId: string): Promise<WorkoutExerciseRow[]> {
  const { data, error } = await supabase
    .from("workout_exercises")
    .select(
      "id, session_id, block_id, exercise_id, sort_order, sets, reps_min, reps_max, load_value, rir, rest_s, tempo, superset_group, duration_min, distance_km, steps_target, hr_zone, exercises(name, media_path, media_type)"
    )
    .eq("session_id", sessionId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    exercise_name: row.exercises?.name ?? "(ejercicio eliminado)",
    media_path: row.exercises?.media_path ?? null,
    media_type: row.exercises?.media_type ?? null,
  })) as WorkoutExerciseRow[];
}

export async function addWorkoutExercise(params: {
  sessionId: string;
  blockId: string;
  exerciseId: string;
  sortOrder: number;
  isCardio: boolean;
}): Promise<WorkoutExerciseRow> {
  const base = params.isCardio
    ? { prescription_type: "time", duration_min: 20, hr_zone: HR_ZONES[1], rest_s: 0 }
    : { prescription_type: "reps", sets: 3, reps_min: 8, reps_max: 12, rir: 2, rest_s: 90 };
  const { data, error } = await supabase
    .from("workout_exercises")
    .insert({
      session_id: params.sessionId,
      block_id: params.blockId,
      exercise_id: params.exerciseId,
      sort_order: params.sortOrder,
      ...base,
    })
    .select(
      "id, session_id, block_id, exercise_id, sort_order, sets, reps_min, reps_max, load_value, rir, rest_s, tempo, superset_group, duration_min, distance_km, steps_target, hr_zone, exercises(name, media_path, media_type)"
    )
    .single();
  if (error) throw error;
  return { ...(data as any), exercise_name: (data as any).exercises?.name ?? "", media_path: (data as any).exercises?.media_path ?? null, media_type: (data as any).exercises?.media_type ?? null } as WorkoutExerciseRow;
}

export async function updateWorkoutExercise(id: string, fields: Partial<WorkoutExerciseRow>): Promise<void> {
  const { exercise_name, exercise_id, session_id, id: _id, ...rest } = fields as any;
  const { error } = await supabase.from("workout_exercises").update(rest).eq("id", id);
  if (error) throw error;
}

export async function deleteWorkoutExercise(id: string): Promise<void> {
  const { error } = await supabase.from("workout_exercises").delete().eq("id", id);
  if (error) throw error;
}

/** Agrupa como biserie/triserie: mismo número de superset_group para todos. */
export async function groupAsSuperset(ids: string[]): Promise<number> {
  const group = Date.now() % 1000000;
  const { error } = await supabase.from("workout_exercises").update({ superset_group: group }).in("id", ids);
  if (error) throw error;
  return group;
}

export async function ungroupSuperset(sessionId: string, group: number): Promise<void> {
  const { error } = await supabase
    .from("workout_exercises")
    .update({ superset_group: null })
    .eq("session_id", sessionId)
    .eq("superset_group", group);
  if (error) throw error;
}

/** Aplica series/reps/descanso/tempo/RIR sugeridos a todos los ejercicios de fuerza de la sesión (no toca cardio). */
export async function applyStrengthSuggestion(sessionId: string, strengthType: StrengthType): Promise<number> {
  const sug = STRENGTH_TYPES[strengthType].sug;
  const { data, error } = await supabase
    .from("workout_exercises")
    .update({ sets: sug.sets, reps_min: sug.repsMin, reps_max: sug.repsMax, rest_s: sug.rest, tempo: sug.tempo, rir: sug.rir })
    .eq("session_id", sessionId)
    .is("duration_min", null) // no toca filas de cardio
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}

/**
 * Copia todas las sesiones (con sus bloques y ejercicios) de una semana a
 * otra, subiendo la carga de los ejercicios de fuerza un incremento fijo.
 */
/** Duplica una rutina dentro de la misma semana, con todos sus bloques y ejercicios, sin cambiar las cargas. */
export async function duplicateSession(session: SessionRow, newSortOrder: number): Promise<SessionRow> {
  const newSession = await createSession(session.week_id, `${session.name} (copia)`, newSortOrder);
  if (session.strength_type) await updateSessionStrengthType(newSession.id, session.strength_type);

  const [oldBlocks, newBlocks, exercises] = await Promise.all([
    listSessionBlocks(session.id),
    listSessionBlocks(newSession.id),
    listWorkoutExercises(session.id),
  ]);
  const blockKindToNewId = new Map(newBlocks.map((b) => [b.kind, b.id]));
  const oldBlockIdToKind = new Map(oldBlocks.map((b) => [b.id, b.kind]));

  for (const ex of exercises) {
    const kind = ex.block_id ? oldBlockIdToKind.get(ex.block_id) : undefined;
    const newBlockId = kind ? blockKindToNewId.get(kind) : newBlocks[0]?.id;
    if (!newBlockId) continue;
    await supabase.from("workout_exercises").insert({
      session_id: newSession.id,
      block_id: newBlockId,
      exercise_id: ex.exercise_id,
      sort_order: ex.sort_order,
      sets: ex.sets,
      reps_min: ex.reps_min,
      reps_max: ex.reps_max,
      load_value: ex.load_value,
      rir: ex.rir,
      rest_s: ex.rest_s,
      tempo: ex.tempo,
      superset_group: ex.superset_group,
      duration_min: ex.duration_min,
      distance_km: ex.distance_km,
      steps_target: ex.steps_target,
      hr_zone: ex.hr_zone,
      prescription_type: ex.duration_min != null ? "time" : "reps",
    });
  }
  return newSession;
}

/**
 * Reasigna el orden de TODAS las rutinas de la semana al orden exacto de
 * `orderedIds` (0, 1, 2...). Se usa en vez de un simple intercambio de a
 * dos porque, de paso, corrige solo cualquier número de orden repetido
 * que haya quedado de antes (por ejemplo, de una rutina duplicada con
 * una versión más vieja de la app) — con un intercambio simple, dos
 * rutinas con el mismo número no se mueven entre sí.
 */
export async function reorderSessions(orderedIds: string[]): Promise<void> {
  const results = await Promise.all(orderedIds.map((id, i) => supabase.from("sessions").update({ sort_order: i }).eq("id", id)));
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) throw firstError;
}

export interface AutoregulationSuggestion {
  workoutExerciseId: string;
  exerciseName: string;
  currentLoad: number | null;
  prescribedRir: number | null;
  achievedRir: number | null;
  suggestedLoad: number | null;
  reason: string;
}

/**
 * Compara el RIR que el cliente logró de verdad contra el que prescribiste,
 * y sugiere cuánto ajustar la carga para la próxima semana — en vez del
 * +2,5 kg plano de siempre para todos los ejercicios por igual. Si un
 * ejercicio no tiene series registradas todavía, no hay con qué autorregular
 * y se usa el incremento estándar, como antes.
 */
export async function getAutoregulationPreview(fromWeekId: string, clientId: string): Promise<AutoregulationSuggestion[]> {
  const sessions = await listSessions(fromWeekId);
  const out: AutoregulationSuggestion[] = [];
  for (const session of sessions) {
    const exercises = await listWorkoutExercises(session.id);
    for (const ex of exercises) {
      if (ex.load_value == null) continue; // ejercicios de cardio u otros sin carga quedan afuera
      const { data: logs, error } = await supabase
        .from("workout_set_logs")
        .select("rir")
        .eq("workout_exercise_id", ex.id)
        .eq("client_id", clientId)
        .eq("completed", true)
        .not("rir", "is", null);
      if (error) throw error;
      const rirs = (logs ?? []).map((l: any) => Number(l.rir));
      const achievedRir = rirs.length ? Math.round((rirs.reduce((a, b) => a + b, 0) / rirs.length) * 10) / 10 : null;
      const { suggestedLoad, reason } = suggestNextLoad(ex.load_value, ex.rir, achievedRir);
      out.push({
        workoutExerciseId: ex.id,
        exerciseName: ex.exercise_name,
        currentLoad: ex.load_value,
        prescribedRir: ex.rir,
        achievedRir,
        suggestedLoad,
        reason,
      });
    }
  }
  return out;
}

function suggestNextLoad(currentLoad: number, prescribedRir: number | null, achievedRir: number | null): { suggestedLoad: number; reason: string } {
  if (achievedRir == null || prescribedRir == null) {
    return { suggestedLoad: currentLoad + 2.5, reason: "Sin series registradas todavía — incremento estándar." };
  }
  const diff = achievedRir - prescribedRir;
  if (diff >= 1.5) return { suggestedLoad: currentLoad + 5, reason: `Le sobró margen (RIR real ${achievedRir} vs objetivo ${prescribedRir}).` };
  if (diff >= -0.5) return { suggestedLoad: currentLoad + 2.5, reason: `Cumplió el objetivo (RIR real ${achievedRir} vs objetivo ${prescribedRir}).` };
  if (diff >= -1.5) return { suggestedLoad: currentLoad, reason: `Le costó más de lo esperado (RIR real ${achievedRir} vs objetivo ${prescribedRir}) — mantener.` };
  return { suggestedLoad: Math.max(0, currentLoad - 2.5), reason: `Le costó bastante más de lo esperado (RIR real ${achievedRir} vs objetivo ${prescribedRir}) — bajar.` };
}

export async function copyWeek(
  programId: string,
  fromWeekId: string,
  toWeekId: string,
  loadIncrement = 2.5,
  loadOverrides?: Record<string, number>
): Promise<void> {
  const sessions = await listSessions(fromWeekId);
  for (const [sIdx, session] of sessions.entries()) {
    const newSession = await createSession(toWeekId, session.name, sIdx);
    if (session.strength_type) await updateSessionStrengthType(newSession.id, session.strength_type);

    const [oldBlocks, newBlocks, exercises] = await Promise.all([
      listSessionBlocks(session.id),
      listSessionBlocks(newSession.id),
      listWorkoutExercises(session.id),
    ]);
    const blockKindToNewId = new Map(newBlocks.map((b) => [b.kind, b.id]));
    const oldBlockIdToKind = new Map(oldBlocks.map((b) => [b.id, b.kind]));

    for (const ex of exercises) {
      const kind = ex.block_id ? oldBlockIdToKind.get(ex.block_id) : undefined;
      const newBlockId = kind ? blockKindToNewId.get(kind) : newBlocks[0]?.id;
      if (!newBlockId) continue;
      await supabase.from("workout_exercises").insert({
        session_id: newSession.id,
        block_id: newBlockId,
        exercise_id: ex.exercise_id,
        sort_order: ex.sort_order,
        sets: ex.sets,
        reps_min: ex.reps_min,
        reps_max: ex.reps_max,
        load_value: ex.load_value != null ? loadOverrides?.[ex.id] ?? Number(ex.load_value) + loadIncrement : null,
        rir: ex.rir,
        rest_s: ex.rest_s,
        tempo: ex.tempo,
        superset_group: ex.superset_group,
        duration_min: ex.duration_min,
        distance_km: ex.distance_km,
        steps_target: ex.steps_target,
        hr_zone: ex.hr_zone,
        prescription_type: ex.duration_min != null ? "time" : "reps",
      });
    }
  }
  void programId;
}
