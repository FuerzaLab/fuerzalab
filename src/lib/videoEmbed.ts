/**
 * Videos de YouTube o Vimeo insertados en FuerzaLab (no descargados): se
 * reproducen dentro de la app con el reproductor oficial de cada sitio.
 */
export type VideoProvider = "youtube" | "vimeo";
export interface ParsedVideo {
  provider: VideoProvider;
  id: string;
}

/** Reconoce youtube.com/watch?v=, youtu.be/, /shorts/, /embed/, /live/ y vimeo.com/123. */
export function parseVideoUrl(raw: string | null | undefined): ParsedVideo | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return /^[\w-]{11}$/.test(id) ? { provider: "youtube", id } : null;
  }
  if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    const v = url.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return { provider: "youtube", id: v };
    const m = url.pathname.match(/\/(?:shorts|embed|live|v)\/([\w-]{11})/);
    return m ? { provider: "youtube", id: m[1] } : null;
  }
  if (host.endsWith("vimeo.com")) {
    const m = url.pathname.match(/\/(?:video\/)?(\d{6,})/);
    return m ? { provider: "vimeo", id: m[1] } : null;
  }
  return null;
}

/**
 * ¿El video sigue disponible? (para "Revisar videos").
 * - YouTube: si el video fue borrado o pasó a privado, su miniatura deja de
 *   existir. (Si el dueño solo desactivó la inserción, esto no lo detecta:
 *   lo detecta el reproductor cuando alguien intenta verlo.)
 * - Vimeo: su servicio de datos públicos responde error si no está disponible.
 */
export async function checkVideoAvailable(v: ParsedVideo): Promise<{ ok: boolean; reason?: string }> {
  if (v.provider === "vimeo") {
    try {
      const r = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${v.id}`)}`);
      return r.ok ? { ok: true } : { ok: false, reason: r.status === 404 ? "El video ya no existe en Vimeo" : "El video no permite verse fuera de Vimeo" };
    } catch {
      return { ok: true }; // sin conexión: no se marca como roto
    }
  }
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve({ ok: true }), 8000);
    img.onload = () => {
      clearTimeout(timer);
      // YouTube devuelve una imagen gris de 120×90 cuando el video no existe.
      resolve(img.naturalWidth <= 120 ? { ok: false, reason: "El video ya no existe en YouTube" } : { ok: true });
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve({ ok: false, reason: "El video ya no existe en YouTube o es privado" });
    };
    img.src = `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg?${Date.now()}`;
  });
}

/** Mensaje claro según el error del reproductor de YouTube. */
export function youtubeErrorReason(code: number): string | null {
  if (code === 100) return "El video ya no existe en YouTube o es privado";
  if (code === 101 || code === 150) return "El dueño del video no permite verlo fuera de YouTube";
  if (code === 2) return "El enlace del video no es válido";
  return null; // otros errores (conexión, etc.): no se marca como roto
}
