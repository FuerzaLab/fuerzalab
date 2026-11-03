import { supabase } from "../lib/supabase";
import { createExercise, listCatalog, listExercises, type ExerciseRow } from "./exercises";
import { createWorkoutTemplate, listWorkoutTemplates } from "./templates";

/**
 * Rutinas de ejemplo para que un entrenador nuevo no empiece con Plantillas
 * vacía: 4 rutinas armadas, listas para aplicar a un alumno y ajustar.
 *
 * Los ejercicios se buscan por nombre en la biblioteca (sin tildes ni
 * mayúsculas); si alguno no está, se crea como ejercicio propio del
 * entrenador con su grupo muscular, equipamiento y región. Una rutina que ya
 * existe con el mismo nombre no se vuelve a crear.
 */

type Muscle = "pecho" | "espalda" | "hombros" | "biceps" | "triceps" | "cuadriceps" | "isquiotibiales" | "gluteos" | "pantorrillas" | "core" | "cuerpo_completo";
type Equip = "barra" | "mancuernas" | "maquina" | "polea" | "kettlebell" | "peso_corporal";

const EX: Record<string, { muscle: Muscle; equip: Equip; region: "Superior" | "Inferior" | "Full body"; heavy?: boolean }> = {
  "Sentadilla con barra": { muscle: "cuadriceps", equip: "barra", region: "Inferior", heavy: true },
  "Peso muerto rumano": { muscle: "isquiotibiales", equip: "barra", region: "Inferior", heavy: true },
  "Peso muerto convencional": { muscle: "isquiotibiales", equip: "barra", region: "Inferior", heavy: true },
  "Prensa de piernas": { muscle: "cuadriceps", equip: "maquina", region: "Inferior" },
  "Zancadas con mancuernas": { muscle: "cuadriceps", equip: "mancuernas", region: "Inferior" },
  "Zancada búlgara con mancuernas": { muscle: "cuadriceps", equip: "mancuernas", region: "Inferior" },
  "Hip thrust con barra": { muscle: "gluteos", equip: "barra", region: "Inferior" },
  "Curl femoral en máquina": { muscle: "isquiotibiales", equip: "maquina", region: "Inferior" },
  "Extensión de cuádriceps en máquina": { muscle: "cuadriceps", equip: "maquina", region: "Inferior" },
  "Abducción de cadera en máquina": { muscle: "gluteos", equip: "maquina", region: "Inferior" },
  "Elevación de talones de pie": { muscle: "pantorrillas", equip: "maquina", region: "Inferior" },
  "Sentadilla goblet con kettlebell": { muscle: "cuadriceps", equip: "kettlebell", region: "Inferior" },
  "Press de banca con barra": { muscle: "pecho", equip: "barra", region: "Superior", heavy: true },
  "Press de banca con mancuernas": { muscle: "pecho", equip: "mancuernas", region: "Superior" },
  "Press inclinado con mancuernas": { muscle: "pecho", equip: "mancuernas", region: "Superior" },
  "Flexiones de brazos": { muscle: "pecho", equip: "peso_corporal", region: "Superior" },
  "Fondos en paralelas": { muscle: "triceps", equip: "peso_corporal", region: "Superior" },
  "Remo con barra": { muscle: "espalda", equip: "barra", region: "Superior", heavy: true },
  "Remo con mancuerna": { muscle: "espalda", equip: "mancuernas", region: "Superior" },
  "Remo en máquina": { muscle: "espalda", equip: "maquina", region: "Superior" },
  "Jalón al pecho en polea": { muscle: "espalda", equip: "polea", region: "Superior" },
  "Dominadas": { muscle: "espalda", equip: "peso_corporal", region: "Superior" },
  "Press militar con barra": { muscle: "hombros", equip: "barra", region: "Superior", heavy: true },
  "Press militar con mancuernas": { muscle: "hombros", equip: "mancuernas", region: "Superior" },
  "Elevaciones laterales con mancuernas": { muscle: "hombros", equip: "mancuernas", region: "Superior" },
  "Curl con mancuernas": { muscle: "biceps", equip: "mancuernas", region: "Superior" },
  "Extensión de tríceps en polea": { muscle: "triceps", equip: "polea", region: "Superior" },
  "Crunch abdominal": { muscle: "core", equip: "peso_corporal", region: "Full body" },
};

