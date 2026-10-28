import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";

/**
 * Tarjeta "Instala FuerzaLab en tu celular", para el alumno. Solo aparece
 * en el celular, si la app todavía no está instalada y si no la cerró antes.
 *
 * - Android/Chrome: el navegador ofrece instalarla (evento
 *   beforeinstallprompt); el botón abre ese diálogo directamente.
 * - iPhone/Safari: no existe ese evento, así que se explica el paso a mano
 *   (Compartir → "Agregar a inicio").
 */

// El evento llega una sola vez, al cargar la página: se guarda acá para
// poder usarlo cuando el alumno toque el botón, aunque sea más tarde.
let deferredPrompt: any = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
  });
}

const DISMISS_KEY = "fl-install-dismissed";

function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

function isMobile(): boolean {
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent) || window.matchMedia?.("(max-width: 760px)").matches;
}

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
/**
 * Samsung Internet (el navegador que viene en los Samsung) arma un
 * instalador desactualizado para las apps web, y Google Play Protect lo
 * bloquea con "Se bloqueó la app no segura… se diseñó para una versión
 * anterior de Android". No es un problema de FuerzaLab: desde Chrome se
 * instala sin ese aviso. Por eso, en Samsung Internet se recomienda Chrome.
 */
const isSamsungInternet = () => /SamsungBrowser/i.test(navigator.userAgent);
/** Enlace que abre esta misma página en Chrome (Android). */
const chromeIntentUrl = () =>
  `intent://${location.host}${location.pathname}${location.search}#Intent;scheme=https;package=com.android.chrome;end`;

export default function InstallAppCard() {
  const [visible, setVisible] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* sin almacenamiento: se muestra igual */
    }
    setVisible(!dismissed && isMobile() && !isStandalone());
    setCanPrompt(!!deferredPrompt);
    const onPrompt = () => setCanPrompt(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    const onInstalled = () => setVisible(false);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* nada */
    }
  };

  if (!visible) return null;

  return (
    <div className="panel" style={{ borderLeft: "4px solid var(--pri)" }}>
      <div className="bd" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Smartphone size={22} style={{ color: "var(--pri)", flex: "none", marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <b>Instala FuerzaLab en tu celular</b>
          {isSamsungInternet() ? (
            <>
              <p className="note" style={{ margin: "4px 0 10px" }}>
                Desde este navegador (Samsung Internet) el celular puede bloquear la instalación con un aviso de "app no
                segura": es un problema conocido de ese navegador, no de FuerzaLab. Ábrela en <b>Chrome</b> y, desde el
                menú (⋮), elige "Instalar app" o "Agregar a la pantalla principal".
              </p>
              <a className="btn" href={chromeIntentUrl()} style={{ textDecoration: "none" }}>
                Abrir en Chrome
              </a>
            </>
          ) : (
          <p className="note" style={{ margin: "4px 0 10px" }}>
            {canPrompt
              ? "Queda en tu pantalla de inicio con su ícono y se abre como una app, sin el navegador."
              : isIOS()
                ? "Toca el botón Compartir (el cuadrado con la flecha hacia arriba) y luego \u201cAgregar a inicio\u201d. Queda con su ícono, como una app."
                : "Abre el menú del navegador (los tres puntos ⋮) y elige \u201cInstalar app\u201d o \u201cAgregar a la pantalla principal\u201d. Si usas otro navegador y no aparece la opción, ábrela en Chrome."}
          </p>
          )}
          {canPrompt && !isSamsungInternet() && (
            <button
              className="btn"
              onClick={async () => {
                const p = deferredPrompt;
                if (!p) return;
                deferredPrompt = null;
                p.prompt();
                const choice = await p.userChoice.catch(() => null);
                if (choice?.outcome === "accepted") setVisible(false);
                setCanPrompt(false);
              }}
            >
              Instalar
            </button>
          )}
        </div>
        <button aria-label="Cerrar" onClick={dismiss} style={{ border: 0, background: "none", color: "var(--muted)", cursor: "pointer", padding: 2 }}>
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
