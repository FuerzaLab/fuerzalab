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
