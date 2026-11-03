/**
 * Enlaces de WhatsApp con el mensaje ya escrito (wa.me). No necesitan
 * servidor ni cuenta de WhatsApp Business: abren WhatsApp en el celular o
 * en WhatsApp Web, y el entrenador solo toca "Enviar".
 *
 * Teléfonos de Bolivia: si se guardó sin código de país (8 dígitos,
 * empieza con 6 o 7), se le agrega el 591.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 8 && /^[67]/.test(d)) d = "591" + d;
  return d.length >= 8 ? d : null;
}

/** Enlace a WhatsApp: con teléfono abre el chat de esa persona; sin teléfono, deja elegir el contacto. */
export function whatsappLink(phone: string | null | undefined, text: string): string {
  const p = normalizePhone(phone);
  return `https://wa.me/${p ?? ""}?text=${encodeURIComponent(text)}`;
}

export const appUrl = () => (typeof window !== "undefined" ? window.location.origin : "");

/** Primer nombre, para que el mensaje suene natural. */
export const firstName = (full: string | null | undefined) => (full ?? "").trim().split(/\s+/)[0] || "";

/** Mensaje de invitación a FuerzaLab, con el enlace de registro. */
export function inviteMessage(fullName: string, link: string): string {
  const n = firstName(fullName);
  return `Hola${n ? ` ${n}` : ""}! Te invito a FuerzaLab, la app donde vas a ver tu rutina, cargar tus entrenamientos y seguir tu progreso. Regístrate desde este enlace: ${link}`;
}
