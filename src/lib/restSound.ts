/**
 * Sonido (y vibración) del cronómetro de descanso.
 * Se genera con el propio navegador (Web Audio), sin archivos de audio.
 *  - 3 "bips" cortos al terminar el descanso, y una vibración en los
 *    celulares que la permiten (Android; iPhone no deja vibrar desde la web).
 *  - Un "tic" suave en los últimos 3 segundos.
 * Se puede apagar (🔔 / 🔕); la preferencia queda guardada en el dispositivo.
 *
 * Los navegadores solo dejan sonar después de que la persona tocó algo: por
 * eso se "despierta" el audio al marcar una serie (unlockRestSound).
 */
const KEY = "fl-rest-sound";
let ctx: AudioContext | null = null;

export function restSoundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setRestSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* sin almacenamiento: queda prendido */
  }
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/** Llamar dentro de un toque (por ejemplo, al marcar la serie) para que después pueda sonar. */
export function unlockRestSound(): void {
  const a = audio();
  if (a && a.state === "suspended") a.resume().catch(() => {});
}

function beep(at: number, freq: number, dur: number, vol: number) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, a.currentTime + at);
  gain.gain.exponentialRampToValueAtTime(vol, a.currentTime + at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(a.currentTime + at);
  osc.stop(a.currentTime + at + dur + 0.02);
}

/** Fin del descanso: tres bips y vibración. */
export function playRestEnd(): void {
  if (!restSoundEnabled()) return;
  const a = audio();
  if (a?.state === "suspended") a.resume().catch(() => {});
  beep(0, 880, 0.16, 0.35);
  beep(0.22, 880, 0.16, 0.35);
  beep(0.44, 1175, 0.32, 0.4);
  try {
    navigator.vibrate?.([200, 100, 200, 100, 400]);
  } catch {
    /* sin vibración */
  }
}

/** Últimos segundos del descanso: un tic suave. */
export function playRestTick(): void {
  if (!restSoundEnabled()) return;
  beep(0, 660, 0.07, 0.15);
}
