import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { changelogFor, type ChangelogEntry } from "../lib/changelog";

/**
 * Qué mejoras de "Qué hay de nuevo" todavía no vio esta persona. Se guarda
 * en el dispositivo (localStorage) la lista de las que ya vio.
 *
 * La primera vez que alguien entra (sin nada guardado), cuenta como nuevas
 * solo las de los últimos 14 días: así un usuario recién llegado no ve un
 * aviso por cada mejora de la historia de la app.
 */
const EVENT = "fl-whatsnew-seen";
const keyFor = (uid: string) => `fl-whatsnew-seen-${uid}`;

function readSeen(uid: string, entries: ChangelogEntry[]): Set<string> {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* sin almacenamiento o dato roto: se recalcula */
  }
  const cutoff = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  return new Set(entries.filter((e) => e.date < cutoff).map((e) => e.id));
}

export function useWhatsNew() {
  const { profile } = useAuth();
  const entries = changelogFor(profile?.role);
  const uid = profile?.id ?? "";
  const [seen, setSeen] = useState<Set<string>>(() => (uid ? readSeen(uid, entries) : new Set()));

  useEffect(() => {
    if (!uid) return;
    setSeen(readSeen(uid, entries));
    const on = () => setSeen(readSeen(uid, entries));
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const unseen = entries.filter((e) => !seen.has(e.id));

  /** Marca todo como visto (al abrir la sección). Avisa al menú para que se apague el puntito. */
  const markAllSeen = () => {
    if (!uid) return;
    try {
      localStorage.setItem(keyFor(uid), JSON.stringify(entries.map((e) => e.id)));
    } catch {
      /* nada */
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return { entries, unseenIds: new Set(unseen.map((e) => e.id)), unseenCount: unseen.length, markAllSeen };
}
