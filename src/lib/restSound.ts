/**
 * Alarma (y vibración) del cronómetro de descanso.
 *  - Al terminar el descanso suena la alarma elegida (5 opciones) y vibra
 *    en los celulares que lo permiten (Android; iPhone no deja vibrar desde la web).
 *  - Un "tic" en los últimos 3 segundos.
 *  - Volumen: normal, fuerte o muy fuerte, con compresor para que se escuche
 *    más fuerte en el parlante del celular sin romperse.
 *
 * CÓMO SUENA (importante para iPhone): cada alarma se "graba" una vez con el
 * propio navegador (OfflineAudioContext) como un archivo de audio (WAV) y se
 * reproduce con un elemento <audio>. El iPhone solo deja reproducir audio
 * después de un toque, y además silencia el audio "de juego" (Web Audio) si
 * el celular está en modo silencio; un <audio> que ya se reprodujo durante un
 * toque (unlockRestSound, al marcar una serie) puede volver a sonar después,
 * y suena aunque esté en silencio. Si algo de eso falla, se usa Web Audio.
 * Todo queda guardado en el dispositivo (prendido/apagado, sonido y volumen).
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
  if (typeof window !== "undefined") setTimeout(prepareRestSound, 0);
}

export function getRestVolume(): RestVolume {
  const v = read(KEY_VOLUME);
  return REST_VOLUMES.some((s) => s.id === v) ? (v as RestVolume) : "loud";
}

export function setRestVolume(volume: RestVolume): void {
  write(KEY_VOLUME, volume);
  if (typeof window !== "undefined") setTimeout(prepareRestSound, 0);
}

// --- Motor de audio ------------------------------------------------------

type Out = { a: BaseAudioContext; dest: AudioNode };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function setPlaybackSession() {
  try {
    // iPhone (iOS 17+): que el audio de la página sea "reproducción", así suena aunque esté en silencio.
    const session = (navigator as any).audioSession;
    if (session && "type" in session && session.type !== "playback") session.type = "playback";
  } catch {
    /* navegador sin audioSession */
  }
}

/** Cadena de salida: sonidos → volumen → compresor (sube lo bajo, frena los picos) → destino. */
function chain(a: BaseAudioContext): GainNode {
  const comp = a.createDynamicsCompressor();
  comp.threshold.value = -24;
  comp.knee.value = 6;
  comp.ratio.value = 12;
  comp.attack.value = 0.002;
  comp.release.value = 0.15;
  const g = a.createGain();
  g.connect(comp).connect(a.destination);
  return g;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    setPlaybackSession();
    ctx = new AC() as AudioContext;
    master = chain(ctx);
  }
  return ctx;
}

function out(volume: RestVolume): Out | null {
  const a = audio();
  if (!a || !master) return null;
  if (a.state !== "running") a.resume().catch(() => {});
  master.gain.setValueAtTime(VOLUME_GAIN[volume], a.currentTime);
  return { a, dest: master };
}

// --- Alarmas "grabadas" como WAV y reproducidas con <audio> ----------------

const ALARM_SECONDS = 2.8;
const TICK_SECONDS = 0.15;
const RATE = 44100;
const rendered = new Map<string, string>(); // clave → URL del WAV
const rendering = new Map<string, Promise<string | null>>();

