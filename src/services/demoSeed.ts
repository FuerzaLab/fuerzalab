import { supabase } from "../lib/supabase";
import { createExercise, listExercises } from "./exercises";

/**
 * DEMO DE FUERZALAB
 * =================
 * Carga datos de ejemplo realistas en la cuenta del entrenador demo:
 * 8 clientes con 7 semanas de entrenamientos registrados (con cargas que
 * progresan, así aparecen récords), evaluaciones con medidas, bienestar
 * de las últimas 2 semanas, pagos, agenda de hoy y mañana, y notas.
 *
 * Se corre DESDE LA APP, como el entrenador demo, con las mismas reglas
 * de seguridad que cualquier entrenador: no necesita permisos especiales
 * ni migraciones, y no puede tocar datos de nadie más.
 *
 * Todo es determinístico (mismo "azar" cada vez) y relativo a la fecha de
 * hoy, así la demo siempre se ve "viva": hoy hay clientes entrenando,
 * hubo récords esta semana, alguien cargó medidas hace poco, etc.
 */

// --- utilidades -----------------------------------------------------------

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const uuid = () => crypto.randomUUID();
const r25 = (n: number) => Math.max(2.5, Math.round(n / 2.5) * 2.5);
const round1 = (n: number) => Math.round(n * 10) / 10;

function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function atTime(d: Date, h: number, min = 0): Date {
  const x = new Date(d);
  x.setHours(h, min, 0, 0);
  return x;
}

async function insertAll(table: string, rows: Record<string, unknown>[], chunk = 400): Promise<void> {
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + chunk));
    if (error) throw new Error(`No se pudieron cargar los datos de ejemplo (${table}): ${error.message}`);
  }
}

// --- datos de ejemplo -----------------------------------------------------

const CLIENTS = [
  { name: "Valeria Rojas", sex: "female", birth: "1995-04-12", height: 164, weight: 63, fat: 27, level: "intermediate", squat: 60, goal: "Ganar fuerza y tonificar" },
  { name: "Diego Mamani", sex: "male", birth: "1990-09-03", height: 176, weight: 84, fat: 22, level: "advanced", squat: 120, goal: "Fuerza máxima" },
  { name: "Camila Fernández", sex: "female", birth: "1998-01-27", height: 160, weight: 58, fat: 25, level: "beginner", squat: 35, goal: "Bajar grasa" },
  { name: "Andrés Quispe", sex: "male", birth: "1987-06-18", height: 172, weight: 91, fat: 28, level: "intermediate", squat: 80, goal: "Bajar de peso y mejorar la salud" },
  { name: "Lucía Vargas", sex: "female", birth: "1993-11-05", height: 168, weight: 66, fat: 24, level: "intermediate", squat: 70, goal: "Rendimiento en running" },
  { name: "Mateo Gutiérrez", sex: "male", birth: "2001-02-14", height: 181, weight: 74, fat: 15, level: "beginner", squat: 65, goal: "Ganar masa muscular" },
  { name: "Sofía Choque", sex: "female", birth: "1985-08-22", height: 158, weight: 70, fat: 31, level: "beginner", squat: 40, goal: "Salud y movilidad" },
  { name: "Javier Flores", sex: "male", birth: "1996-03-30", height: 178, weight: 80, fat: 18, level: "advanced", squat: 110, goal: "Hipertrofia" },
] as const;

/** Ejercicios que usa la demo. Se buscan por nombre en la biblioteca; si no están, se crean en la del entrenador demo. */
const EXERCISES = {
  squat: { name: "Sentadilla con barra", bodyweight: false },
  rdl: { name: "Peso muerto rumano", bodyweight: false },
  lunge: { name: "Zancadas con mancuernas", bodyweight: false },
  hipthrust: { name: "Hip thrust con barra", bodyweight: false },
  bench: { name: "Press de banca", bodyweight: false },
  row: { name: "Remo con barra", bodyweight: false },
  ohp: { name: "Press militar con barra", bodyweight: false },
  pullup: { name: "Dominadas", bodyweight: true },
  pulldown: { name: "Jalón al pecho", bodyweight: false },
  curl: { name: "Curl de bíceps con mancuernas", bodyweight: false },
} as const;
type ExKey = keyof typeof EXERCISES;

