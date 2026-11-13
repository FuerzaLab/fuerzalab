/**
 * Volumen por grupo muscular, como el metaanálisis de Pelland y
 * colaboradores (Sports Medicine, 2026; 67 estudios): cada serie cuenta 1
 * para el músculo principal del ejercicio ("directa") y 0,5 para cada
 * músculo secundario ("indirecta"); el método "fraccional" fue el que mejor
 * predijo la hipertrofia y la fuerza.
 *
 * Solo cuentan los bloques de trabajo (no calentamiento, cardio, movilidad,
 * flexibilidad ni vuelta a la calma) y no los ejercicios por tiempo.
 */
export interface VolumeExercise {
  primary_muscle_id: string | null;
  secondary_muscle_ids?: string[] | null;
}

export interface VolumeItem {
  id: string;
  session_id: string;
  exercise_id: string;
  blockKind: string | null;
  sets: number | null;
  reps_min: number | null;
  reps_max: number | null;
  load_value: number | null;
  duration_min: number | null;
}

export interface VolumeLog {
  workout_exercise_id: string;
  session_id: string;
  reps: number | null;
  load_kg: number | null;
  completed: boolean;
}

export interface MuscleVolume {
  direct: number;
  indirect: number;
  /** direct + 0,5 × indirect */
  fractional: number;
  /** Días (rutinas) de la semana en que se trabaja, directa o indirectamente. */
  frequency: number;
  /** Tonelaje (kg): series × reps × carga; los secundarios suman la mitad. */
  tonnageKg: number;
}

const WORK_BLOCK = (kind: string | null) => !kind || kind === "main";

function add(map: Map<string, MuscleVolume & { _sessions: Set<string> }>, muscle: string, sets: number, tonnage: number, session: string, direct: boolean) {
  if (!map.has(muscle)) map.set(muscle, { direct: 0, indirect: 0, fractional: 0, frequency: 0, tonnageKg: 0, _sessions: new Set() });
  const m = map.get(muscle)!;
  if (direct) m.direct += sets;
  else m.indirect += sets;
  m.fractional += direct ? sets : sets * 0.5;
  m.tonnageKg += direct ? tonnage : tonnage * 0.5;
  if (sets > 0) m._sessions.add(session);
}

function finish(map: Map<string, MuscleVolume & { _sessions: Set<string> }>): Record<string, MuscleVolume> {
  const out: Record<string, MuscleVolume> = {};
  for (const [k, v] of map) {
    out[k] = {
      direct: v.direct,
      indirect: v.indirect,
      fractional: Math.round(v.fractional * 10) / 10,
      frequency: v._sessions.size,
      tonnageKg: Math.round(v.tonnageKg),
    };
  }
  return out;
}

const repsOf = (it: VolumeItem) => (it.reps_min != null && it.reps_max != null ? (it.reps_min + it.reps_max) / 2 : it.reps_min ?? it.reps_max ?? 0);

/** Lo planificado: lo que está armado en las rutinas. */
export function plannedVolume(items: VolumeItem[], exById: Record<string, VolumeExercise | undefined>): Record<string, MuscleVolume> {
  const map = new Map<string, MuscleVolume & { _sessions: Set<string> }>();
  for (const it of items) {
    if (!WORK_BLOCK(it.blockKind) || (it.duration_min != null && !it.sets)) continue;
    const ex = exById[it.exercise_id];
    if (!ex?.primary_muscle_id) continue;
    const sets = it.sets ?? 0;
    const tonnage = sets * repsOf(it) * (it.load_value ?? 0);
    add(map, ex.primary_muscle_id, sets, tonnage, it.session_id, true);
    for (const sec of ex.secondary_muscle_ids ?? []) if (sec !== ex.primary_muscle_id) add(map, sec, sets, tonnage, it.session_id, false);
  }
  return finish(map);
}

/** Lo realizado: las series que el alumno registró como hechas. */
export function doneVolume(logs: VolumeLog[], items: VolumeItem[], exById: Record<string, VolumeExercise | undefined>): Record<string, MuscleVolume> {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const map = new Map<string, MuscleVolume & { _sessions: Set<string> }>();
  for (const l of logs) {
    if (!l.completed) continue;
    const it = itemById.get(l.workout_exercise_id);
    if (!it || !WORK_BLOCK(it.blockKind) || (it.duration_min != null && !it.sets)) continue;
    const ex = exById[it.exercise_id];
    if (!ex?.primary_muscle_id) continue;
    const tonnage = (l.reps ?? 0) * (l.load_kg ?? 0);
    add(map, ex.primary_muscle_id, 1, tonnage, l.session_id, true);
    for (const sec of ex.secondary_muscle_ids ?? []) if (sec !== ex.primary_muscle_id) add(map, sec, 1, tonnage, l.session_id, false);
  }
  return finish(map);
}