function wavUrl(buf: AudioBuffer | Float32Array, rate = RATE): string {
  const data = buf instanceof Float32Array ? buf : buf.getChannelData(0);
  const bytes = new ArrayBuffer(44 + data.length * 2);
  const v = new DataView(bytes);
  const w = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + data.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) {
    const x = Math.max(-1, Math.min(1, data[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
}

let silentUrl: string | null = null;
const silent = () => (silentUrl ??= wavUrl(new Float32Array(Math.round(RATE * 0.12)), RATE));

/** Graba la alarma (o el tic) a un WAV. No necesita un toque: se puede preparar en cualquier momento. */
function renderSound(kind: RestSoundChoice | "tick", volume: RestVolume): Promise<string | null> {
  const key = `${kind}|${volume}`;
  const done = rendered.get(key);
  if (done) return Promise.resolve(done);
  const running = rendering.get(key);
  if (running) return running;
  const OAC = typeof window !== "undefined" ? (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext : null;
  if (!OAC) return Promise.resolve(null);
  const job = (async () => {
    try {
      const seconds = kind === "tick" ? TICK_SECONDS : ALARM_SECONDS;
      const off: OfflineAudioContext = new OAC(1, Math.round(RATE * seconds), RATE);
      const g = chain(off);
      g.gain.value = VOLUME_GAIN[volume];
      const o = { a: off, dest: g };
      if (kind === "tick") tone(o, 0, 1000, 0.07, { type: "square", vol: 0.3 });
      else PATTERNS[kind](o);
      const buf: AudioBuffer = await new Promise((resolve, reject) => {
        const r = off.startRendering() as unknown as Promise<AudioBuffer> | undefined;
        if (r && typeof (r as any).then === "function") r.then(resolve, reject);
        else (off as any).oncomplete = (e: any) => resolve(e.renderedBuffer);
      });
      const url = wavUrl(buf);
      rendered.set(key, url);
      return url;
    } catch {
      return null;
    } finally {
      rendering.delete(key);
    }
  })();
  rendering.set(key, job);
  return job;
}

/** Deja preparadas la alarma elegida y el tic (se llama sola; no hace falta un toque). */
export function prepareRestSound(): void {
  renderSound(getRestSoundChoice(), getRestVolume());
  renderSound("tick", getRestVolume());
}

type Player = { el: HTMLAudioElement; unlocked: boolean };
const players: Record<"alarm" | "tick", Player | null> = { alarm: null, tick: null };

function player(which: "alarm" | "tick"): Player | null {
  if (typeof document === "undefined" || typeof Audio === "undefined") return null;
  if (!players[which]) {
    const el = new Audio();
    el.preload = "auto";
    el.setAttribute("playsinline", "");
    el.setAttribute("webkit-playsinline", "");
    players[which] = { el, unlocked: false };
  }
  return players[which];
}

/** Durante un toque: hace sonar un instante de silencio en cada <audio> para que después puedan sonar solos. */
function unlockPlayers() {
  (["alarm", "tick"] as const).forEach((which) => {
    const p = player(which);
    if (!p || p.unlocked) return;
    try {
      p.el.src = silent();
      const r = p.el.play();
      const ok = () => {
        p.unlocked = true;
        try {
          p.el.pause();
        } catch {
          /* nada */
        }
      };
      if (r && typeof r.then === "function") r.then(ok).catch(() => {});
      else ok();
    } catch {
      /* sin <audio> */
    }
  });
}

/** Reproduce con <audio>; devuelve false si no se pudo (y entonces se usa Web Audio). */
function playFile(which: "alarm" | "tick", url: string | undefined): boolean {
  const p = player(which);
  if (!p || !p.unlocked || !url) return false;
  try {
    if (p.el.src !== url) p.el.src = url;
    p.el.currentTime = 0;
    const r = p.el.play();
    if (r && typeof r.catch === "function") r.catch(() => fallback(which));
    return true;
  } catch {
    return false;
  }
}

let fallbackChoice: { choice: RestSoundChoice; volume: RestVolume } | null = null;
function fallback(which: "alarm" | "tick") {
  const o = out(fallbackChoice?.volume ?? getRestVolume());
  if (!o) return;
  if (which === "tick") tone(o, 0, 1000, 0.07, { type: "square", vol: 0.3 });
  else PATTERNS[fallbackChoice?.choice ?? getRestSoundChoice()](o);
}

/** Llamar dentro de un toque (por ejemplo, al marcar la serie) para que después pueda sonar. */
export function unlockRestSound(): void {
  setPlaybackSession();
  unlockPlayers();
  prepareRestSound();
  const a = audio();
  if (!a) return;
  if (a.state !== "running") a.resume().catch(() => {});
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
  o: Out,
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
function bell(o: Out, at: number, base: number, dur: number) {
  const partials: [number, number][] = [
    [1, 0.6],
    [2.76, 0.35],
    [5.4, 0.22],
    [8.93, 0.12],
  ];
  for (const [ratio, vol] of partials) tone(o, at, base * ratio, dur / Math.sqrt(ratio), { type: "sine", vol, decay: "exp" });
  tone(o, at, base * 2, 0.04, { type: "square", vol: 0.25, decay: "exp" }); // el "clic" del golpe
}

const PATTERNS: Record<RestSoundChoice, (o: Out) => void> = {
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

/** Hace sonar una alarma (para escucharla antes de elegirla, o al terminar el descanso). */
export function previewRestSound(choice: RestSoundChoice = getRestSoundChoice(), volume: RestVolume = getRestVolume()): void {
  fallbackChoice = { choice, volume };
  if (playFile("alarm", rendered.get(`${choice}|${volume}`))) return;
  // Todavía no está grabada: suena con Web Audio y queda grabada para la próxima.
  fallback("alarm");
  renderSound(choice, volume);
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
  const volume = getRestVolume();
  fallbackChoice = { choice: getRestSoundChoice(), volume };
  if (playFile("tick", rendered.get(`tick|${volume}`))) return;
  fallback("tick");
  renderSound("tick", volume);
}