/** factor = carga relativa a la sentadilla del cliente; reps = rango prescripto. */
const SESSIONS: { name: string; items: { ex: ExKey; sets: number; min: number; max: number; factor: number; rest: number }[] }[] = [
  {
    name: "Día A — Tren inferior",
    items: [
      { ex: "squat", sets: 4, min: 6, max: 8, factor: 1, rest: 150 },
      { ex: "rdl", sets: 3, min: 8, max: 10, factor: 0.85, rest: 120 },
      { ex: "hipthrust", sets: 3, min: 10, max: 12, factor: 1.1, rest: 90 },
      { ex: "lunge", sets: 3, min: 10, max: 12, factor: 0.22, rest: 90 },
    ],
  },
  {
    name: "Día B — Tren superior",
    items: [
      { ex: "bench", sets: 4, min: 6, max: 8, factor: 0.72, rest: 150 },
      { ex: "row", sets: 4, min: 8, max: 10, factor: 0.62, rest: 120 },
      { ex: "ohp", sets: 3, min: 8, max: 10, factor: 0.45, rest: 90 },
      { ex: "pullup", sets: 3, min: 5, max: 10, factor: 0, rest: 120 },
    ],
  },
  {
    name: "Día C — Cuerpo completo",
    items: [
      { ex: "squat", sets: 3, min: 8, max: 10, factor: 0.82, rest: 120 },
      { ex: "bench", sets: 3, min: 8, max: 10, factor: 0.62, rest: 120 },
      { ex: "pulldown", sets: 3, min: 10, max: 12, factor: 0.55, rest: 90 },
      { ex: "curl", sets: 3, min: 10, max: 12, factor: 0.14, rest: 60 },
    ],
  },
];

const COMMENTS_GOOD = [
  "¡Me sentí muy bien! Subí peso en la sentadilla.",
  "Buena sesión, la técnica se siente cada vez mejor.",
  "Terminé con energía, me gustaría probar más carga la próxima.",
];

// --- reset ----------------------------------------------------------------

/** Borra todo lo que la demo cargó antes (clientes y lo que cuelga de ellos, agenda, planes de pago). */
export async function clearDemoData(trainerId: string): Promise<void> {
  // Las tablas de cada cliente (programas, registros, evaluaciones, pagos,
  // mensajes, bienestar…) se borran solas en cascada al borrar el cliente.
  const steps: [string, (q: any) => any][] = [
    ["trainer_appointments", (q) => q.delete().eq("trainer_id", trainerId)],
    ["clients", (q) => q.delete().eq("trainer_id", trainerId)],
    ["payment_plans", (q) => q.delete().eq("trainer_id", trainerId)],
    ["dashboard_dismissals", (q) => q.delete().eq("user_id", trainerId)],
  ];
  for (const [table, run] of steps) {
    const { error } = await run(supabase.from(table));
    // La tabla de "atendidas" puede no existir si falta part3r_migration.sql: no importa.
    if (error && table !== "dashboard_dismissals") throw new Error(`No se pudo limpiar la demo (${table}): ${error.message}`);
  }
}

/** ¿Hace falta cargar (o recargar) la demo? Sí si está vacía o si los datos tienen más de ~20 horas. */
export async function demoNeedsSeed(trainerId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("clients")
    .select("created_at")
    .eq("trainer_id", trainerId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) return false;
  if (!data || data.length === 0) return true;
  return Date.now() - new Date(data[0].created_at as string).getTime() > 20 * 3600 * 1000;
}

// --- carga ----------------------------------------------------------------

