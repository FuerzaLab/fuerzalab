import type { StaffModule, StaffLevel, StaffPermissions } from "../types/auth";
import { paths } from "../routes/paths";

/**
 * Cómo se muestran los módulos de permisos al entrenador. "reports" y
 * "analytics" van juntos en una sola fila (Reportes y Sugerencias leen
 * los dos), así que la fila escribe ambas claves a la vez.
 */
export interface ModuleRow {
  key: StaffModule;
  also?: StaffModule[];
  label: string;
  hint: string;
}

export const MODULE_ROWS: ModuleRow[] = [
  { key: "clients", label: "Clientes", hint: "Lista y ficha de cada cliente, notas privadas" },
  { key: "health", label: "Salud y Bienestar", hint: "Formulario de salud, cuestionario de Bienestar" },
  { key: "assessments", label: "Evaluaciones", hint: "Medidas, pliegues, pruebas de fuerza…" },
  { key: "exercises", label: "Ejercicios", hint: "Tu biblioteca de ejercicios" },
  { key: "programs", label: "Planificación y rutinas", hint: "Planificación, Constructor, Plantillas y Agenda" },
  { key: "logs", label: "Entrenamientos registrados", hint: "Entrenar con un cliente, series cargadas" },
  { key: "files", label: "Fotos de progreso", hint: "Fotos del cliente" },
  { key: "messages", label: "Mensajes", hint: "Conversaciones con tus clientes" },
  { key: "analytics", also: ["reports"], label: "Reportes y Sugerencias", hint: "Gráficos de progreso y alertas" },
  { key: "payments", label: "Pagos", hint: "Planes y cobros de tus clientes" },
];

export const LEVEL_LABEL: Record<"none" | StaffLevel, string> = {
  none: "Sin acceso",
  read: "Solo ver",
  write: "Ver y editar",
};

export function levelOf(perms: StaffPermissions, key: StaffModule): "none" | StaffLevel {
  return perms[key] ?? "none";
}

export function setLevel(perms: StaffPermissions, row: ModuleRow, level: "none" | StaffLevel): StaffPermissions {
  const next: StaffPermissions = { ...perms };
  for (const k of [row.key, ...(row.also ?? [])]) {
    if (level === "none") delete next[k];
    else next[k] = level;
  }
  return next;
}

/** Combinaciones rápidas para no tener que tocar fila por fila. */
export const PRESETS: { name: string; description: string; permissions: StaffPermissions }[] = [
  {
    name: "Asistente de sala",
    description: "Entrena con tus clientes, carga evaluaciones y fotos, y escribe mensajes. Ve las rutinas, no las cambia. Sin pagos.",
    permissions: {
      clients: "read",
      health: "read",
      assessments: "write",
      exercises: "read",
      programs: "read",
      logs: "write",
      files: "write",
      messages: "write",
      analytics: "read",
      reports: "read",
    },
  },
  {
    name: "Administrativo",
    description: "Maneja clientes, mensajes y pagos. Ve la agenda y las rutinas sin poder cambiarlas. No ve la salud.",
    permissions: {
      clients: "write",
      programs: "read",
      messages: "write",
      payments: "write",
    },
  },
  {
    name: "Coentrenador",
    description: "Puede hacer todo lo que haces tú con tus clientes, salvo ver los pagos.",
    permissions: {
      clients: "write",
      health: "write",
      assessments: "write",
      exercises: "write",
      programs: "write",
      logs: "write",
      files: "write",
      messages: "write",
      analytics: "read",
      reports: "read",
    },
  },
];

/**
 * Qué permiso necesita el staff para cada pantalla. Una pantalla que no
 * figura acá (Inicio, Configuración) la ve siempre. "Equipo" no figura
 * porque es solo del entrenador (lo protege la ruta, no este mapa).
 */
export const ROUTE_MODULE: Record<string, { module: StaffModule; level: StaffLevel; extra?: StaffModule }> = {
  [paths.trainerRunSession]: { module: "logs", level: "write", extra: "programs" },
  [paths.trainerAgenda]: { module: "programs", level: "read" },
  [paths.trainerClients]: { module: "clients", level: "read" },
  [paths.trainerMessages]: { module: "messages", level: "read" },
  [paths.trainerExercises]: { module: "exercises", level: "read" },
  [paths.trainerBuilder]: { module: "programs", level: "read" },
  [paths.trainerPrograms]: { module: "programs", level: "read" },
  [paths.trainerTemplates]: { module: "programs", level: "read" },
  [paths.trainerAssessments]: { module: "assessments", level: "read" },
  [paths.trainerWellness]: { module: "health", level: "read" },
  [paths.trainerProgressPhotos]: { module: "files", level: "read" },
  [paths.trainerReports]: { module: "analytics", level: "read" },
  [paths.trainerSuggestions]: { module: "analytics", level: "read" },
  [paths.trainerPayments]: { module: "payments", level: "read" },
};

/** La ficha de un cliente (/t/clientes/:id) cuenta como "Clientes". */
export function routeRequirement(pathname: string) {
  if (ROUTE_MODULE[pathname]) return ROUTE_MODULE[pathname];
  if (pathname.startsWith(paths.trainerClients + "/")) return ROUTE_MODULE[paths.trainerClients];
  return null;
}

export function hasLevel(perms: StaffPermissions, module: StaffModule, level: StaffLevel): boolean {
  const have = perms[module];
  if (!have) return false;
  return level === "read" ? true : have === "write";
}

export function summarizePermissions(perms: StaffPermissions): string {
  const parts = MODULE_ROWS.filter((r) => perms[r.key]).map(
    (r) => `${r.label}${perms[r.key] === "read" ? " (ver)" : ""}`,
  );
  return parts.length ? parts.join(" · ") : "Sin acceso a ninguna sección";
}
