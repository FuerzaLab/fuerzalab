/**
 * Manual de FuerzaLab: una sola fuente para el Centro de ayuda (con
 * buscador) y para el manual en PDF. Textos cortos: para qué sirve cada
 * pantalla, qué hace cada botón y cómo se usa.
 *
 * Para agregar o cambiar algo: editar el tema correspondiente. `capture` es
 * el número de la captura de pantalla que lo acompaña en el manual.
 */
import { paths } from "../routes/paths";

export type HelpRole = "trainer" | "client";

export interface HelpTopic {
  id: string;
  role: HelpRole;
  /** Pantalla a la que corresponde (para el botón "?" de cada pantalla). */
  path?: string;
  section: string;
  title: string;
  /** Para qué sirve, en una o dos frases. */
  summary: string;
  /** Botones y partes de la pantalla. */
  buttons?: { label: string; desc: string }[];
  /** Cómo se usa, paso a paso. */
  steps?: string[];
  tips?: string[];
  /** Palabras extra para el buscador (sinónimos). */
  keywords?: string;
  /** Número de captura en el manual. */
  capture?: number;
}

export const HELP_TOPICS: HelpTopic[] = [
  // ===================================================================
  // ENTRENADOR — Primeros pasos
  // ===================================================================
  {
    id: "t-primeros-pasos",
    role: "trainer",
    section: "Primeros pasos",
    title: "Tus primeros 10 minutos",
    summary: "Lo mínimo para empezar a trabajar con tu primer alumno.",
    steps: [
      "Configuración → Tu marca: sube tu logo (aparece junto al de FuerzaLab en la app de tus alumnos y en los reportes).",
      "Clientes → Invitar cliente: carga su nombre y WhatsApp, y mándale la invitación con el botón de WhatsApp.",
      "Cuando el alumno complete su formulario de ingreso, te aparece en Novedades: revísalo y tocá «Aprobar ingreso».",
      "Constructor de rutinas: elige al alumno y arma su rutina (Rutinas fijas si no planificas por semanas).",
      "Listo: el alumno ve su rutina de hoy en su celular y registra cada serie.",
    ],
    keywords: "empezar comenzar inicio tutorial guía nuevo",
  },

  // ===================================================================
  // ENTRENADOR — Hoy
  // ===================================================================
  {
    id: "t-inicio",
    role: "trainer",
    path: paths.trainerDashboard,
    section: "Hoy",
    title: "Inicio",
    summary: "Tu resumen del día: a quién atender hoy, quién entrena, y las novedades de tus alumnos.",
    buttons: [
      { label: "Novedades", desc: "Lo que pasó con tus alumnos: alumnos nuevos, formularios para revisar, récords, bienestar en rojo, pagos por vencer o vencidos, alumnos que dejaron de entrenar. Toca una para ir directo." },
      { label: "Filtros (Todas, Pago, Récord…)", desc: "Muestran solo un tipo de novedad." },
      { label: "✓ Atendida", desc: "La saca de la lista. Si el problema sigue, vuelve a aparecer más adelante." },
      { label: "Botón de WhatsApp", desc: "Abre WhatsApp con el mensaje ya escrito (por ejemplo, a quien dejó de entrenar)." },
      { label: "Buscar (Ctrl + K)", desc: "Arriba: escribe el nombre de un alumno o de una sección y salta directo." },
    ],
    tips: ["Revisa el Inicio antes de cada jornada: lo que está en rojo es lo primero."],
    keywords: "panel dashboard novedades alertas avisos resumen",
    capture: 1,
  },
  {
    id: "t-entrenar",
    role: "trainer",
    path: paths.trainerRunSession,
    section: "Hoy",
    title: "Entrenar con cliente",
    summary: "Para cuando das la clase en persona: abres la rutina del alumno y cargas sus series mientras lo acompañas.",
    buttons: [
      { label: "Cliente", desc: "Elige con quién vas a entrenar." },
      { label: "Rutina", desc: "Elige la de hoy (o cualquier otra de la semana)." },
      { label: "✓ (en cada serie)", desc: "Marca la serie como hecha y arranca el descanso, con sonido al terminar." },
      { label: "👥 Abrir una sala", desc: "Para entrenar a varios alumnos a la vez (ver «Sala»)." },
    ],
    steps: ["Elige al alumno.", "Abre su rutina de hoy.", "Carga repeticiones y carga de cada serie, y toca ✓.", "Al final, «Terminar»: se ve el resumen de la sesión."],
    tips: ["Queda en su historial igual que si lo hubiera cargado él."],
    keywords: "presencial clase sesión registrar series",
    capture: 2,
  },
  {
    id: "t-sala",
    role: "trainer",
    path: paths.trainerRoom,
    section: "Hoy",
    title: "Sala: varios alumnos a la vez",
    summary: "Acompañas a varios alumnos en la misma hora, cada uno con su tarjeta, su serie actual y su propio descanso.",
    buttons: [
      { label: "Cada uno su rutina", desc: "Cada alumno hace la rutina que le toca hoy (o eliges una de su semana)." },
      { label: "Misma rutina para todos", desc: "Clase grupal: eliges una plantilla o la rutina de un alumno, y cada uno registra sus propias cargas." },
      { label: "✓ Serie hecha", desc: "Guarda la serie de ese alumno y arranca su descanso." },
      { label: "Saltar esta serie", desc: "La pasa sin registrar." },
      { label: "+ Sumar alumno", desc: "Agrega a alguien que llegó tarde." },
      { label: "Terminar la sala", desc: "Cierra la sesión de cada uno y muestra un resumen." },
    ],
    tips: ["Si un alumno llegó con dolor o mal bienestar, su tarjeta aparece en amarillo o rojo.", "Si se recarga la página, aparece «Retomar la sala»."],
    keywords: "grupo grupal clase varios semipersonalizado",
    capture: 3,
  },
  {
    id: "t-agenda",
    role: "trainer",
    path: paths.trainerAgenda,
    section: "Hoy",
    title: "Agenda",
    summary: "Tus clases y citas de la semana.",
    buttons: [{ label: "Nueva cita", desc: "Agenda una sesión con un alumno, en día y hora." }],
    keywords: "calendario citas horarios turnos",
  },

  // ===================================================================
  // ENTRENADOR — Clientes
  // ===================================================================
  {
    id: "t-clientes",
    role: "trainer",
    path: paths.trainerClients,
    section: "Clientes",
    title: "Clientes",
    summary: "La lista de tus alumnos: los invitas, ves su estado y entras a su ficha.",
    buttons: [
      { label: "Invitar cliente", desc: "Crea al alumno y te da un enlace para mandarle por WhatsApp." },
      { label: "Cargar varios", desc: "Pega una lista o sube un Excel (nombre, WhatsApp, correo) y crea a todos de una vez." },
      { label: "WhatsApp (en cada alumno)", desc: "Le escribes directo." },
      { label: "Pausar / Dar de baja / Reactivar", desc: "Pausado o dado de baja no entra a la app ni se cobra; su historial se conserva." },
      { label: "Etiqueta «Esperando pago del cupo»", desc: "Alumno nuevo por encima de tu plan: entra apenas se pague su cupo." },
      { label: "Etiquetas «Plan por terminar» y «Terminó su plan»", desc: "Está en la última semana con rutinas, o ya las hizo todas: es momento de armarle lo que sigue (también te avisa en Novedades)." },
    ],
    keywords: "alumnos lista invitar invitación registrar",
    capture: 4,
  },
  {
    id: "t-ficha",
    role: "trainer",
    section: "Clientes",
    title: "Ficha del alumno",
    summary: "Todo de un alumno en un lugar: datos, formulario de ingreso, salud, plan y progreso.",
    buttons: [
      { label: "Celular · Escribir por WhatsApp", desc: "Debajo de su correo. «+ Agregar su celular» si no lo tiene." },
      { label: "Ver formulario completo", desc: "PAR-Q+, lesiones, hábitos y contacto de emergencia; se descarga en PDF." },
      { label: "Aprobar ingreso", desc: "Confirma que revisaste su formulario." },
      { label: "kg / lb", desc: "En qué unidad entrena según su gimnasio." },
    ],
    tips: ["Si respondió «Sí» a alguna pregunta del PAR-Q+, aparece resaltado en rojo: revísalo antes de armarle el plan."],
    keywords: "perfil datos formulario parq salud",
    capture: 5,
  },
  {
    id: "t-mensajes",
    role: "trainer",
    path: paths.trainerMessages,
    section: "Clientes",
    title: "Mensajes",
    summary: "Chat con cada alumno dentro de la app.",
    keywords: "chat conversación escribir",
  },

  // ===================================================================
  // ENTRENADOR — Entrenamiento
  // ===================================================================
  {
    id: "t-constructor",
    role: "trainer",
    path: paths.trainerBuilder,
    section: "Entrenamiento",
    title: "Constructor de rutinas",
    summary: "Donde armas la rutina de cada día de un alumno: ejercicios, series, repeticiones, carga, RIR y descanso.",
    buttons: [
      { label: "¿Cómo quieres trabajar? (primera vez)", desc: "Rutinas fijas: armas los días y se repiten cada semana. Plan por semanas: con bloques y progresión." },
      { label: "Días / rutinas (arriba)", desc: "Toca uno para editarlo; arrástralos para cambiarlos de lugar." },
      { label: "Añadir a la sesión", desc: "Busca un ejercicio y súmalo al bloque elegido." },
      { label: "Crear un ejercicio nuevo", desc: "Si no está en la lista, lo creas ahí mismo." },
      { label: "Importar rutina", desc: "Desde un Excel o Word; si un ejercicio no existe, lo puedes crear al importar." },
      { label: "⋮⋮ (en cada ejercicio)", desc: "Arrastra para reordenar (en la computadora)." },
      { label: "Biserie", desc: "Agrupa ejercicios que se hacen alternados (A1, A2)." },
      { label: "🔒 Rutina realizada", desc: "Ya la hizo el alumno: queda como historial y no se modifica. Duplícala para cambiarla." },
    ],
    tips: ["En Rutinas fijas, lo que cambies aplica desde la próxima vez; lo ya entrenado no se toca."],
    keywords: "rutina armar crear plan ejercicios series repeticiones",
    capture: 6,
  },
  {
    id: "t-planificacion",
    role: "trainer",
    path: paths.trainerPrograms,
    section: "Entrenamiento",
    title: "Planificación",
    summary: "Para quien planifica: programas por semanas, con mesociclos y progresión.",
    buttons: [
      { label: "Nuevo programa", desc: "Elige alumno, cantidad de semanas y fecha de inicio." },
    ],
    tips: ["Las semanas se arman en el Constructor: «Copiar a la semana siguiente» duplica una semana con una progresión de carga sugerida."],
    keywords: "programa macrociclo mesociclo semanas periodización",
  },
  {
    id: "t-plantillas",
    role: "trainer",
    path: paths.trainerTemplates,
    section: "Entrenamiento",
    title: "Plantillas",
    summary: "Rutinas y programas guardados para reutilizar con cualquier alumno.",
    buttons: [
      { label: "Agregar 4 rutinas de ejemplo", desc: "Rutinas armadas para empezar sin partir de cero." },
      { label: "Ver ejercicios", desc: "Muestra el contenido antes de aplicarla." },
      { label: "Aplicar", desc: "La copia al plan de un alumno, para ajustarla." },
    ],
    keywords: "guardar reutilizar modelos ejemplos",
  },
  {
    id: "t-ejercicios",
    role: "trainer",
    path: paths.trainerExercises,
    section: "Entrenamiento",
    title: "Ejercicios",
    summary: "Tu biblioteca de ejercicios: los globales de FuerzaLab y los tuyos.",
    buttons: [
      { label: "Nuevo ejercicio", desc: "Nombre, grupo muscular, región (tren superior, inferior o full body), patrón y equipamiento." },
      { label: "Subir foto de demostración", desc: "Una foto (se comprime sola)." },
      { label: "Video de YouTube o Vimeo", desc: "Pega el enlace: el alumno lo ve dentro de la app." },
      { label: "Revisar videos", desc: "Comprueba que los enlaces sigan funcionando." },
      { label: "Superior / Inferior / Full body", desc: "Filtra la lista." },
    ],
    tips: ["Sube tus propios videos a YouTube como «No listado»: es gratis y no gasta espacio de la app."],
    keywords: "biblioteca video foto youtube vimeo",
    capture: 7,
  },
  {
    id: "t-evaluaciones",
    role: "trainer",
    path: paths.trainerAssessments,
    section: "Entrenamiento",
    title: "Evaluaciones",
    summary: "Medidas, composición corporal, pliegues, fuerza, movilidad y fotos de cada alumno.",
    buttons: [
      { label: "Nueva evaluación", desc: "Elige el tipo y completa lo que midas." },
      { label: "Calcular % de grasa y masa libre de grasa", desc: "Con el método Naval o Jackson-Pollock." },
      { label: "Rendimiento: potencia, velocidad y funcionales", desc: "Saltos (CMJ, SJ, drop jump), balón medicinal, sprints con parciales, sprint lanzado, 505, 5-10-5, dinamometría de mano, silla (30 s y 5 rep.) y velocidad de marcha. Cada prueba trae su protocolo; cargas los intentos y calcula la potencia, el RSI, las velocidades y las asimetrías, y te dice si el cambio contra la evaluación anterior es real o está dentro del error del test." },
    ],
    tips: ["Acepta coma o punto: 82,5 y 82.5 valen igual. La estatura en metros (1,70) se pasa sola a centímetros."],
    keywords: "medidas peso grasa pliegues fuerza movilidad salto cmj sprint velocidad potencia agilidad dinamometro prension silla marcha rsi",
    capture: 8,
  },
  {
    id: "t-bienestar",
    role: "trainer",
    path: paths.trainerWellness,
    section: "Entrenamiento",
    title: "Bienestar",
    summary: "Cómo llega cada alumno: sueño, energía, estrés y dolor, con un semáforo.",
    tips: ["Rojo: conviene bajar la intensidad o cambiar la sesión. El aviso también te llega a Novedades."],
    keywords: "semáforo sueño fatiga dolor estado",
  },
  {
    id: "t-fotos",
    role: "trainer",
    path: paths.trainerProgressPhotos,
    section: "Entrenamiento",
    title: "Fotos de progreso",
    summary: "Las fotos de cada alumno por fecha, y el comparador de antes y después.",
    buttons: [
      { label: "Antes / Después", desc: "Elige dos fechas: las fotos se ven lado a lado por ángulo, con días transcurridos y cambio de peso y cintura." },
    ],
    keywords: "fotos antes después comparar progreso",
  },

  // ===================================================================
  // ENTRENADOR — Seguimiento y negocio
  // ===================================================================
  {
    id: "t-reportes",
    role: "trainer",
    path: paths.trainerReports,
    section: "Seguimiento",
    title: "Reportes",
    summary: "El progreso de un alumno: fuerza, récords, medidas, asistencia y fotos, listo para mandar.",
    buttons: [
      { label: "Exportar a PDF", desc: "Reporte con tu logo, listo para mandar." },
      { label: "Mandar por WhatsApp", desc: "Un resumen de su progreso, con el texto ya escrito." },
    ],
    keywords: "progreso informe pdf gráficos",
    capture: 9,
  },
  {
    id: "t-pagos",
    role: "trainer",
    path: paths.trainerPayments,
    section: "Negocio",
    title: "Pagos de tus alumnos",
    summary: "Planes, cobros y vencimientos de tus alumnos.",
    buttons: [
      { label: "Nuevo plan", desc: "Nombre, monto y período (mensual, trimestral…)." },
      { label: "Registrar pago", desc: "Alumno, plan, fecha de vencimiento y si está pendiente o pagado." },
      { label: "Marcar pagado", desc: "Lo da por pagado y crea solo el cobro del período siguiente." },
      { label: "Recordar (WhatsApp)", desc: "En pagos vencidos o por vencer." },
    ],
    tips: [
      "Te avisa 3 días antes, el día del vencimiento y todos los días mientras siga vencido.",
      "El próximo cobro se calcula desde la fecha de vencimiento, no desde el día en que pagó.",
    ],
    keywords: "cobros plan vencimiento deuda mensualidad",
    capture: 10,
  },
  {
    id: "t-estudio",
    role: "trainer",
    path: paths.trainerStudio,
    section: "Negocio",
    title: "Tu estudio (solo el dueño)",
    summary: "Cómo va todo el estudio: cada entrenador con sus alumnos, asistencia, bienestar y cobros.",
    buttons: [
      { label: "Entrenadores de tu estudio → + Invitar entrenador", desc: "Invitas a tus entrenadores y les mandas el enlace por WhatsApp." },
      { label: "Dejaron de entrenar", desc: "Alumnos de todo el estudio que no entrenan hace días." },
    ],
    keywords: "estudio dueño equipo entrenadores gimnasio",
  },
  {
    id: "t-equipo",
    role: "trainer",
    path: paths.trainerTeam,
    section: "Negocio",
    title: "Equipo (asistentes)",
    summary: "Invitas asistentes y eliges qué secciones pueden ver o editar.",
    keywords: "asistentes permisos staff ayudante",
  },
  {
    id: "t-config",
    role: "trainer",
    path: paths.trainerSettings,
    section: "Negocio",
    title: "Configuración",
    summary: "Tus datos, tu marca, tu plan de FuerzaLab y qué secciones ver en el menú.",
    buttons: [
      { label: "Tu marca", desc: "Tu logo, que ven tus alumnos y sale en los reportes." },
      { label: "Mi plan de FuerzaLab", desc: "Tu plan, tus alumnos, cuánto pagas, cuándo vence y tus cupos." },
      { label: "Secciones que uso", desc: "Oculta del menú lo que no uses." },
      { label: "Unidades por defecto", desc: "Si tus alumnos entrenan en kg o en libras." },
    ],
    keywords: "ajustes perfil logo marca plan menú",
  },

  // ===================================================================
  // ALUMNO
  // ===================================================================
  {
    id: "c-primeros-pasos",
    role: "client",
    section: "Primeros pasos",
    title: "Cómo empezar",
    summary: "Lo que hace un alumno la primera vez.",
    steps: [
      "Abre el enlace que te mandó tu entrenador y crea tu cuenta.",
      "Completa tu formulario de ingreso (datos, salud y objetivos).",
      "Instala la app en tu celular: en el navegador, «Agregar a pantalla de inicio».",
      "Espera a que tu entrenador te arme la rutina: la vas a ver en tu Inicio.",
    ],
    keywords: "registro cuenta instalar empezar",
  },
  {
    id: "c-inicio",
    role: "client",
    path: paths.clientDashboard,
    section: "Mi entrenamiento",
    title: "Inicio",
    summary: "Tu rutina de hoy, cómo vienes este mes y tus récords.",
    buttons: [
      { label: "Entrenar ahora", desc: "Abre tu rutina de hoy (primero la ves, sin empezar nada)." },
      { label: "¿Cómo llegas hoy? (bienestar)", desc: "20 segundos antes de entrenar: sueño, energía, estrés y si te duele algo." },
      { label: "Agrega tu celular", desc: "Si no lo cargaste, para que tu entrenador pueda escribirte." },
    ],
    keywords: "hoy rutina inicio",
    capture: 11,
  },
  {
    id: "c-rutina",
    role: "client",
    path: paths.clientRoutine,
    section: "Mi entrenamiento",
    title: "Mi rutina y cómo entrenar",
    summary: "Ves los ejercicios del día y registras cada serie.",
    steps: [
      "Toca «Entrenar ahora» o «Ver y entrenar»: ves todos los ejercicios del día, sin empezar.",
      "«▶ Ver» en un ejercicio: su video o foto.",
      "«Empezar entrenamiento» → «Sí, empezar ahora».",
      "En cada serie: repeticiones y carga (ya vienen cargadas), y ✓. Arranca el descanso, que suena al terminar (🔔 para silenciarlo).",
      "Al terminar, «Terminar»: ves cuánto duró, cuánto levantaste y cómo te fue comparado con la vez anterior. Si batiste un récord, se celebra.",
    ],
    tips: ["«Última vez» te muestra lo que hiciste la sesión anterior en ese ejercicio."],
    keywords: "entrenar series registrar descanso récord",
    capture: 12,
  },
  {
    id: "c-progreso",
    role: "client",
    path: paths.clientProgress,
    section: "Mi progreso",
    title: "Mi progreso y fotos",
    summary: "Tus récords, tus gráficos de fuerza y tus fotos de antes y después.",
    buttons: [{ label: "Antes / Después", desc: "Compara tus fotos de dos fechas, lado a lado por ángulo." }],
    keywords: "progreso fotos récords gráficos",
    capture: 13,
  },
  {
    id: "c-evaluaciones",
    role: "client",
    path: paths.clientAssessments,
    section: "Mi progreso",
    title: "Mis evaluaciones",
    summary: "Tus medidas y evaluaciones, y tus propios registros.",
    buttons: [{ label: "Registrar mis medidas", desc: "Tu peso y medidas de hoy (con coma o punto)." }],
    keywords: "medidas peso evaluación",
  },
  {
    id: "c-pagos",
    role: "client",
    path: paths.clientPayments,
    section: "Mi cuenta",
    title: "Pagos",
    summary: "Lo que pagaste y lo que vence, y donde subes tu comprobante.",
    buttons: [{ label: "Subir comprobante", desc: "Foto o PDF de tu pago, para que tu entrenador lo confirme." }],
    keywords: "pagos comprobante mensualidad",
  },
  {
    id: "c-mensajes",
    role: "client",
    path: paths.clientMessages,
    section: "Mi cuenta",
    title: "Mensajes",
    summary: "Chat con tu entrenador.",
    keywords: "chat entrenador",
  },
];

