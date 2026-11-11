/**
 * Pruebas de rendimiento (Evaluaciones → Rendimiento): potencia, velocidad
 * y funcionales. Cada prueba: protocolo breve, qué se carga, si es mejor un
 * valor más alto o más bajo, y una referencia APROXIMADA del error típico
 * del test (variación entre intentos/días) para saber si un cambio es real.
 * Las referencias son orientativas: lo ideal es medir el error propio de
 * cada entrenador con sus alumnos (repitiendo el test en días cercanos).
 */

export type PerfKind = "jump" | "dropjump" | "throw" | "distance" | "sprint" | "flying" | "time" | "force" | "reps" | "custom";

export type PerfSection = "performance" | "health";
export type PerfGroup =
  | "Potencia"
  | "Velocidad y cambio de dirección"
  | "Otras"
  | "Fuerza funcional"
  | "Equilibrio y marcha"
  | "Resistencia aeróbica"
  | "Flexibilidad"
  | "Otras pruebas";

/** Rendimiento deportivo vs. Salud y funcionalidad. */
export const SECTION_OF_GROUP: Record<PerfGroup, PerfSection> = {
  Potencia: "performance",
  "Velocidad y cambio de dirección": "performance",
  Otras: "performance",
  "Fuerza funcional": "health",
  "Equilibrio y marcha": "health",
  "Resistencia aeróbica": "health",
  Flexibilidad: "health",
  "Otras pruebas": "health",
};
export const SECTION_TITLE: Record<PerfSection, string> = {
  performance: "Rendimiento deportivo: potencia y velocidad",
  health: "Salud y funcionalidad",
};

export interface PerfTestDef {
  key: string;
  group: PerfGroup;
  name: string;
  kind: PerfKind;
  unit: string;
  /** "higher": más es mejor (salto, fuerza); "lower": menos es mejor (tiempos). */
  better: "higher" | "lower";
  /** Por lado (izquierda / derecha). */
  sides?: boolean;
  /** Intentos que se cargan. */
  trials: number;
  protocol: string;
  /** Error típico aproximado, en % (orientativo). */
  typicalErrorPct: number;
  /** Para pruebas que pueden dar 0 o negativo (cm de alcance, puntajes): error típico en la unidad de la prueba. */
  typicalErrorAbs?: number;
  /** Acepta 0 y valores negativos (por ejemplo, −5 cm si no llega). */
  allowNonPositive?: boolean;
}

