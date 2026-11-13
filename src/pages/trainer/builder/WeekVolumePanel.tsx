import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { doneVolume, plannedVolume, type MuscleVolume, type VolumeItem, type VolumeLog } from "../../../lib/muscleVolume";
import { listSessionBlocks, listWorkoutExercises, type SessionRow } from "../../../services/sessions";
import { listFixedSlots } from "../../../services/fixedRoutines";
import type { CatalogItem, ExerciseRow } from "../../../services/exercises";

/**
 * Constructor → "Volumen de la semana por grupo muscular": series
 * fraccionales (directas = 1, indirectas = 0,5; Pelland y col., Sports
 * Medicine 2026), frecuencia semanal y tonelaje, planificado contra
 * realizado. Plan por semanas: la semana elegida. Rutinas fijas: las rutinas
 * de la semana, y lo realizado desde el lunes.
 */
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(".", ","));

async function loadItems(sessions: { id: string }[]): Promise<VolumeItem[]> {
  const out: VolumeItem[] = [];
  await Promise.all(
    sessions.map(async (s) => {
      const [items, blocks] = await Promise.all([listWorkoutExercises(s.id), listSessionBlocks(s.id)]);
      const kind = new Map(blocks.map((b) => [b.id, b.kind as string]));
      for (const it of items)
        out.push({
          id: it.id,
          session_id: s.id,
          exercise_id: it.exercise_id,
          blockKind: it.block_id ? kind.get(it.block_id) ?? null : null,
          sets: it.sets,
          reps_min: it.reps_min,
          reps_max: it.reps_max,
          load_value: it.load_value,
          duration_min: it.duration_min,
        });
    }),
  );
  return out;
}

async function loadLogs(sessionIds: string[], sinceIso?: string): Promise<VolumeLog[]> {
  if (!sessionIds.length) return [];
  let q = supabase.from("workout_logs").select("id, session_id, status, completed_at").in("session_id", sessionIds).eq("status", "completed");
  if (sinceIso) q = q.gte("completed_at", sinceIso);
  const { data: wl } = await q;
  const logs = (wl ?? []) as { id: string; session_id: string }[];
  if (!logs.length) return [];
  const sessionOf = new Map(logs.map((l) => [l.id, l.session_id]));
  const { data: sl } = await supabase.from("set_logs").select("workout_log_id, workout_exercise_id, reps, load_kg, completed").in("workout_log_id", logs.map((l) => l.id));
  return ((sl ?? []) as any[]).map((r) => ({ ...r, session_id: sessionOf.get(r.workout_log_id) ?? "" }));
}

