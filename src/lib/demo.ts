/**
 * Cuenta demo de FuerzaLab. Se configura con dos variables de entorno
 * (en Netlify y en el .env local): VITE_DEMO_EMAIL y VITE_DEMO_PASSWORD.
 * Si no están, no hay demo: el botón "Probar la demo" no aparece y la app
 * funciona igual que siempre.
 */
export const DEMO_EMAIL = (import.meta.env.VITE_DEMO_EMAIL ?? "").trim().toLowerCase();
export const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD ?? "";
export const DEMO_ENABLED = !!DEMO_EMAIL && !!DEMO_PASSWORD;

export function isDemoAccount(email: string | null | undefined): boolean {
  return DEMO_ENABLED && !!email && email.trim().toLowerCase() === DEMO_EMAIL;
}

/**
 * Demo de ESTUDIO (opcional): un estudio de ejemplo con varios entrenadores,
 * para mostrarle a un dueño "Tu estudio" funcionando. Variables de entorno:
 *  - VITE_DEMO_STUDIO_EMAIL / VITE_DEMO_STUDIO_PASSWORD: la cuenta del DUEÑO
 *    (entrenador marcado como dueño de esa organización).
 *  - VITE_DEMO_STUDIO_TEAM: los otros entrenadores de la demo, separados por
 *    coma, cada uno "correo:contraseña". Al entrar el dueño, la app inicia
 *    sesión aparte con cada uno y les carga sus datos de ejemplo.
 * Son cuentas de demostración: sus contraseñas quedan en la app publicada,
 * igual que la de la demo de un entrenador. No uses cuentas reales.
 */
export const DEMO_STUDIO_EMAIL = (import.meta.env.VITE_DEMO_STUDIO_EMAIL ?? "").trim().toLowerCase();
export const DEMO_STUDIO_PASSWORD = import.meta.env.VITE_DEMO_STUDIO_PASSWORD ?? "";
export const DEMO_STUDIO_ENABLED = !!DEMO_STUDIO_EMAIL && !!DEMO_STUDIO_PASSWORD;
export const DEMO_STUDIO_TEAM: { email: string; password: string }[] = (import.meta.env.VITE_DEMO_STUDIO_TEAM ?? "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean)
  .map((x) => {
    const i = x.indexOf(":");
    return { email: x.slice(0, i).trim().toLowerCase(), password: x.slice(i + 1) };
  })
  .filter((x) => x.email && x.password);

export function isDemoStudioOwner(email: string | null | undefined): boolean {
  return DEMO_STUDIO_ENABLED && !!email && email.trim().toLowerCase() === DEMO_STUDIO_EMAIL;
}

/**
 * Demo como ALUMNO (opcional): una cuenta de alumno de la organización demo,
 * que se conecta cada vez con "Valeria Rojas" (alumna de ejemplo).
 * VITE_DEMO_CLIENT_EMAIL / VITE_DEMO_CLIENT_PASSWORD. Requiere la demo del
 * entrenador (VITE_DEMO_EMAIL / VITE_DEMO_PASSWORD) y part4h_migration.sql.
 */
export const DEMO_CLIENT_EMAIL = (import.meta.env.VITE_DEMO_CLIENT_EMAIL ?? "").trim().toLowerCase();
export const DEMO_CLIENT_PASSWORD = import.meta.env.VITE_DEMO_CLIENT_PASSWORD ?? "";
export const DEMO_CLIENT_ENABLED = DEMO_ENABLED && !!DEMO_CLIENT_EMAIL && !!DEMO_CLIENT_PASSWORD;

export function isDemoClient(email: string | null | undefined): boolean {
  return DEMO_CLIENT_ENABLED && !!email && email.trim().toLowerCase() === DEMO_CLIENT_EMAIL;
}

/** Cualquiera de las cuentas de demostración (entrenador, estudio o alumno). */
export function isAnyDemo(email: string | null | undefined): boolean {
  return isDemoAccount(email) || isDemoStudioOwner(email) || isDemoClient(email);
}