export const PERF_TESTS: PerfTestDef[] = [
  // ----- Potencia -----
  {
    key: "cmj",
    group: "Potencia",
    name: "Salto con contramovimiento (CMJ)",
    kind: "jump",
    unit: "cm",
    better: "higher",
    trials: 3,
    protocol: "Manos en la cintura, bajada rápida a la profundidad que elija y salto máximo. Caer con piernas extendidas. 3 intentos, 1 min de pausa. Plataforma, alfombra de contacto o app validada (My Jump).",
    typicalErrorPct: 4,
  },
  {
    key: "sj",
    group: "Potencia",
    name: "Squat jump (SJ)",
    kind: "jump",
    unit: "cm",
    better: "higher",
    trials: 3,
    protocol: "Manos en la cintura, quieto 2-3 s con rodillas a ~90° y salto sin contramovimiento (sin bajar antes). 3 intentos.",
    typicalErrorPct: 5,
  },
  {
    key: "dj",
    group: "Potencia",
    name: "Drop jump (RSI)",
    kind: "dropjump",
    unit: "cm",
    better: "higher",
    trials: 3,
    protocol: "Dejarse caer desde un cajón (30-40 cm) y saltar lo más alto posible con el menor tiempo de contacto. Carga la altura del salto y el tiempo de contacto de cada intento.",
    typicalErrorPct: 7,
  },
  {
    key: "broad_jump",
    group: "Potencia",
    name: "Salto horizontal a pies juntos",
    kind: "distance",
    unit: "cm",
    better: "higher",
    trials: 3,
    protocol: "Pies juntos detrás de la línea, con impulso de brazos y sin carrera previa. Se mide hasta el talón más cercano a la línea, y tiene que caer sin perder el equilibrio (si se cae hacia atrás o apoya las manos, se repite). 3 intentos.",
    typicalErrorPct: 3,
  },
  {
    key: "triple_hop",
    group: "Potencia",
    name: "Triple salto a una pierna",
    kind: "distance",
    unit: "cm",
    better: "higher",
    sides: true,
    trials: 2,
    protocol: "Tres saltos seguidos hacia adelante con la misma pierna, cayendo sobre ella y quedándose 2 s sin perder el equilibrio. Con cada pierna. Muy usado para ver la diferencia entre piernas (por ejemplo, al volver de una lesión de rodilla).",
    typicalErrorPct: 4,
  },
  {
    key: "mb_throw",
    group: "Potencia",
    name: "Lanzamiento de balón medicinal sentado",
    kind: "throw",
    unit: "m",
    better: "higher",
    trials: 3,
    protocol: "Sentado contra la pared, piernas extendidas, lanzamiento de pecho a dos manos. Anota el peso del balón (siempre el mismo). Distancia hasta el primer contacto.",
    typicalErrorPct: 5,
  },
  // ----- Velocidad -----
  {
    key: "sprint",
    group: "Velocidad y cambio de dirección",
    name: "Sprint lineal con parciales",
    kind: "sprint",
    unit: "s",
    better: "lower",
    trials: 3,
    protocol: "Salida de pie a 0,5 m de la primera fotocélula. Parciales a 10, 20 y 30 m (40 m opcional). 3 intentos, 3 min de pausa. El cronómetro de mano no sirve para comparar cambios pequeños.",
    typicalErrorPct: 2,
  },
  {
    key: "flying20",
    group: "Velocidad y cambio de dirección",
    name: "Sprint lanzado 20 m (velocidad máxima)",
    kind: "flying",
    unit: "s",
    better: "lower",
    trials: 3,
    protocol: "20 m de aceleración previa y se cronometran los 20 m siguientes. Da la velocidad máxima.",
    typicalErrorPct: 2,
  },
  {
    key: "cod505",
    group: "Velocidad y cambio de dirección",
    name: "Test 505 (cambio de dirección)",
    kind: "time",
    unit: "s",
    better: "lower",
    sides: true,
    trials: 2,
    protocol: "10 m lanzados, giro de 180° sobre la línea y 5 m de vuelta; se cronometran los 5 m de ida y los 5 m de vuelta. Con cada pierna de giro. Con un sprint de 10 m en la misma evaluación, calcula el déficit de cambio de dirección.",
    typicalErrorPct: 3,
  },
  {
    key: "cod5105",
    group: "Velocidad y cambio de dirección",
    name: "5-10-5 (pro-agility)",
    kind: "time",
    unit: "s",
    better: "lower",
    trials: 2,
    protocol: "Desde el centro, 5 m a un lado, 10 m al otro y 5 m de vuelta al centro, tocando cada línea.",
    typicalErrorPct: 3,
  },
  // ----- Funcionales y salud -----
  {
    key: "handgrip",
    group: "Fuerza funcional",
    name: "Dinamometría de mano",
    kind: "force",
    unit: "kg",
    better: "higher",
    sides: true,
    trials: 3,
    protocol: "De pie, brazo al costado y codo extendido, apretar al máximo 3-5 s. 3 intentos por mano, alternando. Buen indicador general de salud y fragilidad.",
    typicalErrorPct: 5,
  },
  {
    key: "sts30",
    group: "Fuerza funcional",
    name: "Sentarse y levantarse en 30 s",
    kind: "reps",
    unit: "rep",
    better: "higher",
    trials: 1,
    protocol: "Silla de ~43 cm contra la pared, brazos cruzados. Cuántas veces se levanta por completo en 30 s.",
    typicalErrorPct: 10,
  },
  {
    key: "sts5",
    group: "Fuerza funcional",
    name: "5 repeticiones sentarse y levantarse",
    kind: "time",
    unit: "s",
    better: "lower",
    trials: 1,
    protocol: "Brazos cruzados, lo más rápido posible, 5 veces de sentado a de pie. Se cronometra hasta que se sienta la quinta vez.",
    typicalErrorPct: 10,
  },
  {
    key: "gait4",
    group: "Equilibrio y marcha",
    name: "Velocidad de marcha (4 m)",
    kind: "time",
    unit: "s",
    better: "lower",
    trials: 2,
    protocol: "Caminar a su ritmo habitual 4 m (con 1-2 m previos para no arrancar desde quieto). Muy predictiva de la funcionalidad en adultos mayores.",
    typicalErrorPct: 5,
  },
  {
    key: "arm_curl30",
    group: "Fuerza funcional",
    name: "Flexiones de codo en 30 s",
    kind: "reps",
    unit: "rep",
    better: "higher",
    trials: 1,
    protocol: "Sentado, con el brazo dominante al costado: flexiones de codo completas con mancuerna durante 30 s. Peso: 2,3 kg las mujeres y 3,6 kg los hombres (protocolo del Senior Fitness Test).",
    typicalErrorPct: 10,
  },
  {
    key: "pushups_full",
    group: "Fuerza funcional",
    name: "Flexiones de brazos (completas)",
    kind: "reps",
    unit: "rep",
    better: "higher",
    trials: 1,
    protocol: "Cuerpo recto de la cabeza a los talones, bajar hasta que el pecho quede a un puño del suelo. Cuántas seguidas, sin pausa y sin perder la técnica.",
    typicalErrorPct: 10,
  },
  {
    key: "pushups_knees",
    group: "Fuerza funcional",
    name: "Flexiones de brazos (con rodillas)",
    kind: "reps",
    unit: "rep",
    better: "higher",
    trials: 1,
    protocol: "Igual que las completas, pero con las rodillas apoyadas y el cuerpo recto de la cabeza a las rodillas. Compara siempre con la misma variante.",
    typicalErrorPct: 10,
  },
  {
    key: "srt",
    group: "Fuerza funcional",
    name: "Sentarse y levantarse del suelo",
    kind: "reps",
    unit: "puntos",
    better: "higher",
    trials: 2,
    protocol: "Sentarse en el suelo y volver a levantarse, sin apoyarse si puede. Se parte de 5 puntos para sentarse y 5 para levantarse, y se resta 1 por cada apoyo (mano, rodilla, antebrazo, costado de la pierna) y 0,5 si pierde el equilibrio. Puntaje de 0 a 10.",
    typicalErrorPct: 10,
    typicalErrorAbs: 1,
    allowNonPositive: true,
  },
  {
    key: "tug",
    group: "Equilibrio y marcha",
    name: "Levantarse y caminar (Timed Up and Go)",
    kind: "time",
    unit: "s",
    better: "lower",
    trials: 2,
    protocol: "Desde sentado, levantarse, caminar lo más rápido posible (sin correr) hasta un cono a 2,44 m, rodearlo y volver a sentarse. Se cronometra desde «ya» hasta que se sienta. Relacionado con el riesgo de caídas.",
    typicalErrorPct: 8,
  },
  {
    key: "balance_eo",
    group: "Equilibrio y marcha",
    name: "Equilibrio en una pierna (ojos abiertos)",
    kind: "time",
    unit: "s",
    better: "higher",
    sides: true,
    trials: 2,
    protocol: "Brazos cruzados, levantar un pie y mantenerse el mayor tiempo posible (máximo 60 s). Se corta si apoya el pie, se agarra o mueve el pie de apoyo. Con cada pierna.",
    typicalErrorPct: 15,
  },
  {
    key: "balance_ec",
    group: "Equilibrio y marcha",
    name: "Equilibrio en una pierna (ojos cerrados)",
    kind: "time",
    unit: "s",
    better: "higher",
    sides: true,
    trials: 2,
    protocol: "Igual que con ojos abiertos, pero con los ojos cerrados (máximo 30 s). Hazlo junto a una pared o con alguien al lado, por seguridad.",
    typicalErrorPct: 20,
  },
  {
    key: "walk6",
    group: "Resistencia aeróbica",
    name: "Marcha de 6 minutos",
    kind: "distance",
    unit: "m",
    better: "higher",
    trials: 1,
    protocol: "Caminar lo más rápido posible, sin correr, durante 6 minutos, ida y vuelta en un tramo marcado (por ejemplo, 20 o 30 m). Se anotan los metros totales. Puede parar a descansar si lo necesita.",
    typicalErrorPct: 5,
  },
  {
    key: "step2",
    group: "Resistencia aeróbica",
    name: "Step de 2 minutos",
    kind: "reps",
    unit: "rep",
    better: "higher",
    trials: 1,
    protocol: "Marcha en el lugar durante 2 minutos, subiendo la rodilla hasta una marca a mitad de camino entre la rótula y la cadera. Se cuentan las veces que sube la rodilla derecha. Útil cuando no hay espacio para caminar.",
    typicalErrorPct: 8,
  },
  {
    key: "chair_reach",
    group: "Flexibilidad",
    name: "Alcanzar los pies sentado en la silla",
    kind: "distance",
    unit: "cm",
    better: "higher",
    sides: true,
    trials: 2,
    protocol: "Sentado en el borde de la silla, una pierna extendida con el talón apoyado, inclinarse con las manos una sobre otra hacia los dedos del pie. Distancia entre la punta de los dedos de la mano y la del pie: negativa si no llega (−5), positiva si pasa (+3). Lado = pierna extendida.",
    typicalErrorPct: 10,
    typicalErrorAbs: 2.5,
    allowNonPositive: true,
  },
  {
    key: "back_scratch",
    group: "Flexibilidad",
    name: "Rascarse la espalda",
    kind: "distance",
    unit: "cm",
    better: "higher",
    sides: true,
    trials: 2,
    protocol: "Una mano por encima del hombro y la otra por detrás de la cintura, intentar que los dedos medios se toquen. Distancia entre ellos: negativa si no se tocan (−8), positiva si se superponen (+2). Lado = la mano que va por arriba.",
    typicalErrorPct: 10,
    typicalErrorAbs: 2.5,
    allowNonPositive: true,
  },
  {
    key: "custom_health",
    group: "Otras pruebas",
    name: "Otra prueba",
    kind: "custom",
    unit: "",
    better: "higher",
    trials: 3,
    protocol: "Para cualquier prueba de salud o funcional que no esté en la lista. Escribe su nombre y su unidad, y si es mejor un valor más alto o más bajo. Usa siempre el mismo nombre: así se compara con la evaluación anterior.",
    typicalErrorPct: 10,
  },
  // ----- Otras -----
  {
    key: "custom",
    group: "Otras",
    name: "Otra prueba",
    kind: "custom",
    unit: "",
    better: "higher",
    trials: 3,
    protocol: "Para cualquier prueba que no esté en la lista (por ejemplo, la potencia de un encóder en W). Escribe su nombre y su unidad, y si es mejor un valor más alto o más bajo. Usa siempre el mismo nombre: así se compara con la evaluación anterior.",
    typicalErrorPct: 5,
  },
];

