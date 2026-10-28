import { paths } from "../routes/paths";

/**
 * "Qué hay de nuevo": las mejoras de FuerzaLab contadas para quien usa la
 * app, en lenguaje simple (qué puedes hacer ahora, no cómo está hecho).
 *
 * CÓMO AGREGAR UNA: sumar un objeto ARRIBA de todo (la lista va de la más
 * nueva a la más vieja), con un `id` único que no se repita nunca (se usa
 * para saber qué vio cada persona). `for` dice quién la ve: entrenadores
 * (y sus asistentes) o alumnos. Los cambios internos o de Super Admin no van.
 */
export interface ChangelogEntry {
  id: string;
  date: string; // AAAA-MM-DD
  title: string;
  body: string;
  for: ("trainer" | "client")[];
  link?: { label: string; to: string };
  /** Solo para el entrenador (no lo ven sus asistentes): cosas que un asistente no puede usar. */
  notForStaff?: boolean;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-10-28-menu-two-levels",
    date: "2026-10-28",
    title: "Un menú más simple",
    body: "Al abrir el menú ves primero lo que usas todos los días: Inicio, Entrenar con cliente, Agenda, Clientes, Mensajes y el Constructor de rutinas. Todo lo demás está en \"Más herramientas\", a un toque. Y la primera vez que entras a cada pantalla, un recuadro corto te cuenta para qué sirve.",
    for: ["trainer"],
  },
  {
    id: "2026-10-28-whats-new",
    date: "2026-10-28",
    title: "Esta sección: Qué hay de nuevo",
    body: "Cada vez que FuerzaLab sume una mejora, la vas a encontrar acá, explicada en simple. Un puntito rojo en el menú te avisa cuando hay algo que todavía no viste.",
    for: ["trainer", "client"],
  },
  {
    id: "2026-10-28-kg-lb",
    notForStaff: true,
    date: "2026-10-28",
    title: "Cargas en kg o en libras",
    body: "Elige si el gimnasio de cada alumno está en kg, en libras o mixto (máquinas en libras, discos y mancuernas en kg). Tus alumnos cargan sus series en la unidad del equipo, y los récords y gráficos comparan bien aunque se mezclen.",
    for: ["trainer"],
    link: { label: "Ver dónde se configura", to: paths.trainerSettings },
  },
  {
    id: "2026-10-28-kg-lb-client",
    date: "2026-10-28",
    title: "Carga tus series en kg o en libras",
    body: "Si la máquina o las pesas están en libras, toca el botón kg / lb al lado de la carga y escribe lo que dice el equipo. Tu progreso se sigue viendo bien.",
    for: ["client"],
    link: { label: "Ir a mi rutina", to: paths.clientRoutine },
  },
  {
    id: "2026-10-28-body-fat",
    date: "2026-10-28",
    title: "% de grasa y masa libre de grasa en un solo botón",
    body: "En Evaluaciones, un solo botón calcula el % de grasa, la masa grasa y la masa libre de grasa. Si la estatura se cargó en metros (1.65), ahora se convierte sola a centímetros.",
    for: ["trainer"],
    link: { label: "Ir a Evaluaciones", to: paths.trainerAssessments },
  },
  {
    id: "2026-10-28-media-rights",
    date: "2026-10-28",
    title: "Aviso antes de subir fotos o videos de ejercicios",
    body: "La mayoría de las fotos y videos de ejercicios de internet tienen dueño. Ahora la app te lo recuerda antes de subir uno, para evitar reclamos por derechos de autor.",
    for: ["trainer"],
    link: { label: "Ir a Ejercicios", to: paths.trainerExercises },
  },
  {
    id: "2026-10-27-faster",
    date: "2026-10-27",
    title: "La app carga más rápido",
    body: "La primera vez que abres FuerzaLab descarga cinco veces menos datos que antes. Se nota sobre todo en el celular con poca señal.",
    for: ["trainer", "client"],
  },
  {
    id: "2026-10-27-install-android",
    date: "2026-10-27",
    title: "Instálala en tu celular sin avisos raros",
    body: "Si tienes un Samsung y te salía un aviso de \"app no segura\" al instalarla, ábrela en Chrome y desde el menú (⋮) elige \"Instalar app\". Queda con su ícono, como cualquier app.",
    for: ["trainer", "client"],
  },
  {
    id: "2026-10-27-legal",
    date: "2026-10-27",
    title: "Política de privacidad y Términos de uso",
    body: "Ahora puedes leer qué datos se guardan, para qué, quién los ve y cuáles son tus derechos.",
    for: ["trainer", "client"],
    link: { label: "Ver la política de privacidad", to: paths.privacy },
  },
  {
    id: "2026-10-27-intake",
    date: "2026-10-27",
    title: "Formulario de ingreso completo",
    body: "En la ficha de cada alumno, \"Ver formulario completo\" muestra todas sus respuestas juntas —incluido el PAR-Q+ con cada Sí o No— y se descarga en PDF. Al invitar a alguien, también puedes ver cómo es el formulario que va a llenar.",
    for: ["trainer"],
    link: { label: "Ir a Clientes", to: paths.trainerClients },
  },
  {
    id: "2026-10-27-studio",
    notForStaff: true,
    date: "2026-10-27",
    title: "Tu estudio",
    body: "Si eres dueño de un estudio con varios entrenadores, ves cómo va todo tu equipo —alumnos, adherencia, cobros— y qué alumnos dejaron de entrenar, para llamarlos a tiempo.",
    for: ["trainer"],
  },
  {
    id: "2026-10-26-brand",
    notForStaff: true,
    date: "2026-10-26",
    title: "Tu marca junto a FuerzaLab",
    body: "Sube el logo y el nombre de tu negocio en Configuración: tus alumnos los ven en la app y en cada reporte en PDF, con el mismo tamaño que FuerzaLab.",
    for: ["trainer"],
    link: { label: "Ir a Configuración", to: paths.trainerSettings },
  },
  {
    id: "2026-10-26-feed",
    date: "2026-10-26",
    title: "Novedades de tus alumnos en Inicio",
    body: "Récords, medidas que cargaron, comentarios al terminar, esfuerzo muy alto o muy bajo, alertas de bienestar y rutinas saltadas, todo en un mismo lugar. Las marcas como atendidas a medida que las ves.",
    for: ["trainer"],
    link: { label: "Ir a Inicio", to: paths.trainerDashboard },
  },
  {
    id: "2026-10-26-client-home",
    date: "2026-10-26",
    title: "Tu Inicio renovado",
    body: "La rutina de hoy, bien a la vista. Cuántas veces entrenaste este mes y tus récords recientes. Y cuando superas tu mejor marca, la app lo celebra contigo.",
    for: ["client"],
    link: { label: "Ir a Inicio", to: paths.clientDashboard },
  },
  {
    id: "2026-10-26-reports",
    date: "2026-10-26",
    title: "Tu progreso de un vistazo",
    body: "En tus reportes, cada ejercicio tiene una tarjeta con su tendencia y cuánto mejoraste desde el principio.",
    for: ["client"],
    link: { label: "Ver mis reportes", to: paths.clientReports },
  },
  {
    id: "2026-10-25-team",
    notForStaff: true,
    date: "2026-10-25",
    title: "Asistentes en tu equipo",
    body: "Invita asistentes, elige qué secciones ve cada uno (solo ver o también editar) y qué alumnos les asignas.",
    for: ["trainer"],
    link: { label: "Ir a Equipo", to: paths.trainerTeam },
  },
  {
    id: "2026-10-25-search",
    date: "2026-10-25",
    title: "Busca escribiendo en las listas",
    body: "En las listas de clientes, ejercicios, programas y plantillas ahora puedes escribir para buscar, sin importar tildes ni mayúsculas.",
    for: ["trainer"],
  },
];

export function changelogFor(role: string | undefined): ChangelogEntry[] {
  if (role === "client") return CHANGELOG.filter((e) => e.for.includes("client"));
  if (role === "trainer") return CHANGELOG.filter((e) => e.for.includes("trainer"));
  if (role === "staff") return CHANGELOG.filter((e) => e.for.includes("trainer") && !e.notForStaff);
  return [];
}