/** Captura → botones (por posición en la tabla) que tienen su número dibujado en la imagen. */
export const HELP_MARKED: Record<number, number[]> = {
  1: [0, 1, 2, 3, 4],
  2: [0, 1, 3],
  3: [2, 3, 4, 5],
  4: [0, 1, 2, 3],
  5: [0, 1, 2],
  6: [1],
  7: [0, 1, 2, 3, 4],
  9: [0, 1],
  10: [0, 1, 2, 3],
};

/** Imagen de una captura (en public/help) y el manual en PDF. */
export const helpImage = (n: number) => `/help/${String(n).padStart(2, "0")}.jpg`;
export const HELP_PDF = "/help/FuerzaLab-Manual-rapido.pdf";

/** Normaliza para buscar sin tildes ni mayúsculas. */
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Buscador del Centro de ayuda: título, resumen, botones, pasos, consejos y sinónimos. */
export function searchHelp(query: string, role: HelpRole): HelpTopic[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  const pool = HELP_TOPICS.filter((t) => t.role === role);
  if (!words.length) return pool;
  const scored = pool
    .map((t) => {
      const title = norm(t.title);
      const text = norm(
        [t.summary, t.section, t.keywords ?? "", ...(t.buttons ?? []).flatMap((b) => [b.label, b.desc]), ...(t.steps ?? []), ...(t.tips ?? [])].join(" "),
      );
      let score = 0;
      for (const w of words) {
        if (title.includes(w)) score += 5;
        else if (text.includes(w)) score += 1;
        else return null;
      }
      return { t, score };
    })
    .filter((x): x is { t: HelpTopic; score: number } => !!x)
    .sort((a, b) => b.score - a.score);
  return scored.map((x) => x.t);
}

/** El tema de ayuda de una pantalla (para el botón "?"). */
export function helpForPath(path: string, role: HelpRole): HelpTopic | undefined {
  return HELP_TOPICS.find((t) => t.role === role && t.path && (path === t.path || path.startsWith(t.path + "/")));
}
