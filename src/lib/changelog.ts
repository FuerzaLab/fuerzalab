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
    id: "2026-11-05-rest-sound",
    date: "2026-11-05",
    title: "El descanso ahora suena al terminar",
    body: "Cuando termina el descanso entre series, la app suena (y vibra en los celulares Android), con un aviso suave en los últimos 3 segundos. Si prefieres silencio, tócale la campanita 🔔 del cronómetro.",
    for: ["trainer", "client"],
  },
  {
    id: "2026-11-05-room-group",
    date: "2026-11-05",
    title: "Sala: clases grupales con la misma rutina",
    body: "Al abrir una sala, elige \"Misma rutina para todos\": tomas una rutina de tus Plantillas o la de uno de tus alumnos, y se la asigna a todos para hoy. Cada uno registra sus propias cargas, arrancando con las que usó la última vez, y le queda en su historial.",
    for: ["trainer"],
    link: { label: "Abrir una sala", to: paths.trainerRoom },
  },
  {
    id: "2026-11-05-room",
    date: "2026-11-05",
    title: "Sala: varios alumnos a la vez",
    body: "En \"Entrenar con cliente\" → \"Abrir una sala\", eliges a los alumnos que están contigo y los ves a todos en una sola pantalla, cada uno con su rutina de hoy: su serie actual con la carga lista, su propio descanso y su bienestar. Al terminar, cada uno tiene su sesión y sus récords como si hubiera entrenado solo contigo.",
    for: ["trainer"],
    link: { label: "Abrir una sala", to: paths.trainerRoom },
  },
  {
    id: "2026-11-05-photo-compare",
    date: "2026-11-05",
    title: "Compara tus fotos: antes y después",
    body: "En Fotos y en Reportes eliges qué fecha comparar con cuál, y las fotos se ven lado a lado por ángulo: frente con frente, perfil con perfil. Arriba ves cuántos días pasaron y, si hubo evaluaciones esos días, cuánto cambiaron tu peso y tu cintura.",
    for: ["trainer", "client"],
  },
  {
    id: "2026-11-04-preview-confirm",
    date: "2026-11-04",
    title: "Mira tu rutina antes de empezar",
    body: "Al tocar \"Entrenar ahora\" ves primero todos los ejercicios del día —series, repeticiones, carga, descanso y el video de cada uno— sin empezar nada. Cuando estés listo, \"Empezar entrenamiento\" te pide confirmar, así no empiezas una sesión sin querer.",
    for: ["client"],
    link: { label: "Ir a mi rutina", to: paths.clientRoutine },
  },
  {
    id: "2026-11-04-feed-joined-intake",
    date: "2026-11-04",
    title: "Te avisamos cuando un alumno nuevo se suma",
    body: "En tus Novedades aparece cuando un alumno acepta tu invitación y crea su cuenta, y cuando completa su formulario de ingreso, para que lo revises y lo apruebes. Si respondió «Sí» a alguna pregunta del PAR-Q+, el aviso aparece en rojo.",
    for: ["trainer"],
    link: { label: "Ir a Inicio", to: paths.trainerDashboard },
  },
  {
    id: "2026-11-04-fixed-routines",
    date: "2026-11-04",
    title: "Rutinas fijas: sin planificar por semanas",
    body: "Si no planificas por etapas, elige \"Rutinas fijas\" al armar las rutinas de un alumno: armas los días (Día A, B, C…) y se repiten cada semana, sin semanas ni bloques. Lo que cambies aplica desde la próxima vez, y lo ya entrenado queda en el historial. Además, cada serie le aparece al alumno con la carga que hizo la última vez.",
    for: ["trainer"],
    link: { label: "Ir al Constructor", to: paths.trainerBuilder },
  },
  {
    id: "2026-11-03-done-routines-locked",
    date: "2026-11-03",
    title: "Las rutinas ya realizadas quedan como historial",
    body: "Cuando un alumno termina una rutina, en el Constructor aparece con un 🔒 y queda en solo lectura: no se le pueden cambiar ni quitar ejercicios, ni eliminarla, para no perder su registro. Para cambiarla, duplícala o cópiala a la semana siguiente. Además, ahora puedes arrastrar las rutinas de la semana para cambiarlas de lugar.",
    for: ["trainer"],
    link: { label: "Ir al Constructor", to: paths.trainerBuilder },
  },
  {
    id: "2026-11-03-session-summary",
    date: "2026-11-03",
    title: "Resumen al terminar cada sesión",
    body: "Al terminar de entrenar ves cuánto duró la sesión, cuántas series y repeticiones hiciste, cuánto levantaste en total y cómo te fue comparado con la última vez. Si batiste un récord, se celebra ahí mismo.",
    for: ["trainer", "client"],
  },
  {
    id: "2026-11-03-whatsapp",
    date: "2026-11-03",
    title: "WhatsApp con el mensaje ya escrito",
    body: "Botones para mandar por WhatsApp la invitación de un alumno, el recordatorio de un pago vencido o por vencer, un mensaje a quien dejó de entrenar (desde Novedades) y un resumen de su progreso (desde Reportes). Se abre WhatsApp con el texto listo: solo tocas Enviar.",
    for: ["trainer"],
  },
  {
    id: "2026-11-03-bulk-invite",
    date: "2026-11-03",
    title: "Invita a varios alumnos de una vez",
    body: "En Clientes, pega una lista (nombre, WhatsApp y correo) o sube un Excel: se crean todos con su invitación, y te queda un botón de WhatsApp por persona para mandársela.",
    for: ["trainer"],
    notForStaff: true,
    link: { label: "Ir a Clientes", to: paths.trainerClients },
  },
  {
    id: "2026-11-03-starter-templates",
    date: "2026-11-03",
    title: "Rutinas de ejemplo listas para usar",
    body: "En Plantillas puedes agregar con un toque 4 rutinas armadas (por ejemplo, fuerza para principiantes en 3 días) para aplicarlas a un alumno y ajustarlas, en vez de empezar de cero.",
    for: ["trainer"],
    link: { label: "Ir a Plantillas", to: paths.trainerTemplates },
  },
  {
    id: "2026-11-03-search-drag",
    date: "2026-11-03",
    title: "Buscador general y reordenar arrastrando",
    body: "Con Ctrl + K (o el botón Buscar de arriba) saltas a la ficha de un alumno o a cualquier sección escribiendo su nombre. En el Constructor, en la computadora, reordenas los ejercicios arrastrándolos desde el ícono ⋮⋮. Y las Sugerencias ahora aparecen en tus Novedades, todo en un solo lugar.",
    for: ["trainer"],
  },
  {
    id: "2026-11-02-import-create-exercises",
    date: "2026-11-02",
    title: "Crea ejercicios nuevos sin salir del Constructor",
    body: "Si el ejercicio que buscas no está en tu biblioteca, créalo ahí mismo y se añade a la sesión en un paso. Y al importar una rutina desde Excel o Word, puedes crear los que falten —uno por uno o todos de una vez—. Después los completas en Ejercicios.",
    for: ["trainer"],
    link: { label: "Ir al Constructor", to: paths.trainerBuilder },
  },
  {
    id: "2026-11-02-seats",
    date: "2026-11-02",
    title: "Cupos de alumnos en tu plan",
    body: "Si tu plan cobra por alumno, en Configuración → Mi plan ves tus cupos pagados del período. Un alumno nuevo por encima de tus cupos puede registrarse y llenar su formulario, y ve su rutina apenas se paga su cupo (proporcional a los días que faltan del período).",
    for: ["trainer"],
    notForStaff: true,
    link: { label: "Ver mi plan", to: paths.trainerSettings },
  },
  {
    id: "2026-11-02-my-plan",
    date: "2026-11-02",
    title: "Tu plan de FuerzaLab, a la vista",
    body: "En Configuración → \"Mi plan de FuerzaLab\" ves tu plan, cuántos alumnos activos tienes, cuánto sería tu próximo período y cuándo vence. Además, la app te avisa unos días antes de cada vencimiento y si superas el tope de alumnos de tu plan.",
    for: ["trainer"],
    notForStaff: true,
    link: { label: "Ver mi plan", to: paths.trainerSettings },
  },
  {
    id: "2026-11-01-video-links",
    date: "2026-11-01",
    title: "Videos de YouTube o Vimeo en tus ejercicios",
    body: "Pega el enlace de un video en cualquier ejercicio de tu biblioteca: tus alumnos lo ven dentro de FuerzaLab, sin salir de la app. Si un video deja de estar disponible, te avisamos en Novedades para que pongas otro, y con \"Revisar videos\" compruebas todos de una vez.",
    for: ["trainer"],
    link: { label: "Ir a Ejercicios", to: paths.trainerExercises },
  },
  {
    id: "2026-11-01-video-links-client",
    date: "2026-11-01",
    title: "Mira cómo se hace cada ejercicio",
    body: "En tu rutina, toca \"Ver cómo se hace\" para ver el video del ejercicio sin salir de la app.",
    for: ["client"],
    link: { label: "Ir a mi rutina", to: paths.clientRoutine },
  },
  {
    id: "2026-10-29-template-exercises",
    date: "2026-10-29",
    title: "Mira los ejercicios de tus plantillas",
    body: "En Plantillas, \"Ver ejercicios\" muestra qué tiene cada día —series, repeticiones, carga, RIR y descanso, con las biseries marcadas A1, A2— antes de usarla con un alumno. En los programas completos, eliges la semana.",
    for: ["trainer"],
    link: { label: "Ir a Plantillas", to: paths.trainerTemplates },
  },
  {
    id: "2026-10-29-payment-alerts",
    date: "2026-10-29",
    title: "Avisos de pagos vencidos y por vencer",
    body: "En Pagos, cada pago pendiente dice si está vencido o cuántos días le faltan, con el botón \"Marcar pagado\" a la vista. En tus Novedades te avisa de los vencidos y de los que vencen en los próximos 3 días. Y al marcar como pagado un plan mensual o trimestral, se crea solo el pago del próximo período.",
    for: ["trainer"],
    link: { label: "Ir a Pagos", to: paths.trainerPayments },
  },
  {
    id: "2026-10-28-superset-round",
    date: "2026-10-28",
    title: "Biseries y series gigantes: un solo botón por ronda",
    body: "Haces un ejercicio tras otro y, al terminar la ronda, tocas \"Marcar ronda como realizada\": se marcan todos juntos y el descanso empieza recién ahí, una sola vez.",
    for: ["trainer", "client"],
  },
  {
    id: "2026-10-28-mobile-builder",
    date: "2026-10-28",
    title: "Arma rutinas y carga evaluaciones desde el celular",
    body: "En el celular, el Constructor de rutinas muestra cada ejercicio como una ficha con sus campos grandes, sin tener que deslizar la pantalla de costado. En Evaluaciones, los botones son más fáciles de tocar y se abre el teclado numérico al cargar medidas.",
    for: ["trainer"],
    link: { label: "Ir al Constructor", to: paths.trainerBuilder },
  },
  {
    id: "2026-10-28-menu-sections",
    date: "2026-10-28",
    title: "Elige qué secciones ves en tu menú",
    body: "En Configuración → \"Secciones que uso\" prendes o apagas las secciones de \"Más herramientas\": por ejemplo, oculta Pagos si no cobras por la app, o Equipo si trabajas solo. No se borra nada. Además, las secciones vacías ahora te explican qué hacer para empezar.",
    for: ["trainer"],
    notForStaff: true,
    link: { label: "Ir a Configuración", to: paths.trainerSettings },
  },
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
