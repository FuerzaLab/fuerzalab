export type Role = "super_admin" | "trainer" | "staff" | "client";

export interface Profile {
  id: string;
  organization_id: string | null;
  role: Role;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_path: string | null;
  locale: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** Secciones que el entrenador ocultó de su menú (part3w). null = no eligió todavía. */
  menu_hidden?: string[] | null;
}

/** Módulos de permisos de staff (mismos nombres que usa la base de datos). */
export type StaffModule =
  | "clients"
  | "health"
  | "assessments"
  | "exercises"
  | "programs"
  | "logs"
  | "messages"
  | "payments"
  | "reports"
  | "files"
  | "analytics";

export type StaffLevel = "read" | "write";

export type StaffPermissions = Partial<Record<StaffModule, StaffLevel>>;

/** A qué entrenador asiste esta cuenta de staff, y con qué permisos. */
export type StaffClientScope = "all" | "assigned";

export interface StaffAccess {
  trainerId: string;
  trainerName: string;
  permissions: StaffPermissions;
  /** "all": ve a todos los clientes del entrenador; "assigned": solo los que le asignó. */
  clientScope: StaffClientScope;
}
