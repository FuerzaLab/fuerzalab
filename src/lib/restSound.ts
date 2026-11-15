/**
 * Alarma (y vibración) del cronómetro de descanso.
 * Se genera con el propio navegador (Web Audio), sin archivos de audio.
 *  - Al terminar el descanso suena la alarma elegida (5 opciones) y vibra
 *    en los celulares que lo permiten (Android; iPhone no deja vibrar desde la web).
 *  - Un "tic" en los últimos 3 segundos.
 *  - Volumen: normal, fuerte o muy fuerte. Pasa por un compresor para que
 *    se escuche más fuerte en el parlante del celular sin romperse.
 * Todo queda guardado en el dispositivo (prendido/apagado, sonido y volumen).
 *
 * Los navegadores solo dejan sonar después de que la persona tocó algo: por
 * eso se "despierta" el audio al marcar una serie (unlockRestSound).
 * En iPhone (iOS 17+) se pide sonar como reproducción de medios, así suena
 * aunque el celular esté en modo silencio.
 */
const KEY = "fl-rest-sound";
const KEY_CHOICE = "fl-rest-sound-choice";
const KEY_VOLUME = "fl-rest-sound-volume";

export type RestSoundChoice = "digital" | "boxing" | "whistle" | "horn" | "siren";
export type RestVolume = "normal" | "loud" | "max";

export const REST_SOUNDS: { id: RestSoundChoice; label: string; emoji: string }[] = [
  { id: "digital", label: "Digital (bip de gimnasio)", emoji: "⏱️" },
  { id: "boxing", label: "Campana de boxeo", emoji: "🔔" },
  { id: "whistle", label: "Silbato", emoji: "📣" },
  { id: "horn", label: "Bocina", emoji: "📯" },
  { id: "siren", label: "Sirena", emoji: "🚨" },
];

export const REST_VOLUMES: { id: RestVolume; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "loud", label: "Fuerte" },
  { id: "max", label: "Muy fuerte" },
];

const VOLUME_GAIN: Record<RestVolume, number> = { normal: 0.45, loud: 0.8, max: 1.25 };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* sin almacenamiento: vale solo por ahora */
  }
}

export function restSoundEnabled(): boolean {
  return read(KEY) !== "off";
}

export function setRestSoundEnabled(on: boolean): void {
  write(KEY, on ? "on" : "off");
}

export function getRestSoundChoice(): RestSoundChoice {
  const v = read(KEY_CHOICE);
  return REST_SOUNDS.some((s) => s.id === v) ? (v as RestSoundChoice) : "digital";
}

export function setRestSoundChoice(choice: RestSoundChoice): void {
  write(KEY_CHOICE, choice);
}

export function getRestVolume(): RestVolume {
  const v = read(KEY_VOLUME);
  return REST_VOLUMES.some((s) => s.id === v) ? (v as RestVolume) : "loud";
}

export function setRestVolume(volume: RestVolume): void {
  write(KEY_VOLUME, volume);
}

// --- Motor de audio ------------------------------------------------------

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    try {
      // iPhone (iOS 17+): sonar aunque el celular esté en silencio.
      const session = (navigator as any).audioSession;
      if (session && "type" in session) session.type = "playback";
    } catch {
      /* navegador sin audioSession */
    }
    ctx = new AC() as AudioContext;
    // Cadena: sonidos → volumen → compresor (sube lo bajo, frena los picos) → salida
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 6;
    comp.ratio.value = 12;
    comp.attack.value = 0.002;
    comp.release.value = 0.15;
    master = ctx.createGain();
    master.connect(comp).connect(ctx.destination);
  }
  return ctx;
}

function out(volume: RestVolume): { a: AudioContext; dest: GainNode } | null {
  const a = audio();
  if (!a || !master) return null;
  if (a.state === "suspended") a.resume().catch(() => {});
  master.gain.setValueAtTime(VOLUME_GAIN[volume], a.currentTime);
  return { a, dest: master };
}

/** Llamar dentro de un toque (por ejemplo, al marcar la serie) para que después pueda sonar. */
export function unlockRestSound(): void {
  const a = audio();
  if (!a) return;
  if (a.state === "suspended") a.resume().catch(() => {});
  // Un sonido mudo de un instante: algunos iPhone lo necesitan para "abrir" el audio.
  try {
    const buf = a.createBuffer(1, 1, 22050);
    const src = a.createBufferSource();
    src.buffer = buf;
    src.connect(a.destination);
    src.start(0);
  } catch {
    /* nada */
  }
}

