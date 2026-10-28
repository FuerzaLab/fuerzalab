import { supabase } from "../lib/supabase";
import { formatLoad } from "../lib/units";
import type { ClientRow } from "./clients";
import { wellnessScore, lowFields, WELLNESS_FIELD_LABEL, type WellnessLogRow } from "./wellness";

/**
 * "Novedades" de Inicio: lo que hicieron los clientes y merece la atención
 * del entrenador. Se calcula en vivo cada vez que se abre Inicio (como
 * Sugerencias), y lo que el entrenador ya marcó como "atendido" se guarda
 * en dashboard_dismissals para no volver a mostrarlo.
 *
 * Cada novedad tiene una clave estable (ej. "pr:<id de la serie>") que es
 * lo que se guarda al marcarla como atendida.
 */

export type FeedKind = "record" | "measure" | "note" | "skip" | "wellness" | "photos";

export interface FeedItem {
  key: string;
  kind: FeedKind;
  clientId: string;
  /** Fecha/hora del hecho, para ordenar (más nuevo primero). */
  at: string;
  title: string;
  detail?: string;
  tone: "ok" | "warn" | "bad" | "pri" | "";
}

export const FEED_KIND_LABEL: Record<FeedKind, string> = {
  record: "Récord",
  measure: "Medidas",
  note: "Comentario",
  skip: "Rutina saltada",
  wellness: "Bienestar",
  photos: "Fotos",
};

const DAYS = 30;
const isoDaysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const dateDaysAgo = (n: number) => isoDaysAgo(n).slice(0, 10);
const fmtKg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null);

/** Lo ya atendido por este usuario. Si la tabla no existe todavía (falta la migración), nada. */
export async function listDismissedKeys(): Promise<Set<string>> {
  const { data, error } = await supabase.from("dashboard_dismissals").select("item_key").gte("dismissed_at", isoDaysAgo(90));
  if (error) return new Set();
  return new Set((data ?? []).map((r: any) => r.item_key as string));
}

export async function dismissItems(keys: string[]): Promise<void> {
  if (!keys.length) return;
  const { error } = await supabase
    .from("dashboard_dismissals")
    .upsert(keys.map((item_key) => ({ item_key })), { onConflict: "user_id,item_key", ignoreDuplicates: true });
  if (error) throw error;
}

// --- Récords ------------------------------------------------------------

async function recordItems(): Promise<FeedItem[]> {
  const { data, error } = await supabase
    .from("personal_records")
    .select("*")
    .gte("performed_at", isoDaysAgo(DAYS))
    .order("performed_at", { ascending: false })
    .limit(300);
  if (error) return [];

  // Agrupados por sesión: si en un mismo entrenamiento batió 3 récords, es
  // una sola novedad ("3 récords nuevos: …"), no tres.
  const bySession = new Map<string, any[]>();
  for (const r of data ?? []) {
    const k = (r.workout_log_id as string) ?? (r.id as string);
    const list = bySession.get(k);
    if (list) list.push(r);
    else bySession.set(k, [r]);
  }

  const describe = (r: any) => {
    const metric = Number(r.metric);
    const prev = Number(r.previous_best);
    if (!r.with_load) return `${r.exercise_name}: ${r.reps} reps (antes ${fmtKg(prev)})`;
    const pct = prev > 0 ? Math.round(((metric - prev) / prev) * 100) : null;
    const u = r.load_unit === "lb" ? "lb" : "kg";
    return `${r.exercise_name}: ${formatLoad(Number(r.load_kg), u)} × ${r.reps}, 1RM est. ${formatLoad(metric, u)}${pct ? ` (+${pct}%)` : ""}`;
  };
  const joinNames = (names: string[]) =>
    names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;

  return [...bySession.entries()].map(([k, list]) => {
    const names = Array.from(new Set(list.map((r) => r.exercise_name as string)));
    const latest = list.reduce((a, b) => (a.performed_at > b.performed_at ? a : b));
    return {
      key: `pr:${k}`,
      kind: "record" as const,
      clientId: latest.client_id,
      at: latest.performed_at,
      title: list.length === 1 ? `Nuevo récord en ${names[0]}` : `${list.length} récords nuevos: ${joinNames(names)}`,
      detail: list.map(describe).join(" · "),
      tone: "ok" as const,
    };
  });
}

// --- Medidas que cargó el cliente --------------------------------------