export const perfTest = (key: string) => PERF_TESTS.find((t) => t.key === key);

/** La definición efectiva de una prueba cargada ("Otra prueba" toma nombre, unidad y sentido de lo que se cargó). */
export function effectiveDef(key: string, details: Record<string, any> | undefined): PerfTestDef | undefined {
  const d = perfTest(key);
  if (!d || d.kind !== "custom") return d;
  // "Otra prueba": nombre, unidad y sentido, de lo que se cargó.
  return { ...d, name: details?.name || d.name, unit: details?.unit || "", better: details?.better === "lower" ? "lower" : "higher" };
}

export const SPRINT_SPLITS = [10, 20, 30, 40] as const;

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** El mejor de los intentos, según si conviene más alto o más bajo. */
export function bestOf(values: number[], better: "higher" | "lower", allowNonPositive = false): number | null {
  const v = values.filter((x) => Number.isFinite(x) && (allowNonPositive || x > 0));
  if (!v.length) return null;
  return better === "higher" ? Math.max(...v) : Math.min(...v);
}

/**
 * Lo que se calcula de cada prueba. `bodyKg`: peso del alumno (de la misma
 * evaluación, si se cargó).
 */
export function computeMetrics(
  def: PerfTestDef,
  best: number | null,
  details: { contactMs?: number[]; trials?: number[]; splits?: Record<string, number[]>; ballKg?: number },
  bodyKg: number | null,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (def.kind === "jump" && best && bodyKg) {
    // Potencia pico estimada (ecuación de Sayers): 60,7 × altura (cm) + 45,3 × masa (kg) − 2055.
    const w = 60.7 * best + 45.3 * bodyKg - 2055;
    if (w > 0) {
      out.power_w = Math.round(w);
      out.power_wkg = r1(w / bodyKg);
    }
  }
  if (def.kind === "dropjump" && details.trials && details.contactMs) {
    let bestRsi = 0;
    details.trials.forEach((h, i) => {
      const tc = details.contactMs?.[i];
      if (h > 0 && tc && tc > 0) bestRsi = Math.max(bestRsi, h / 100 / (tc / 1000));
    });
    if (bestRsi > 0) out.rsi = r2(bestRsi);
  }
  if (def.kind === "flying" && best) {
    out.speed_ms = r2(20 / best);
    out.speed_kmh = r1((20 / best) * 3.6);
  }
  if (def.key === "gait4" && best) out.speed_ms = r2(4 / best);
  if (def.kind === "sprint" && details.splits) {
    for (const d of SPRINT_SPLITS) {
      const b = bestOf(details.splits[String(d)] ?? [], "lower");
      if (b) out[`best_${d}`] = r2(b);
    }
    const b10 = out.best_10, b20 = out.best_20, b30 = out.best_30;
    if (b10) out.speed_0_10 = r2(10 / b10);
    if (b10 && b20 && b20 > b10) out.speed_10_20 = r2(10 / (b20 - b10));
    if (b20 && b30 && b30 > b20) out.speed_20_30 = r2(10 / (b30 - b20));
  }
  if (def.key === "handgrip" && best && bodyKg) out.relative = r2(best / bodyKg);
  return out;
}