export default function WeekVolumePanel({
  mode,
  sessions,
  programId,
  exercises,
  muscles,
}: {
  mode: "week" | "fixed";
  /** Plan por semanas: las rutinas de la semana elegida. */
  sessions?: SessionRow[];
  programId: string;
  exercises: ExerciseRow[];
  muscles: CatalogItem[];
}) {
  const [open, setOpen] = useState(false);
  const [planned, setPlanned] = useState<Record<string, MuscleVolume> | null>(null);
  const [done, setDone] = useState<Record<string, MuscleVolume>>({});
  const [loading, setLoading] = useState(false);
  const exById = Object.fromEntries(exercises.map((e) => [e.id, e]));
  const key = mode === "week" ? (sessions ?? []).map((s) => s.id).join(",") : programId;

  const load = async () => {
    setLoading(true);
    try {
      if (mode === "week") {
        const ss = sessions ?? [];
        const items = await loadItems(ss);
        setPlanned(plannedVolume(items, exById));
        setDone(doneVolume(await loadLogs(ss.map((s) => s.id)), items, exById));
      } else {
        const slots = await listFixedSlots(programId);
        const items = await loadItems(slots);
        setPlanned(plannedVolume(items, exById));
        // Realizado desde el lunes, en cualquier semana del programa.
        const { data: all } = await supabase.from("sessions").select("id").eq("program_id", programId);
        const monday = new Date();
        monday.setHours(0, 0, 0, 0);
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        const logs = await loadLogs(((all ?? []) as { id: string }[]).map((x) => x.id), monday.toISOString());
        const doneItems = await loadItems([...new Set(logs.map((l) => l.session_id))].map((id) => ({ id })));
        setDone(doneVolume(logs, doneItems, exById));
      }
    } catch {
      setPlanned({});
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, key]);

  const label = (id: string) => muscles.find((m) => m.id === id)?.label ?? "Sin grupo";
  const ids = [...new Set([...Object.keys(planned ?? {}), ...Object.keys(done)])].sort(
    (a, b) => (planned?.[b]?.fractional ?? 0) - (planned?.[a]?.fractional ?? 0) || label(a).localeCompare(label(b)),
  );
  const max = Math.max(1, ...ids.map((id) => Math.max(planned?.[id]?.fractional ?? 0, done[id]?.fractional ?? 0)));
  const noSecondaries = exercises.length > 0 && !exercises.some((e) => (e.secondary_muscle_ids ?? []).length);

  return (
    <div className="panel" style={{ marginTop: 18 }}>
      <button className="vol-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>
          <b>Volumen de la semana por grupo muscular</b>
          <span className="note"> · series, frecuencia y tonelaje, planificado y realizado</span>
        </span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="bd" style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="note" style={{ fontSize: 13 }}>
              {mode === "week" ? "Las rutinas de esta semana." : "Las rutinas fijas de una semana; lo realizado, desde el lunes."} Solo bloques de trabajo.
            </span>
            <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 13 }} onClick={load} disabled={loading}>
              <RefreshCw size={13} /> {loading ? "Calculando…" : "Actualizar"}
            </button>
          </div>
          {planned && ids.length === 0 && <p className="note" style={{ margin: 0 }}>Todavía no hay ejercicios con grupo muscular en esta semana.</p>}
          {planned && ids.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table className="vol-table">
                <thead>
                  <tr>
                    <th>Grupo muscular</th>
                    <th title="Directas + 0,5 × indirectas">Series</th>
                    <th>Directas · indirectas</th>
                    <th title="En cuántas rutinas de la semana se trabaja">Frecuencia</th>
                    <th>Tonelaje</th>
                    <th>Realizado</th>
                  </tr>
                </thead>
                <tbody>
                  {ids.map((id) => {
                    const p = planned[id];
                    const d = done[id];
                    return (
                      <tr key={id}>
                        <td><b>{label(id)}</b></td>
                        <td style={{ minWidth: 130 }}>
                          <div className="vol-bar"><span style={{ width: `${((p?.fractional ?? 0) / max) * 100}%` }} /></div>
                          <b>{fmt(p?.fractional ?? 0)}</b>
                        </td>
                        <td className="note">{p ? `${fmt(p.direct)} · ${fmt(p.indirect)}` : "—"}</td>
                        <td>{p ? `${p.frequency}×` : "—"}</td>
                        <td className="note">{p?.tonnageKg ? `${p.tonnageKg.toLocaleString("es")} kg` : "—"}</td>
                        <td style={{ minWidth: 120 }}>
                          <div className="vol-bar done"><span style={{ width: `${((d?.fractional ?? 0) / max) * 100}%` }} /></div>
                          {d ? `${fmt(d.fractional)} series` : <span className="note">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="note" style={{ margin: 0, fontSize: 12.5 }}>
            Series contadas como en el metaanálisis de Pelland y colaboradores (Sports Medicine, 2026): cada serie vale 1 para el músculo
            principal del ejercicio y 0,5 para sus músculos secundarios. Más series se asocian con más hipertrofia, con rendimientos
            decrecientes; la fuerza llega antes a ese punto y se beneficia más de entrenar el músculo más días por semana.
            {noSecondaries && " Tus ejercicios todavía no tienen músculos secundarios: cárgalos en Ejercicios para que cuenten."}
          </p>
        </div>
      )}
    </div>
  );
}