async function measureItems(): Promise<FeedItem[]> {
  const { data: recent, error } = await supabase
    .from("assessments")
    .select("id, client_id, assessed_at, created_at, body_measurements(weight_kg, body_fat_pct)")
    .eq("type", "self_report")
    .gte("assessed_at", dateDaysAgo(DAYS))
    .order("assessed_at", { ascending: false });
  if (error || !recent?.length) return [];

  const clientIds = Array.from(new Set(recent.map((a: any) => a.client_id as string)));
  const ids = recent.map((a: any) => a.id as string);

  // Todas las evaluaciones con peso de esos clientes, para comparar cada
  // autoreporte con la medición anterior (la haya hecho el entrenador o el cliente).
  const [{ data: history }, { data: circs }] = await Promise.all([
    supabase
      .from("assessments")
      .select("id, client_id, assessed_at, created_at, body_measurements(weight_kg, body_fat_pct)")
      .in("client_id", clientIds)
      .order("assessed_at", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1000),
    supabase.from("circumferences").select("assessment_id").in("assessment_id", ids),
  ]);
  const circCount = new Map<string, number>();
  for (const c of circs ?? []) circCount.set(c.assessment_id as string, (circCount.get(c.assessment_id as string) ?? 0) + 1);

  return recent.map((a: any) => {
    const bm = one<any>(a.body_measurements);
    const prevList = (history ?? []).filter(
      (h: any) =>
        h.client_id === a.client_id &&
        h.id !== a.id &&
        one<any>(h.body_measurements) &&
        (h.assessed_at < a.assessed_at || (h.assessed_at === a.assessed_at && h.created_at < a.created_at)),
    );
    const prev = prevList.length ? one<any>(prevList[prevList.length - 1].body_measurements) : null;
    const parts: string[] = [];
    if (bm?.weight_kg != null) {
      const w = Number(bm.weight_kg);
      if (prev?.weight_kg != null) {
        const d = w - Number(prev.weight_kg);
        parts.push(`Peso ${fmtKg(w)} kg (${d === 0 ? "sin cambios" : `${d > 0 ? "+" : ""}${fmtKg(Math.round(d * 10) / 10)} kg`})`);
      } else parts.push(`Peso ${fmtKg(w)} kg`);
    }
    if (bm?.body_fat_pct != null) {
      const f = Number(bm.body_fat_pct);
      if (prev?.body_fat_pct != null) {
        const d = Math.round((f - Number(prev.body_fat_pct)) * 10) / 10;
        parts.push(`grasa ${fmtKg(f)}% (${d === 0 ? "sin cambios" : `${d > 0 ? "+" : ""}${fmtKg(d)} pts`})`);
      } else parts.push(`grasa ${fmtKg(f)}%`);
    }
    const n = circCount.get(a.id) ?? 0;
    if (n) parts.push(`${n} circunferencia${n === 1 ? "" : "s"}`);
    return {
      key: `measure:${a.id}`,
      kind: "measure" as const,
      clientId: a.client_id,
      at: a.created_at,
      title: "Cargó nuevas medidas",
      detail: parts.join(" · ") || undefined,
      tone: "pri" as const,
    };
  });
}

// --- Comentarios al terminar y rutinas saltadas -----------------------