type Line = [name: string, sets: number, repsMin: number, repsMax: number];
interface Starter {
  name: string;
  description: string;
  goal: string;
  level: string;
  days: { name: string; focus: string; lines: Line[] }[];
}

export const STARTER_TEMPLATES: Starter[] = [
  {
    name: "Fuerza para principiantes — 3 días",
    description: "Cuerpo completo, 3 veces por semana (por ejemplo lunes, miércoles y viernes). Para alumnos que empiezan o vuelven a entrenar.",
    goal: "Fuerza",
    level: "Principiante",
    days: [
      { name: "Día A", focus: "Cuerpo completo", lines: [["Sentadilla con barra", 3, 8, 10], ["Press de banca con barra", 3, 8, 10], ["Remo con barra", 3, 10, 12], ["Crunch abdominal", 3, 12, 15]] },
      { name: "Día B", focus: "Cuerpo completo", lines: [["Peso muerto rumano", 3, 8, 10], ["Press militar con barra", 3, 8, 10], ["Jalón al pecho en polea", 3, 10, 12], ["Zancadas con mancuernas", 3, 10, 12]] },
      { name: "Día C", focus: "Cuerpo completo", lines: [["Prensa de piernas", 3, 10, 12], ["Press inclinado con mancuernas", 3, 10, 12], ["Remo con mancuerna", 3, 10, 12], ["Hip thrust con barra", 3, 10, 12]] },
    ],
  },
  {
    name: "Hipertrofia — 4 días (torso / pierna)",
    description: "Torso y pierna alternados, 4 días por semana. Para alumnos con algo de experiencia que buscan masa muscular.",
    goal: "Hipertrofia",
    level: "Intermedio",
    days: [
      { name: "Torso A", focus: "Torso", lines: [["Press de banca con barra", 4, 6, 8], ["Remo con barra", 4, 8, 10], ["Press militar con mancuernas", 3, 8, 10], ["Jalón al pecho en polea", 3, 10, 12], ["Curl con mancuernas", 3, 10, 12], ["Extensión de tríceps en polea", 3, 10, 12]] },
      { name: "Pierna A", focus: "Pierna", lines: [["Sentadilla con barra", 4, 6, 8], ["Peso muerto rumano", 3, 8, 10], ["Prensa de piernas", 3, 10, 12], ["Curl femoral en máquina", 3, 10, 12], ["Elevación de talones de pie", 4, 12, 15]] },
      { name: "Torso B", focus: "Torso", lines: [["Press inclinado con mancuernas", 4, 8, 10], ["Dominadas", 4, 6, 10], ["Elevaciones laterales con mancuernas", 3, 12, 15], ["Remo en máquina", 3, 10, 12], ["Fondos en paralelas", 3, 8, 12]] },
      { name: "Pierna B", focus: "Pierna", lines: [["Peso muerto convencional", 3, 5, 5], ["Zancada búlgara con mancuernas", 3, 8, 10], ["Hip thrust con barra", 3, 10, 12], ["Extensión de cuádriceps en máquina", 3, 12, 15], ["Crunch abdominal", 3, 15, 15]] },
    ],
  },
  {
    name: "Tren inferior — 2 días",
    description: "Dos días de pierna: uno para cuádriceps y otro para cadena posterior. Se combina con 1 o 2 días de torso.",
    goal: "Hipertrofia",
    level: "Intermedio",
    days: [
      { name: "Pierna — cuádriceps", focus: "Cuádriceps", lines: [["Sentadilla con barra", 4, 6, 8], ["Prensa de piernas", 3, 10, 12], ["Zancadas con mancuernas", 3, 10, 12], ["Extensión de cuádriceps en máquina", 3, 12, 15], ["Elevación de talones de pie", 4, 12, 15]] },
      { name: "Pierna — cadena posterior", focus: "Glúteos e isquiotibiales", lines: [["Peso muerto rumano", 4, 6, 8], ["Hip thrust con barra", 4, 8, 10], ["Curl femoral en máquina", 3, 10, 12], ["Abducción de cadera en máquina", 3, 15, 15], ["Elevación de talones de pie", 3, 12, 15]] },
    ],
  },
  {
    name: "Full body — 2 días (poco tiempo)",
    description: "Dos sesiones cortas de cuerpo completo con mancuernas y máquinas. Para alumnos con poco tiempo o que entrenan en casa.",
    goal: "Salud general",
    level: "Principiante",
    days: [
      { name: "Día A", focus: "Cuerpo completo", lines: [["Sentadilla goblet con kettlebell", 3, 10, 12], ["Press de banca con mancuernas", 3, 10, 12], ["Remo con mancuerna", 3, 10, 12], ["Peso muerto rumano", 3, 10, 12]] },
      { name: "Día B", focus: "Cuerpo completo", lines: [["Zancadas con mancuernas", 3, 10, 12], ["Flexiones de brazos", 3, 8, 15], ["Jalón al pecho en polea", 3, 10, 12], ["Hip thrust con barra", 3, 10, 12]] },
    ],
  },
];