export async function seedDemo(params: {
  organizationId: string;
  trainerId: string;
  onProgress?: (msg: string) => void;
}): Promise<void> {
  const { organizationId: org, trainerId: trainer } = params;
  const say = params.onProgress ?? (() => {});
  const rand = rng(20261026);

  say("Limpiando datos anteriores…");
  await clearDemoData(trainer);

  // Ejercicios ------------------------------------------------------------
  say("Preparando ejercicios…");
  const library = await listExercises();
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const exId = {} as Record<ExKey, string>;
  for (const key of Object.keys(EXERCISES) as ExKey[]) {
    const def = EXERCISES[key];
    const found = library.find((e) => norm(e.name) === norm(def.name));
    if (found) exId[key] = found.id;
    else {
      const created = await createExercise(
        {
          name: def.name,
          primary_muscle_id: null,
          movement_pattern_id: null,
          equipment_ids: [],
          difficulty: "intermediate",
          goals: ["Fuerza"],
          instructions: "",
          technical_cues: "",
          common_mistakes: "",
        },
        "trainer",
        org,
        trainer,
      );
      exId[key] = created.id;
    }
  }

  // Fechas ----------------------------------------------------------------
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = localDate(today);
  const dow = today.getDay() === 0 ? 7 : today.getDay(); // 1 = lunes
  const thisMonday = addDays(today, 1 - dow);
  const week1 = addDays(thisMonday, -7 * 7); // hoy cae en la semana 8
  const TOTAL_WEEKS = 10;
  const now = new Date();

  // Clientes --------------------------------------------------------------
  say("Creando clientes…");
  const clients = CLIENTS.map((c, i) => ({ ...c, id: uuid(), idx: i, days: i % 2 === 0 ? [1, 3, 5] : [2, 4, 6] }));
  await insertAll(
    "clients",
    clients.map((c) => ({
      id: c.id,
      organization_id: org,
      trainer_id: trainer,
      full_name: c.name,
      email: `${norm(c.name).replace(/\s+/g, ".")}@ejemplo.com`,
      phone: `+591 7${String(1000000 + c.idx * 137531).slice(0, 7)}`,
      status: "active",
      start_date: localDate(addDays(week1, -3)),
    })),
  );
  await insertAll(
    "client_profiles",
    clients.map((c) => ({
      client_id: c.id,
      organization_id: org,
      trainer_id: trainer,
      birth_date: c.birth,
      sex: c.sex,
      height_cm: c.height,
      training_level: c.level,
      main_goal: c.goal,
      weight_kg: c.weight,
      consent_accepted: true,
      submitted_at: addDays(week1, -3).toISOString(),
    })),
  );

  // Programas, semanas, sesiones y ejercicios -----------------------------
  say("Armando programas de entrenamiento…");
  const programs: Record<string, unknown>[] = [];
  const macros: Record<string, unknown>[] = [];
  const mesos: Record<string, unknown>[] = [];
  const tblocks: Record<string, unknown>[] = [];
  const weeks: Record<string, unknown>[] = [];
  const sessions: Record<string, unknown>[] = [];
  const sblocks: Record<string, unknown>[] = [];
  const wexs: Record<string, unknown>[] = [];

  interface PlannedSession {
    id: string;
    client: (typeof clients)[number];
    date: Date;
    weekNumber: number;
    tpl: (typeof SESSIONS)[number];
    exercises: { id: string; ex: ExKey; sets: number; min: number; max: number; factor: number }[];
  }
  const planned: PlannedSession[] = [];

  for (const c of clients) {
    const programId = uuid();
    const macroId = uuid();
    const mesoId = uuid();
    const blockId = uuid();
    programs.push({
      id: programId,
      organization_id: org,
      trainer_id: trainer,
      client_id: c.id,
      name: `Plan de ${c.name.split(" ")[0]} — ${c.goal}`,
      method: "linear",
      status: "active",
      start_date: localDate(week1),
      goal: c.goal,
    });
    macros.push({ id: macroId, program_id: programId, name: "Programa completo" });
    mesos.push({ id: mesoId, macrocycle_id: macroId, name: "Bloque 1", phase: "accumulation", duration_weeks: TOTAL_WEEKS, frequency: 3, sort_order: 0 });
    tblocks.push({ id: blockId, mesocycle_id: mesoId, name: "Bloque 1" });

    for (let w = 1; w <= TOTAL_WEEKS; w++) {
      const weekId = uuid();
      const weekStart = addDays(week1, (w - 1) * 7);
      weeks.push({ id: weekId, program_id: programId, block_id: blockId, week_number: w, start_date: w === 1 ? localDate(week1) : null });
      SESSIONS.forEach((tpl, si) => {
        const sessionId = uuid();
        const day = c.days[si];
        sessions.push({ id: sessionId, week_id: weekId, name: tpl.name, sort_order: si, day_of_week: day });
        const blockKinds = ["warmup", "main", "cardio", "mobility", "flexibility"];
        let mainBlock = "";
        blockKinds.forEach((kind, bi) => {
          const id = uuid();
          if (kind === "main") mainBlock = id;
          sblocks.push({ id, session_id: sessionId, kind, sort_order: bi });
        });
        const exs = tpl.items.map((it, ei) => {
          const id = uuid();
          const bodyweight = EXERCISES[it.ex].bodyweight;
          wexs.push({
            id,
            session_id: sessionId,
            block_id: mainBlock,
            exercise_id: exId[it.ex],
            sort_order: ei,
            sets: it.sets,
            reps_min: it.min,
            reps_max: it.max,
            prescription_type: "reps",
            load_type: bodyweight ? "bodyweight" : "kg",
            load_value: bodyweight ? null : r25(c.squat * it.factor * (1 + 0.015 * (w - 1))),
            rir: 2,
            rest_s: it.rest,
          });
          return { id, ex: it.ex, sets: it.sets, min: it.min, max: it.max, factor: it.factor };
        });
        planned.push({ id: sessionId, client: c, date: addDays(weekStart, day - 1), weekNumber: w, tpl, exercises: exs });
      });
    }
  }

  await insertAll("programs", programs);
  await insertAll("macrocycles", macros);
  await insertAll("mesocycles", mesos);
  await insertAll("training_blocks", tblocks);
  await insertAll("weeks", weeks);
  await insertAll("sessions", sessions);
  await insertAll("session_blocks", sblocks);
  await insertAll("workout_exercises", wexs);

  // Entrenamientos registrados --------------------------------------------
  say("Registrando 7 semanas de entrenamientos…");
  const logs: Record<string, unknown>[] = [];
  const setLogs: Record<string, unknown>[] = [];
  const todaysByClient = new Map<number, PlannedSession>();
  for (const p of planned) if (localDate(p.date) === todayStr) todaysByClient.set(p.client.idx, p);
  // Hoy: los dos primeros que entrenan hoy ya terminaron, el tercero está entrenando ahora.
  const todayOrder = [...todaysByClient.keys()].sort((a, b) => a - b);

  for (const p of planned) {
    const dateStr = localDate(p.date);
    const isToday = dateStr === todayStr;
    if (p.date > today) continue;
    const pos = isToday ? todayOrder.indexOf(p.client.idx) : -1;
    if (isToday && pos > 2) continue; // el resto todavía no empezó la de hoy
    const daysAgo = Math.round((today.getTime() - p.date.getTime()) / 86400000);

    // Una rutina saltada a propósito en los últimos días (aparece en Novedades),
    // y algunas faltas al azar más atrás en el tiempo.
    const forcedSkip = p.client.idx === 6 && daysAgo > 0 && daysAgo <= 7 && p.tpl === SESSIONS[1];
    if (!forcedSkip && !isToday && daysAgo > 10 && rand() < 0.07) continue;
    const logId = uuid();
    if (forcedSkip) {
      logs.push({ id: logId, session_id: p.id, status: "skipped", created_at: atTime(p.date, 20).toISOString(), updated_at: atTime(p.date, 20).toISOString() });
      continue;
    }

    const inProgress = isToday && pos === 2;
    const start = isToday ? new Date(now.getTime() - (pos === 0 ? 150 : pos === 1 ? 95 : 25) * 60000) : atTime(p.date, 7 + ((p.client.idx * 3) % 12), 0);
    const end = new Date(start.getTime() + (55 + Math.floor(rand() * 20)) * 60000);

    // Esfuerzo y comentarios: la mayoría normales; algunos casos para Novedades.
    let rpe = 6 + Math.floor(rand() * 3); // 6–8
    let comment: string | null = null;
    if (daysAgo <= 6 && !inProgress) {
      if (p.client.idx === 3 && p.tpl === SESSIONS[0]) {
        rpe = 9.5;
        comment = "Muy pesado hoy, me costó terminar las últimas series de sentadilla.";
      } else if (p.client.idx === 4 && p.tpl === SESSIONS[2]) {
        rpe = 4;
        comment = "Me quedó liviano, ¿subimos un poco el peso?";
      } else if (p.client.idx === 0 && p.tpl === SESSIONS[1]) {
        comment = "Molestia leve en el hombro derecho en el press militar.";
      } else if (rand() < 0.18) {
        comment = COMMENTS_GOOD[Math.floor(rand() * COMMENTS_GOOD.length)];
      }
    }

    logs.push({
      id: logId,
      session_id: p.id,
      status: inProgress ? "in_progress" : "completed",
      started_at: start.toISOString(),
      completed_at: inProgress ? null : end.toISOString(),
      session_rpe: inProgress ? null : rpe,
      comments: comment,
      duration_min: inProgress ? null : Math.round((end.getTime() - start.getTime()) / 60000),
      created_at: start.toISOString(),
      updated_at: (inProgress ? start : end).toISOString(),
    });

    const c = p.client;
    // Progresión realista: la carga sube un escalón cada 4 semanas (cada
    // cliente en un momento distinto) y entre medio se mantiene. Así los
    // récords aparecen de vez en cuando — al subir de escalón — y no en
    // cada sesión. La primera serie siempre es la mejor del día.
    const step = Math.floor((p.weekNumber - 1 + (c.idx % 4)) / 4);
    const progress = 1 + 0.05 * step;
    let minute = 5;
    p.exercises.forEach((ex, ei) => {
      if (inProgress && ei > 1) return; // entrenando ahora: va por el segundo ejercicio
      const bodyweight = EXERCISES[ex.ex].bodyweight;
      const load = bodyweight ? null : r25(c.squat * ex.factor * progress);
      const firstReps = bodyweight ? Math.min(ex.max, ex.min + step) : ex.max;
      for (let s = 1; s <= ex.sets; s++) {
        const reps = s === 1 ? firstReps : Math.max(ex.min - 1, firstReps - (s - 1) - (rand() < 0.3 ? 1 : 0));
        minute += 3;
        setLogs.push({
          id: uuid(),
          workout_log_id: logId,
          workout_exercise_id: ex.id,
          exercise_id: exId[ex.ex],
          set_number: s,
          reps,
          load_kg: load,
          rir: Math.max(0, 3 - s + Math.round(rand())),
          completed: true,
          performed_at: new Date(start.getTime() + minute * 60000).toISOString(),
        });
      }
    });
  }
  await insertAll("workout_logs", logs);
  await insertAll("workout_set_logs", setLogs, 500);

  // Evaluaciones ------------------------------------------------------------
  say("Cargando evaluaciones y medidas…");
  const assessments: Record<string, unknown>[] = [];
  const bodies: Record<string, unknown>[] = [];
  const circs: Record<string, unknown>[] = [];
  for (const c of clients) {
    const losing = /bajar|grasa|peso/i.test(c.goal);
    const gaining = /masa|hipertrofia/i.test(c.goal);
    const points = [
      { date: addDays(week1, -3), type: "initial", dw: 0, df: 0 },
      { date: addDays(week1, 25), type: "periodic", dw: losing ? -2.1 : gaining ? 1.2 : -0.6, df: losing ? -1.8 : gaining ? -0.4 : -1.0 },
    ];
    // La mitad cargó sus propias medidas hace poco (aparece en Novedades).
    if (c.idx % 2 === 1) points.push({ date: addDays(today, -(1 + (c.idx % 4))), type: "self_report", dw: losing ? -3.4 : gaining ? 2.1 : -1.1, df: losing ? -2.9 : gaining ? -0.6 : -1.5 });

    for (const pt of points) {
      const id = uuid();
      const weight = round1(c.weight + pt.dw);
      const fat = round1(c.fat + pt.df);
      assessments.push({
        id,
        client_id: c.id,
        organization_id: org,
        trainer_id: trainer,
        assessed_at: localDate(pt.date),
        type: pt.type,
        status: "completed",
        created_at: atTime(pt.date, 19).toISOString(),
        notes: pt.type === "initial" ? "Evaluación inicial." : null,
      });
      bodies.push({
        assessment_id: id,
        weight_kg: weight,
        height_cm: c.height,
        bmi: round1(weight / (c.height / 100) ** 2),
        body_fat_pct: pt.type === "self_report" ? null : fat,
        method: pt.type === "self_report" ? null : "skinfolds",
      });
      const waist = round1((c.sex === "male" ? 86 : 74) + (c.fat - 22) * 0.6 + pt.dw * 0.9);
      const sites: [string, string, number][] = [
        ["waist", "none", waist],
        ["hip", "none", round1(waist + (c.sex === "male" ? 12 : 22))],
      ];
      if (pt.type !== "self_report") {
        sites.push(["arm", "right", round1((c.sex === "male" ? 34 : 28) + (gaining ? pt.dw * 0.3 : 0))]);
        sites.push(["thigh", "right", round1((c.sex === "male" ? 56 : 55) + pt.dw * 0.25)]);
      }
      for (const [site, side, value] of sites) circs.push({ assessment_id: id, site, side, value_cm: value });
    }
  }
  await insertAll("assessments", assessments);
  await insertAll("body_measurements", bodies);
  await insertAll("circumferences", circs);

  // Bienestar (últimas 2 semanas) -----------------------------------------
  say("Cargando registros de bienestar…");
  const wellness: Record<string, unknown>[] = [];
  for (const c of clients) {
    for (let d = 13; d >= 0; d--) {
      if (rand() < 0.22 && d > 1) continue;
      const day = addDays(today, -d);
      const v = () => (rand() < 0.75 ? 4 : rand() < 0.6 ? 5 : 3);
      let row = { sleep_quality: v(), fatigue: v(), energy: v(), stress: v(), soreness: v(), pain_location: null as string | null, notes: null as string | null };
      if (c.idx === 3 && d === 1) row = { sleep_quality: 2, fatigue: 2, energy: 2, stress: 3, soreness: 2, pain_location: "Rodilla derecha", notes: "Dormí mal y me duele la rodilla al bajar escaleras." };
      if (c.idx === 6 && d === 0) row = { sleep_quality: 3, fatigue: 3, energy: 3, stress: 4, soreness: 2, pain_location: null, notes: "Mucho dolor muscular por la última sesión." };
      wellness.push({
        client_id: c.id,
        log_date: localDate(day),
        sleep_hours: round1(6 + rand() * 2.5),
        ...row,
        created_at: atTime(day, 7, 10).toISOString(),
      });
    }
  }
  await insertAll("wellness_logs", wellness);

  // Pagos ---------------------------------------------------------------------
  say("Cargando pagos…");
  const planId = uuid();
  await insertAll("payment_plans", [
    { id: planId, organization_id: org, trainer_id: trainer, name: "Mensual — 3 sesiones por semana", price: 350, currency: "BOB", billing_period: "monthly", description: "Plan personalizado con seguimiento." },
  ]);
  const clientPlans: Record<string, unknown>[] = [];
  const payments: Record<string, unknown>[] = [];
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  for (const c of clients) {
    const cpId = uuid();
    clientPlans.push({ id: cpId, client_id: c.id, plan_id: planId, start_date: localDate(addDays(week1, -3)), due_date: localDate(addDays(monthStart, 34)), status: "active" });
    // Mes pasado: pagado.
    const lastDue = addDays(monthStart, -25);
    payments.push({ client_id: c.id, client_plan_id: cpId, amount: 350, currency: "BOB", due_date: localDate(lastDue), status: "paid", paid_at: atTime(addDays(lastDue, -1), 10).toISOString(), method: c.idx % 2 ? "transfer" : "cash" });
    // Este mes: la mayoría pagó; dos pendientes y uno vencido.
    const due = c.idx === 5 ? addDays(today, -6) : addDays(today, c.idx === 2 || c.idx === 7 ? 5 : -2);
    const paid = !(c.idx === 2 || c.idx === 7 || c.idx === 5);
    payments.push({
      client_id: c.id,
      client_plan_id: cpId,
      amount: 350,
      currency: "BOB",
      due_date: localDate(due),
      status: paid ? "paid" : "pending",
      paid_at: paid ? atTime(addDays(due, -1), 11).toISOString() : null,
      method: paid ? "transfer" : null,
    });
  }
  await insertAll("client_plans", clientPlans);
  await insertAll("payments", payments);

  // Agenda: hoy y mañana ------------------------------------------------------
  say("Armando la agenda…");
  const appts: Record<string, unknown>[] = [];
  const slots: [number, number, number, number, "in_person" | "online"][] = [
    [0, 7, 0, 0, "in_person"],
    [0, 18, 30, 1, "in_person"],
    [0, 20, 0, 4, "online"],
    [1, 8, 0, 2, "in_person"],
    [1, 19, 0, 5, "in_person"],
  ];
  for (const [dayOffset, h, m, ci, kind] of slots) {
    const start = atTime(addDays(today, dayOffset), h, m);
    appts.push({
      organization_id: org,
      trainer_id: trainer,
      client_id: clients[ci].id,
      kind,
      title: kind === "online" ? "Seguimiento online" : "Sesión presencial",
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 60 * 60000).toISOString(),
    });
  }
  await insertAll("trainer_appointments", appts);

  // Notas privadas ------------------------------------------------------------
  await insertAll("client_notes", [
    { client_id: clients[0].id, body: "Cuidar el hombro derecho en empujes por encima de la cabeza." },
    { client_id: clients[3].id, body: "Viene de una lesión de rodilla (2023). Progresar la sentadilla con cuidado." },
    { client_id: clients[1].id, body: "Compite en powerlifting en marzo: priorizar sentadilla, banca y peso muerto." },
  ]);

  say("¡Listo!");
}