async function workoutItems(): Promise<FeedItem[]> {
  const since = isoDaysAgo(DAYS);
  const [done, skipped] = await Promise.all([
    supabase
      .from("workout_logs")
      .select("id, client_id, completed_at, session_rpe, comments, sessions(name)")
      .eq("status", "completed")
      .gte("completed_at", since)
      .or("comments.not.is.null,session_rpe.gt.8,session_rpe.lt.5")
      .order("completed_at", { ascending: false })
      .limit(200),
    supabase
      .from("workout_logs")
      .select("id, client_id, updated_at, sessions(name)")
      .eq("status", "skipped")
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  const items: FeedItem[] = [];
  for (const l of (done.data ?? []) as any[]) {
    const comment = (l.comments as string | null)?.trim();
    const rpe = l.session_rpe != null ? Number(l.session_rpe) : null;
    // Alerta de esfuerzo solo fuera del rango esperado: por encima de 8
    // (muy exigente) o por debajo de 5 (muy liviana). Entre 5 y 8 el RPE
    // se muestra solo si acompaña a un comentario.
    const rpeHigh = rpe != null && rpe > 8;
    const rpeLow = rpe != null && rpe < 5;
    if (!comment && !rpeHigh && !rpeLow) continue;
    const session = one<any>(l.sessions)?.name ?? "su rutina";
    items.push({
      key: `note:${l.id}`,
      kind: "note",
      clientId: l.client_id,
      at: l.completed_at,
      title: comment
        ? `Dejó un comentario al terminar ${session}`
        : rpeHigh
          ? `Terminó ${session} con esfuerzo muy alto`
          : `Terminó ${session} con esfuerzo muy bajo`,
      detail: [
        comment ? `“${comment}”` : null,
        rpe != null ? `RPE ${rpe}/10${rpeHigh ? " — por encima de 8" : rpeLow ? " — por debajo de 5" : ""}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      tone: rpeHigh || rpeLow ? "warn" : "",
    });
  }
  for (const l of (skipped.data ?? []) as any[]) {
    items.push({
      key: `skip:${l.id}`,
      kind: "skip",
      clientId: l.client_id,
      at: l.updated_at,
      title: `Saltó ${one<any>(l.sessions)?.name ?? "una rutina"}`,
      tone: "warn",
    });
  }
  return items;
}

// --- Bienestar ----------------------------------------------------------

async function wellnessItems(): Promise<FeedItem[]> {
  const { data, error } = await supabase
    .from("wellness_logs")
    .select("id, client_id, log_date, created_at, sleep_hours, sleep_quality, fatigue, energy, stress, soreness, pain_location, notes, trainer_adjustment")
    .gte("log_date", dateDaysAgo(7))
    .order("log_date", { ascending: false });
  if (error) return [];
  const items: FeedItem[] = [];
  for (const l of (data ?? []) as (WellnessLogRow & { created_at?: string })[]) {
    const score = wellnessScore(l);
    const low = lowFields(l);
    const pain = l.pain_location?.trim();
    if (score >= 80 && low.length === 0 && !pain) continue;
    const parts: string[] = [];
    if (low.length) parts.push(`Bajo: ${low.map((f) => WELLNESS_FIELD_LABEL[f].toLowerCase()).join(", ")}`);
    if (pain) parts.push(`Dolor: ${pain}`);
    if (l.notes?.trim()) parts.push(`“${l.notes.trim()}”`);
    items.push({
      key: `wellness:${l.id}`,
      kind: "wellness",
      clientId: l.client_id,
      at: l.created_at ?? `${l.log_date}T12:00:00`,
      title: `Bienestar ${score < 60 ? "🔴" : score < 80 ? "🟡" : "🟢"} ${score}/100`,
      detail: parts.join(" · ") || undefined,
      tone: score < 60 ? "bad" : "warn",
    });
  }
  return items;
}

// --- Fotos que subió el cliente ----------------------------------------

async function photoItems(clients: ClientRow[]): Promise<FeedItem[]> {
  const { data, error } = await supabase
    .from("client_files")
    .select("id, client_id, uploaded_by, created_at")
    .eq("kind", "progress_photo")
    .gte("created_at", isoDaysAgo(DAYS))
    .order("created_at", { ascending: false });
  if (error) return [];
  const profileOf = new Map(clients.map((c) => [c.id, c.profile_id]));
  // Agrupadas por cliente y día: "subió 3 fotos", no tres novedades.
  const groups = new Map<string, { clientId: string; day: string; at: string; n: number }>();
  for (const f of (data ?? []) as any[]) {
    const clientProfile = profileOf.get(f.client_id);
    if (!clientProfile || f.uploaded_by !== clientProfile) continue; // solo las que subió el propio cliente
    const day = (f.created_at as string).slice(0, 10);
    const k = `${f.client_id}:${day}`;
    const g = groups.get(k);
    if (g) g.n += 1;
    else groups.set(k, { clientId: f.client_id, day, at: f.created_at, n: 1 });
  }
  return [...groups.entries()].map(([k, g]) => ({
    key: `photos:${k}`,
    kind: "photos" as const,
    clientId: g.clientId,
    at: g.at,
    title: `Subió ${g.n} foto${g.n === 1 ? "" : "s"} de progreso`,
    tone: "pri" as const,
  }));
}

/**
 * Todas las novedades pendientes (sin las ya atendidas), más nuevas primero.
 * `allow` dice qué tipos puede ver este usuario (para un asistente, según
 * sus permisos). Si una fuente falla, se omite y las demás se muestran igual.
 */
export async function loadFeed(
  clients: ClientRow[],
  allow: Record<"logs" | "assessments" | "health" | "files", boolean>,
): Promise<FeedItem[]> {
  const known = new Set(clients.map((c) => c.id));
  const safe = (p: Promise<FeedItem[]>) => p.catch((): FeedItem[] => []);
  const [dismissed, ...groups] = await Promise.all([
    listDismissedKeys(),
    allow.logs ? safe(recordItems()) : Promise.resolve([] as FeedItem[]),
    allow.logs ? safe(workoutItems()) : Promise.resolve([] as FeedItem[]),
    allow.assessments ? safe(measureItems()) : Promise.resolve([] as FeedItem[]),
    allow.health ? safe(wellnessItems()) : Promise.resolve([] as FeedItem[]),
    allow.files ? safe(photoItems(clients)) : Promise.resolve([] as FeedItem[]),
  ]);
  return groups
    .flat()
    .filter((i) => known.has(i.clientId) && !dismissed.has(i.key))
    .sort((a, b) => b.at.localeCompare(a.at));
}