export const METRIC_LABEL: Record<string, { label: string; unit: string }> = {
  power_w: { label: "Potencia pico estimada", unit: "W" },
  power_wkg: { label: "Potencia relativa", unit: "W/kg" },
  rsi: { label: "Índice de fuerza reactiva (RSI)", unit: "m/s" },
  speed_ms: { label: "Velocidad", unit: "m/s" },
  speed_kmh: { label: "Velocidad", unit: "km/h" },
  best_10: { label: "Mejor 10 m", unit: "s" },
  best_20: { label: "Mejor 20 m", unit: "s" },
  best_30: { label: "Mejor 30 m", unit: "s" },
  best_40: { label: "Mejor 40 m", unit: "s" },
  speed_0_10: { label: "Velocidad 0-10 m", unit: "m/s" },
  speed_10_20: { label: "Velocidad 10-20 m", unit: "m/s" },
  speed_20_30: { label: "Velocidad 20-30 m", unit: "m/s" },
  relative: { label: "Fuerza relativa", unit: "kg por kg de peso" },
};

/** Asimetría entre lados, en % (respecto del mejor lado). */
export function asymmetryPct(a: number, b: number, better: "higher" | "lower"): number {
  const strong = better === "higher" ? Math.max(a, b) : Math.min(a, b);
  const weak = better === "higher" ? Math.min(a, b) : Math.max(a, b);
  return r1((Math.abs(strong - weak) / strong) * 100);
}

/**
 * Comparación con la evaluación anterior: cambio y si supera el error
 * típico aproximado del test (si no, puede ser solo variación normal).
 */
export function compareWithPrevious(def: PerfTestDef, now: number, before: number) {
  const diff = now - before;
  const pct = before !== 0 ? (diff / Math.abs(before)) * 100 : null;
  const improved = def.better === "higher" ? diff > 0 : diff < 0;
  // En pruebas que pueden dar 0 o negativo, el error se mira en la unidad (cm, puntos), no en %.
  const real = def.typicalErrorAbs != null ? Math.abs(diff) > def.typicalErrorAbs : pct != null && Math.abs(pct) > def.typicalErrorPct;
  return { diff: r2(diff), pct: pct == null ? null : r1(pct), improved, real };
}

/** Texto del error típico de una prueba ("~3 %" o "~2,5 cm"). */
export const errorLabel = (def: PerfTestDef) =>
  def.typicalErrorAbs != null ? `~${String(def.typicalErrorAbs).replace(".", ",")} ${def.unit}` : `~${def.typicalErrorPct} %`;

export const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : String(n).replace(".", ","));