const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** Instala las rutinas de ejemplo que falten. Devuelve cuántas rutinas y cuántos ejercicios nuevos creó. */
export async function installStarterTemplates(organizationId: string, trainerId: string): Promise<{ templates: number; exercises: number }> {
  const [library, existing, muscles, equipment] = await Promise.all([
    listExercises(),
    listWorkoutTemplates(),
    listCatalog("muscle_group"),
    listCatalog("equipment"),
  ]);
  const byName = new Map<string, ExerciseRow>(library.map((e) => [norm(e.name), e]));
  const muscleId = (k: string) => muscles.find((m: any) => m.key === k)?.id ?? null;
  const equipId = (k: string) => equipment.find((q: any) => q.key === k)?.id;
  const existingNames = new Set(existing.map((t) => norm(t.name)));
  let createdEx = 0;
  let createdT = 0;

  const ensureExercise = async (name: string): Promise<ExerciseRow> => {
    const found = byName.get(norm(name));
    if (found) return found;
    const meta = EX[name];
    const eq = meta ? equipId(meta.equip) : undefined;
    const ex = await createExercise(
      {
        name,
        primary_muscle_id: meta ? muscleId(meta.muscle) : null,
        movement_pattern_id: null,
        equipment_ids: eq ? [eq] : [],
        difficulty: "intermediate",
        goals: ["Fuerza"],
        instructions: "",
        technical_cues: "",
        common_mistakes: "",
        ...(meta ? { body_region: meta.region } : {}),
      },
      "trainer",
      organizationId,
      trainerId,
    );
    byName.set(norm(name), ex);
    createdEx++;
    return ex;
  };

  for (const tpl of STARTER_TEMPLATES) {
    if (existingNames.has(norm(tpl.name))) continue;
    const t = await createWorkoutTemplate({
      organizationId,
      trainerId,
      name: tpl.name,
      description: tpl.description,
      goal: tpl.goal,
      level: tpl.level,
      visibility: "private",
    });
    for (let d = 0; d < tpl.days.length; d++) {
      const day = tpl.days[d];
      const { data: ts, error: tsErr } = await supabase
        .from("workout_template_sessions")
        .insert({ organization_id: organizationId, trainer_id: trainerId, template_id: t.id, day_index: d + 1, name: day.name, focus: day.focus })
        .select("id")
        .single();
      if (tsErr) throw tsErr;
      for (let i = 0; i < day.lines.length; i++) {
        const [name, sets, rmin, rmax] = day.lines[i];
        const ex = await ensureExercise(name);
        const { error } = await supabase.from("workout_template_exercises").insert({
          organization_id: organizationId,
          trainer_id: trainerId,
          template_id: t.id,
          template_session_id: ts.id,
          block_kind: "main",
          exercise_id: ex.id,
          sort_order: i,
          sets,
          reps_min: rmin,
          reps_max: rmax,
          prescription_type: "reps",
          load_type: null,
          load_value: null,
          rir: 2,
          rest_s: EX[name]?.heavy ? 150 : 90,
          tempo: null,
          superset_group: null,
        });
        if (error) throw error;
      }
    }
    createdT++;
  }
  return { templates: createdT, exercises: createdEx };
}