/** Un tono con envolvente (ataque rápido, caída). */
function tone(
  o: { a: AudioContext; dest: GainNode },
  at: number,
  freq: number,
  dur: number,
  opts: { type?: OscillatorType; vol?: number; decay?: "flat" | "exp"; endFreq?: number; detune?: number } = {},
) {
  const { a, dest } = o;
  const t0 = a.currentTime + at;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = opts.type ?? "square";
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.endFreq) osc.frequency.linearRampToValueAtTime(opts.endFreq, t0 + dur);
  if (opts.detune) osc.detune.value = opts.detune;
  const vol = opts.vol ?? 0.5;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  if (opts.decay === "exp") {
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  } else {
    g.gain.setValueAtTime(vol, t0 + Math.max(0.01, dur - 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }
  osc.connect(g).connect(dest);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
  return osc;
}

/** Golpe de campana metálica: parciales inarmónicos que se apagan solos. */
function bell(o: { a: AudioContext; dest: GainNode }, at: number, base: number, dur: number) {
  const partials: [number, number][] = [
    [1, 0.6],
    [2.76, 0.35],
    [5.4, 0.22],
    [8.93, 0.12],
  ];
  for (const [ratio, vol] of partials) tone(o, at, base * ratio, dur / Math.sqrt(ratio), { type: "sine", vol, decay: "exp" });
  tone(o, at, base * 2, 0.04, { type: "square", vol: 0.25, decay: "exp" }); // el "clic" del golpe
}

const PATTERNS: Record<RestSoundChoice, (o: { a: AudioContext; dest: GainNode }) => void> = {
  // Bip-bip-bip-biiip, dos veces: el clásico reloj de gimnasio.
  digital: (o) => {
    for (const start of [0, 1.1]) {
      tone(o, start, 1000, 0.13);
      tone(o, start + 0.2, 1000, 0.13);
      tone(o, start + 0.4, 1000, 0.13);
      tone(o, start + 0.6, 1500, 0.35);
    }
  },
  // Ding-ding-ding-ding rápido, como la campana del ring.
  boxing: (o) => {
    for (let i = 0; i < 6; i++) bell(o, i * 0.22, 1250, 1.4);
  },
  // Silbato de árbitro: un pitazo corto y uno largo, con el trino típico.
  whistle: (o) => {
    for (const [start, dur] of [
      [0, 0.35],
      [0.5, 0.35],
      [1.0, 0.9],
    ] as [number, number][]) {
      const osc = tone(o, start, 2900, dur, { type: "sine", vol: 0.7 });
      const lfo = o.a.createOscillator();
      const depth = o.a.createGain();
      lfo.frequency.value = 28;
      depth.gain.value = 140;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(o.a.currentTime + start);
      lfo.stop(o.a.currentTime + start + dur + 0.05);
      tone(o, start, 5800, dur, { type: "sine", vol: 0.12 });
    }
  },
  // Bocina de estadio: acorde áspero, tres toques.
  horn: (o) => {
    for (const [start, dur] of [
      [0, 0.45],
      [0.6, 0.45],
      [1.2, 0.9],
    ] as [number, number][]) {
      tone(o, start, 466, dur, { type: "sawtooth", vol: 0.35 });
      tone(o, start, 587, dur, { type: "sawtooth", vol: 0.3, detune: 8 });
      tone(o, start, 698, dur, { type: "sawtooth", vol: 0.25, detune: -6 });
      tone(o, start, 932, dur, { type: "square", vol: 0.12 });
    }
  },
  // Sirena que sube y baja, dos veces.
  siren: (o) => {
    for (const start of [0, 1.0]) {
      tone(o, start, 700, 0.5, { type: "square", vol: 0.45, endFreq: 1600 });
      tone(o, start + 0.5, 1600, 0.5, { type: "square", vol: 0.45, endFreq: 700 });
    }
  },
};

/** Hace sonar una alarma puntual (para escucharla antes de elegirla). */
export function previewRestSound(choice: RestSoundChoice = getRestSoundChoice(), volume: RestVolume = getRestVolume()): void {
  const o = out(volume);
  if (!o) return;
  PATTERNS[choice](o);
}

/** Fin del descanso: la alarma elegida y vibración. */
export function playRestEnd(): void {
  if (!restSoundEnabled()) return;
  previewRestSound();
  try {
    navigator.vibrate?.([300, 120, 300, 120, 600]);
  } catch {
    /* sin vibración */
  }
}

/** Últimos segundos del descanso: un tic. */
export function playRestTick(): void {
  if (!restSoundEnabled()) return;
  const o = out(getRestVolume());
  if (!o) return;
  tone(o, 0, 1000, 0.07, { type: "square", vol: 0.3 });
}
