import { supabase } from "../lib/supabase";
import { getSessionStatuses } from "./training";

/**
 * ¿Cómo va el plan (por semanas) de cada alumno?
 *  - "ending": está en la última semana que tiene rutinas armadas.
 *  - "done": ya hizo (o saltó) todas las rutinas armadas: no le queda nada.
 *  - "none": no tiene ningún programa activo.
 *  - "ok": le quedan semanas.
 * Las rutinas fijas se repiten solas: siempre "ok".
 */
export type PlanState = "ok" | "ending" | "done" | "none";
export interface PlanStatus {
  state: PlanState;
  programId?: string;
  programName?: string;
  /** Última semana con rutinas armadas. */
  lastWeek?: number;
}

export async function planStatusByClient(clientIds: string[]): Promise<Record<string, PlanStatus>> {
  const out: Record<string, PlanStatus> = {};
  if (!clientIds.length) return out;
  const { data: progs, error } = await supabase
    .from("programs")
    .select("*")
    .in("client_id", clientIds)
    .eq("status", "active")
    .eq("is_template", false)
    .order("created_at", { ascending: false });
  if (error) return out;
  // El programa activo de cada alumno (el más nuevo, igual que en su app).
  const active = new Map<string, any>();
  for (const p of progs ?? []) if (!active.has(p.client_id)) active.set(p.client_id, p);
  for (const id of clientIds) if (!active.has(id)) out[id] = { state: "none" };

  const weekly = [...active.values()].filter((p) => p.plan_mode !== "fixed");
  for (const p of active.values()) if (p.plan_mode === "fixed") out[p.client_id] = { state: "ok", programId: p.id, programName: p.name };
  if (!weekly.length) return out;

  const ids = weekly.map((p) => p.id);
  const [{ data: weeks }, { data: sessions }] = await Promise.all([
    supabase.from("weeks").select("id, program_id, week_number").in("program_id", ids),
    supabase.from("sessions").select("id, week_id, program_id").in("program_id", ids),
  ]);
  const st = await getSessionStatuses((sessions ?? []).map((s: any) => s.id));

  for (const p of weekly) {
    const ws = (weeks ?? []).filter((w: any) => w.program_id === p.id).sort((a: any, b: any) => a.week_number - b.week_number);
    const withSessions = ws.filter((w: any) => (sessions ?? []).some((s: any) => s.week_id === w.id));
    if (!withSessions.length) {
      out[p.client_id] = { state: "done", programId: p.id, programName: p.name, lastWeek: 0 };
      continue;
    }
    const last = withSessions[withSessions.length - 1].week_number as number;
    // Primera semana (con rutinas) que todavía no terminó.
    const current = withSessions.find((w: any) =>
      (sessions ?? []).filter((s: any) => s.week_id === w.id).some((s: any) => st[s.id] !== "completed" && st[s.id] !== "skipped"),
    );
    const state: PlanState = !current ? "done" : current.week_number === last ? "ending" : "ok";
    out[p.client_id] = { state, programId: p.id, programName: p.name, lastWeek: last };
  }
  return out;
}
