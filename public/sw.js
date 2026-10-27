/*
 * Service worker mínimo de FuerzaLab.
 *
 * Existe para que la app se pueda instalar como ícono en celulares con
 * Android o Chrome antiguos, que solo lo permiten si la página tiene un
 * service worker que atiende las peticiones (los Chrome nuevos ya no lo
 * exigen).
 *
 * A propósito NO guarda nada en caché: todo se pide siempre a la red, así
 * nadie se queda con una versión vieja de la app después de una
 * publicación. Lo único que agrega es un aviso legible cuando el celular
 * no tiene conexión, en lugar de la pantalla de error del navegador.
 */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const OFFLINE_HTML = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FuerzaLab</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F1F3F0;font-family:system-ui,sans-serif;color:#14202B;text-align:center;padding:24px}
img{width:72px;height:72px;border-radius:16px}h1{font-size:22px;margin:16px 0 6px}p{color:#5E6A73;margin:0 0 18px}button{background:#1E3FA8;color:#fff;border:0;border-radius:9px;padding:12px 20px;font-size:16px;font-weight:700}</style></head>
<body><div><img src="/icon-192.png" alt=""><h1>Sin conexión</h1><p>Revisa tu internet y vuelve a intentar.</p><button onclick="location.reload()">Reintentar</button></div></body></html>`;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Solo las páginas de la propia app; todo lo demás (Supabase, archivos,
  // otros sitios) lo maneja el navegador como siempre.
  if (req.mode !== "navigate" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).catch(() => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })),
  );
});
