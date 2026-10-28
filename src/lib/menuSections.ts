import { paths } from "../routes/paths";
import type { Profile } from "../types/auth";

/**
 * "Secciones que uso" (Configuración): qué secciones de "Más herramientas"
 * aparecen en el menú de cada entrenador. Las de todos los días (Inicio,
 * Entrenar con cliente, Agenda, Clientes, Mensajes, Constructor) y
 * Configuración / Qué hay de nuevo / Tu estudio no se pueden ocultar.
 *
 * Ocultar una sección solo la saca del menú: no borra datos ni bloquea el
 * acceso (por ejemplo, un enlace desde Novedades sigue funcionando).
 */
export const OPTIONAL_SECTIONS: { to: string; label: string; hint: string }[] = [
  { to: paths.trainerExercises, label: "Ejercicios", hint: "Tu biblioteca de ejercicios" },
  { to: paths.trainerPrograms, label: "Planificación", hint: "El plan de cada alumno por semanas y bloques" },
  { to: paths.trainerTemplates, label: "Plantillas", hint: "Programas y rutinas guardados para reutilizar" },
  { to: paths.trainerAssessments, label: "Evaluaciones", hint: "Medidas, pliegues, fuerza, movilidad" },
  { to: paths.trainerWellness, label: "Bienestar", hint: "Cómo llegan tus alumnos a entrenar" },
  { to: paths.trainerProgressPhotos, label: "Fotos", hint: "Fotos de progreso de tus alumnos" },
  { to: paths.trainerReports, label: "Reportes", hint: "La evolución de cada alumno en gráficos" },
  { to: paths.trainerSuggestions, label: "Sugerencias", hint: "Recomendaciones calculadas por la app" },
  { to: paths.trainerPayments, label: "Pagos", hint: "Planes y cobros de tus alumnos" },
  { to: paths.trainerTeam, label: "Equipo", hint: "Asistentes que trabajan contigo" },
];

/**
 * Para los entrenadores que se registren desde que existe esta opción, el
 * menú arranca con lo básico; los que ya usaban la app ven todo, como antes.
 * Cualquiera lo cambia cuando quiera en Configuración.
 */
const STARTER_HIDDEN = [paths.trainerTemplates, paths.trainerProgressPhotos, paths.trainerSuggestions, paths.trainerPayments, paths.trainerTeam];
const STARTER_SINCE = "2026-10-29";

export function hiddenSections(profile: Profile | null | undefined): string[] {
  if (!profile || profile.role !== "trainer") return [];
  if (Array.isArray(profile.menu_hidden)) return profile.menu_hidden;
  return profile.created_at >= STARTER_SINCE ? STARTER_HIDDEN : [];
}
