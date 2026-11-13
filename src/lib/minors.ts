/** Alumnos menores de edad (part4k_migration.sql). En Bolivia, la mayoría de edad es a los 18. */
export const ADULT_AGE = 18;

export function ageFrom(birthDate: string | null | undefined, at = new Date()): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate.slice(0, 10) + "T12:00:00");
  if (Number.isNaN(b.getTime())) return null;
  let age = at.getFullYear() - b.getFullYear();
  const m = at.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < b.getDate())) age--;
  return age;
}

export const isMinor = (birthDate: string | null | undefined) => {
  const a = ageFrom(birthDate);
  return a != null && a < ADULT_AGE;
};

export interface Guardian {
  name: string;
  ci: string;
  relationship: string;
  phone: string;
  /** Correo del tutor (opcional). */
  email?: string;
  /** CI del alumno o alumna, si tiene (lo pide la autorización). */
  student_ci?: string;
}

/** Quién presta el servicio (encabezado de la autorización revisada por el abogado). */
export const LEGAL_PROVIDER = {
  name: "Mario Ernesto Rodas Arce",
  nit: "en trámite",
  address: "El Rincón de la Hacienda # 18 Norte, Santa Cruz de la Sierra",
  email: "yoguirodasa@gmail.com",
  termsUrl: "https://fuerzala.netlify.app/terminos",
  privacyUrl: "https://fuerzala.netlify.app/privacidad",
  servers: "Supabase: Estados Unidos, Virginia del Norte; Netlify: Estados Unidos y red global de servidores",
};

export const GUARDIAN_RELATIONSHIPS = ["Madre", "Padre", "Tutor o tutora legal"];
