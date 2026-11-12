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
}

export const GUARDIAN_RELATIONSHIPS = ["Madre", "Padre", "Tutor o tutora legal"];
